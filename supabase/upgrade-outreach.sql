-- Atualização do CRM já instalado. Execute uma vez no SQL Editor do projeto.
BEGIN;
-- Private templates and manually confirmed outreach. No sending integration.
alter table public.leads add column referred_by text not null default '';
alter table public.pipeline_history add column reason text not null default '';
create table public.message_templates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 150), category text not null default 'Primeira abordagem',
 niche_group text not null check(niche_group in ('Saúde / Estética','Serviços Técnicos','Transporte / Logística','Indicação','Geral')),
 channel text not null default 'WhatsApp' check(channel='WhatsApp'), message text not null check(length(trim(message)) between 1 and 8000),
 is_active boolean not null default true, is_default boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(not is_default or is_active)
);
create unique index message_template_default on public.message_templates(user_id,niche_group) where is_default;
alter table public.message_templates enable row level security;
create policy templates_private on public.message_templates for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,update,delete on public.message_templates to authenticated;
revoke all on public.message_templates from anon;
create function public.touch_message_template() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); new.created_at:=old.created_at; new.user_id:=old.user_id; return new; end; $$;
create trigger template_updated before update on public.message_templates for each row execute function public.touch_message_template();

create table public.lead_approaches (
 id uuid primary key, lead_id uuid not null references public.leads(id) on delete cascade,
 user_id uuid not null references public.profiles(id), template_id uuid references public.message_templates(id) on delete set null,
 template_name text not null, template_group text not null, message text not null check(length(trim(message)) between 1 and 8000),
 phone text not null, niche text not null, product_id uuid references public.products(id),
 interaction_id uuid not null unique references public.lead_interactions(id) on delete cascade,
 confirmed_at timestamptz not null default now(), response_interaction_id uuid references public.lead_interactions(id) on delete set null,
 responded_at timestamptz
);
create index approaches_lead_date on public.lead_approaches(lead_id,confirmed_at desc);
create index approaches_template_date on public.lead_approaches(template_id,confirmed_at);
alter table public.lead_approaches enable row level security;
create policy approaches_read on public.lead_approaches for select to authenticated using(exists(select 1 from public.leads l where l.id=lead_id));
revoke all on public.lead_approaches from anon,authenticated;
grant select on public.lead_approaches to authenticated;

create or replace function public.log_stage() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.pipeline_history(lead_id,to_stage,actor_id) values(new.id,new.stage,auth.uid());
 elsif old.stage is distinct from new.stage then
  insert into public.pipeline_history(lead_id,from_stage,to_stage,actor_id,reason)
  values(new.id,old.stage,new.stage,auth.uid(),coalesce(current_setting('crm.approach_reason',true),''));
 end if;
 return new;
end; $$;

-- One transaction: lock the lead, validate ownership, deduplicate retries, record audit and stage.
create function public.confirm_approach(p_id uuid,p_lead uuid,p_template uuid,p_message text,p_phone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare l public.leads; t public.message_templates; previous public.lead_approaches; interaction uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or (l.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Lead unavailable'; end if;
 select * into previous from public.lead_approaches where id=p_id;
 if found then
  if previous.user_id<>auth.uid() or previous.lead_id<>p_lead then raise exception 'Invalid confirmation'; end if;
  return previous.id;
 end if;
 select * into t from public.message_templates where id=p_template and user_id=auth.uid() and is_active;
 if not found then raise exception 'Template unavailable'; end if;
 if p_message is null or length(trim(p_message)) not between 1 and 8000 or p_message ~ '\{\{[^}]*\}\}' then raise exception 'Invalid message'; end if;
 if p_phone is null or p_phone !~ '^[1-9][0-9]{9,14}$' then raise exception 'Invalid phone'; end if;
 insert into public.lead_interactions(lead_id,actor_id,type,description)
 values(l.id,auth.uid(),'WhatsApp','Primeira abordagem comercial enviada.') returning id into interaction;
 insert into public.lead_approaches(id,lead_id,user_id,template_id,template_name,template_group,message,phone,niche,product_id,interaction_id)
 values(p_id,l.id,auth.uid(),t.id,t.name,t.niche_group,p_message,p_phone,l.niche,l.product_id,interaction);
 perform set_config('crm.approach_reason','Primeira abordagem enviada via WhatsApp.',true);
 update public.leads set first_contact_at=coalesce(first_contact_at,now()),stage=case when stage='NOVO LEAD' then 'CONTATADO'::public.lead_stage else stage end where id=l.id;
 perform set_config('crm.approach_reason','',true);
 return p_id;
end; $$;

create function public.schedule_approach_followup(p_lead uuid,p_at timestamptz,p_expected_action text,p_expected_at timestamptz) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_at is null or p_at <= now() then raise exception 'Choose a future date'; end if;
 update public.leads set next_action='1º follow-up WhatsApp',next_action_at=p_at
 where id=p_lead and next_action is not distinct from p_expected_action and next_action_at is not distinct from p_expected_at;
 return found;
end; $$;

create function public.set_template_default(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare t public.message_templates;
begin
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select * into t from public.message_templates where id=p_id and is_active;
 if not found then raise exception 'Template unavailable'; end if;
 update public.message_templates set is_default=false where niche_group=t.niche_group and is_default;
 update public.message_templates set is_default=true where id=p_id;
end; $$;
revoke all on function public.touch_message_template(),public.confirm_approach(uuid,uuid,uuid,text,text),public.schedule_approach_followup(uuid,timestamptz,text,timestamptz),public.set_template_default(uuid) from public;
grant execute on function public.confirm_approach(uuid,uuid,uuid,text,text),public.schedule_approach_followup(uuid,timestamptz,text,timestamptz),public.set_template_default(uuid) to authenticated;

-- Editable copies belong exclusively to each user (including administrators).
create function public.seed_message_templates(p_user uuid) returns void language sql security definer set search_path='' as $$
 insert into public.message_templates(user_id,name,niche_group,message,is_default) values
(p_user,'SAÚDE — SEM SITE','Saúde / Estética','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} e dei uma olhada no trabalho de vocês.

Eu desenvolvo páginas e sites para empresas e profissionais que querem apresentar melhor seus serviços e facilitar o contato de novos clientes.

Vi que hoje vocês não têm um site próprio.

Vocês usam principalmente Instagram e WhatsApp para apresentar os serviços?',false),
(p_user,'SAÚDE — TEM SITE','Saúde / Estética','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} e dei uma olhada na presença digital de vocês.

Eu trabalho com desenvolvimento de páginas focadas em apresentação e conversão e percebi algumas oportunidades principalmente na forma de conduzir quem se interessa pelos serviços até o WhatsApp ou agendamento.

Hoje o site de vocês realmente gera novos contatos ou funciona mais como apresentação?',false),
(p_user,'SAÚDE — LANDING PAGE','Saúde / Estética','Oi, {{responsavel}}. Tudo bem?

Conheci o trabalho da {{empresa}} e percebi que vocês divulgam os serviços pelas redes sociais.

Eu desenvolvo páginas específicas para transformar esse interesse em contato ou agendamento.

Hoje quando alguém se interessa por um procedimento ou serviço de vocês, essa pessoa vai direto do Instagram para o WhatsApp?',false),
(p_user,'TÉCNICO — SEM SITE','Serviços Técnicos','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} e dei uma olhada no trabalho de vocês.

Eu desenvolvo sites para empresas de serviços e percebi que hoje vocês ainda não têm um site próprio.

Quando um cliente pede mais informações sobre a empresa, vocês normalmente apresentam os serviços pelo WhatsApp ou Instagram?',false),
(p_user,'TÉCNICO — SITE EXISTENTE','Serviços Técnicos','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} e dei uma olhada no site de vocês.

Eu trabalho com desenvolvimento de sites e identifiquei algumas oportunidades principalmente na apresentação dos serviços, autoridade da empresa e facilidade para solicitar orçamento.

Hoje vocês recebem pedidos de orçamento através do site ou a maior parte ainda chega por indicação e WhatsApp?',false),
(p_user,'TÉCNICO — AUTORIDADE','Serviços Técnicos','Oi, {{responsavel}}. Tudo bem?

Conheci a {{empresa}} e vi que vocês trabalham com {{nicho}}.

Nesse tipo de serviço, percebo que muitos clientes recebem uma indicação e depois pesquisam a empresa antes de entrar em contato.

Eu desenvolvo sites justamente para transformar essa pesquisa em uma apresentação profissional da empresa.

Hoje, quando alguém recebe uma indicação de vocês, para onde vocês direcionam essa pessoa para conhecer melhor o trabalho?',false),
(p_user,'LOGÍSTICA — PROCESSOS','Transporte / Logística','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} pesquisando empresas de transporte e logística aqui em SP.

Eu trabalho com desenvolvimento de sistemas e automações para processos operacionais.

Tenho conversado com empresas que ainda controlam parte da operação usando planilhas, WhatsApp e controles separados.

Na {{empresa}}, vocês ainda têm algum processo importante sendo controlado dessa forma?',false),
(p_user,'LOGÍSTICA — PLANILHAS','Transporte / Logística','Oi, {{responsavel}}. Tudo bem?

Conheci a {{empresa}} e estou entrando em contato porque trabalho com desenvolvimento de sistemas para empresas que possuem processos operacionais muito dependentes de planilhas.

Não sei se é o caso de vocês, por isso queria entender:

Hoje existe algum processo na operação que depende bastante de Excel, WhatsApp ou lançamento manual de informações?',false),
(p_user,'LOGÍSTICA — RETRABALHO','Transporte / Logística','Oi, {{responsavel}}. Tudo bem?

Eu trabalho com desenvolvimento de sistemas e automações e encontrei a {{empresa}} pesquisando operações de transporte e logística.

Uma situação que encontro bastante nesse segmento é a equipe precisar lançar a mesma informação em planilha, sistema e WhatsApp.

Vocês têm algum processo hoje que gera esse tipo de retrabalho?',false),
(p_user,'Indicação — Apresentação','Indicação','Oi, {{responsavel}}. Tudo bem?

O {{indicado_por}} comentou comigo sobre a {{empresa}} e me passou seu contato.

Eu trabalho com desenvolvimento de soluções digitais para empresas e dei uma olhada no trabalho de vocês.

Hoje vocês estão buscando melhorar alguma coisa na parte de site, atendimento ou processos internos?',false),
(p_user,'Geral — Primeiro contato','Geral','Oi, {{responsavel}}. Tudo bem?

Encontrei a {{empresa}} e estou entrando em contato para entender melhor o negócio de vocês. Trabalho com sites e automações para empresas.

Hoje, o que vocês mais gostariam de melhorar: a chegada de novos contatos, o atendimento ou algum processo interno?',false);
$$;
create function public.seed_profile_templates() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.seed_message_templates(new.id); return new; end; $$;
create trigger profile_templates after insert on public.profiles for each row execute function public.seed_profile_templates();
select public.seed_message_templates(id) from public.profiles;
revoke all on function public.seed_message_templates(uuid),public.seed_profile_templates() from public;

COMMIT;
