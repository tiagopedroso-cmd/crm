-- Instalação inicial: somente em banco ainda não instalado.
begin;
-- All business dates use America/Sao_Paulo; instants are timestamptz.
create type public.lead_stage as enum ('NOVO LEAD','CONTATADO','RESPONDEU','SONDAGEM','OPORTUNIDADE','PROPOSTA','NEGOCIAÇÃO','FECHADO','PÓS-VENDA','PERDIDO','RETOMAR FUTURAMENTE');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', role text not null default 'VENDEDOR' check(role in ('ADMIN','VENDEDOR')),
 created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role = 'ADMIN');
$$;
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 100),
 suggested_value numeric(14,2) not null default 0 check(suggested_value >= 0), pricing text not null default 'fixed' check(pricing in ('fixed','from','variable')),
 active boolean not null default true
);
insert into public.products(name,suggested_value,pricing) values ('Landing Page',540,'fixed'),('Site',1500,'fixed'),('Sistema',5000,'from'),('Automação',0,'variable'),('Outro',0,'variable');
create table public.objections(id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 150));
insert into public.objections(name) select unnest(array['Vou pensar','Agora não','Já tenho site','Vou falar com meu sócio','Preço','Sem prioridade','Já possui fornecedor','Não respondeu','Outro']);
create table public.sales_goals (
 owner_id uuid primary key references public.profiles(id) on delete cascade,
 daily_leads integer not null default 20 check(daily_leads > 0), weekly_leads integer not null default 100 check(weekly_leads > 0),
 weekly_revenue numeric(14,2) not null default 4620 check(weekly_revenue > 0), monthly_revenue numeric(14,2) not null default 19404 check(monthly_revenue > 0),
 monthly_system_revenue numeric(14,2) not null default 5000 check(monthly_system_revenue >= 0),
 weekly_contacts integer not null default 50 check(weekly_contacts > 0), weekly_responses integer not null default 35 check(weekly_responses > 0),
 weekly_discoveries integer not null default 20 check(weekly_discoveries > 0), weekly_opportunities integer not null default 15 check(weekly_opportunities > 0),
 weekly_proposals integer not null default 10 check(weekly_proposals > 0), weekly_negotiations integer not null default 7 check(weekly_negotiations > 0), weekly_closings integer not null default 5 check(weekly_closings > 0)
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));
 insert into public.sales_goals(owner_id) values(new.id);
 return new;
end; $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.sales_goals(owner_id) select id from public.profiles on conflict do nothing;
create table public.leads (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id),
 company text not null check(length(trim(company)) between 1 and 200), contact_name text not null default '', whatsapp text not null default '', email text not null default '',
 instagram text not null default '', website text not null default '', niche text not null default '', city text not null default '', state text not null default '' check(state = '' or state ~ '^[A-Z]{2}$'),
 source text not null default 'Prospecção manual', channel text not null default 'WhatsApp', product_id uuid references public.products(id),
 potential_value numeric(14,2) not null default 0 check(potential_value >= 0), stage public.lead_stage not null default 'NOVO LEAD',
 inserted_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
 first_contact_at timestamptz, last_interaction_at timestamptz, next_action text not null default '', next_action_at timestamptz,
 pain text not null default '', objective text not null default '', discovery_notes text not null default '', urgency text not null default '', decision_maker text not null default '',
 budget numeric(14,2) check(budget >= 0), objection_id uuid references public.objections(id), loss_reason text not null default '',
 closed_on date, closed_value numeric(14,2) check(closed_value >= 0), payment_method text not null default '', closing_notes text not null default '', notes text not null default '',
 is_demo boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(stage <> 'PERDIDO' or length(trim(loss_reason)) > 0),
 check(stage not in ('FECHADO','PÓS-VENDA') or (closed_on is not null and closed_value is not null and length(trim(payment_method)) > 0)),
 check((next_action_at is null and next_action = '') or (next_action_at is not null and length(trim(next_action)) > 0)),
 check(website = '' or website ~* '^https?://'), check(instagram = '' or instagram ~* '^https://'),
 check(email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
create index leads_owner_stage on public.leads(owner_id,stage);
create index leads_action on public.leads(owner_id,next_action_at) where next_action_at is not null;
create index leads_inserted on public.leads(owner_id,inserted_on desc,id);
create index leads_closed on public.leads(owner_id,closed_on) where closed_on is not null;
create index leads_product on public.leads(product_id);
create index leads_objection on public.leads(objection_id);
create index leads_search on public.leads using gin(to_tsvector('simple', company || ' ' || contact_name || ' ' || whatsapp || ' ' || niche));
create table public.pipeline_history (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
 from_stage public.lead_stage, to_stage public.lead_stage not null, actor_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index history_lead_date on public.pipeline_history(lead_id,created_at);
create index history_stage_date on public.pipeline_history(to_stage,created_at);
create table public.lead_interactions (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
 actor_id uuid not null default auth.uid() references public.profiles(id), occurred_at timestamptz not null default now(),
 type text not null check(type in ('WhatsApp','Ligação','Instagram','E-mail','Reunião','Proposta','Follow-up','Observação','Outro')),
 description text not null check(length(trim(description)) between 1 and 10000), created_at timestamptz not null default now()
);
create index interactions_lead_date on public.lead_interactions(lead_id,occurred_at desc);
create table public.proposals (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), amount numeric(14,2) not null check(amount >= 0),
 sent_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
 status text not null default 'Aguardando' check(status in ('Aguardando','Aceita','Recusada')), url text not null default '' check(url = '' or url ~* '^https://'), notes text not null default '', created_at timestamptz not null default now()
);
create index proposals_lead on public.proposals(lead_id);
create table public.after_sales (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 project_started boolean not null default false, project_delivered boolean not null default false, satisfied boolean not null default false,
 testimonial_requested boolean not null default false, testimonial_received boolean not null default false, portfolio_authorized boolean not null default false,
 referral_requested boolean not null default false, referral_received boolean not null default false, maintenance_offered boolean not null default false, upsell_identified boolean not null default false
);
create function public.guard_lead() returns trigger language plpgsql set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  if old.first_contact_at is not null then new.first_contact_at := old.first_contact_at; end if;
  if old.stage = 'NOVO LEAD' and new.stage = 'CONTATADO' and new.first_contact_at is null then new.first_contact_at := now(); end if;
  new.created_at := old.created_at;
 end if;
 new.updated_at := now();
 return new;
end; $$;
create trigger leads_guard before insert or update on public.leads for each row execute function public.guard_lead();
create function public.log_stage() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if TG_OP = 'INSERT' then
  insert into public.pipeline_history(lead_id,to_stage,actor_id) values(new.id,new.stage,auth.uid());
 elsif old.stage is distinct from new.stage then
  insert into public.pipeline_history(lead_id,from_stage,to_stage,actor_id) values(new.id,old.stage,new.stage,auth.uid());
 end if;
 return new;
end; $$;
create trigger leads_history after insert or update on public.leads for each row execute function public.log_stage();
create function public.record_interaction() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.leads set last_interaction_at = greatest(last_interaction_at,new.occurred_at) where id = new.lead_id;
 return new;
end; $$;
create trigger interaction_added after insert on public.lead_interactions for each row execute function public.record_interaction();
-- Immutable audit history and responsibility. No UPDATE grants on interaction/history.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.objections enable row level security;
alter table public.sales_goals enable row level security;
alter table public.leads enable row level security;
alter table public.pipeline_history enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.proposals enable row level security;
alter table public.after_sales enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id = (select auth.uid()) or (select public.is_admin()));
create policy products_read on public.products for select to authenticated using(true);
create policy products_admin on public.products for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy objections_read on public.objections for select to authenticated using(true);
create policy objections_admin on public.objections for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy goals_owner on public.sales_goals for all to authenticated using(owner_id = (select auth.uid()) or (select public.is_admin())) with check(owner_id = (select auth.uid()) or (select public.is_admin()));
create policy leads_owner on public.leads for all to authenticated using(owner_id = (select auth.uid()) or (select public.is_admin())) with check(owner_id = (select auth.uid()) or (select public.is_admin()));
create policy history_read on public.pipeline_history for select to authenticated using(exists(select 1 from public.leads l where l.id = lead_id));
create policy interactions_read on public.lead_interactions for select to authenticated using(exists(select 1 from public.leads l where l.id = lead_id));
create policy interactions_insert on public.lead_interactions for insert to authenticated with check(actor_id = (select auth.uid()) and exists(select 1 from public.leads l where l.id = lead_id));
create policy proposals_owner on public.proposals for all to authenticated using(exists(select 1 from public.leads l where l.id = lead_id)) with check(exists(select 1 from public.leads l where l.id = lead_id));
create policy after_sales_owner on public.after_sales for all to authenticated using(exists(select 1 from public.leads l where l.id = lead_id)) with check(exists(select 1 from public.leads l where l.id = lead_id));
revoke all on public.profiles,public.products,public.objections,public.sales_goals,public.leads,public.pipeline_history,public.lead_interactions,public.proposals,public.after_sales from anon,authenticated;
grant select on public.profiles,public.products,public.objections,public.sales_goals,public.leads,public.pipeline_history,public.lead_interactions,public.proposals,public.after_sales to authenticated;
grant insert,update,delete on public.products,public.objections,public.sales_goals,public.leads,public.proposals,public.after_sales to authenticated;
grant insert on public.lead_interactions to authenticated;
revoke all on function public.is_admin(),public.create_profile(),public.guard_lead(),public.log_stage(),public.record_interaction() from public;
grant execute on function public.is_admin() to authenticated;

-- SECURITY INVOKER: every aggregate is constrained by the caller's RLS.
create function public.crm_metrics(p_start date, p_end date, p_owner uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
with dates as (
 select (now() at time zone 'America/Sao_Paulo')::date today,
 date_trunc('week',now() at time zone 'America/Sao_Paulo')::date week,
 date_trunc('month',now() at time zone 'America/Sao_Paulo')::date month_start
), base as (select * from public.leads where p_owner is null or owner_id = p_owner),
cohort as (select * from base where inserted_on between p_start and p_end),
stage_events as (select h.* from public.pipeline_history h join base l on l.id=h.lead_id where (h.created_at at time zone 'America/Sao_Paulo')::date between p_start and p_end),
funnel as (
 select s.stage, count(distinct h.lead_id) total from unnest(enum_range(null::public.lead_stage)) with ordinality s(stage,n)
 left join public.pipeline_history h on h.to_stage=s.stage and h.lead_id in(select id from cohort) where s.n <= 8 group by s.stage,s.n order by s.n
), events as (select to_stage stage,count(distinct lead_id) total from stage_events group by to_stage),
won as (select * from base where stage in('FECHADO','PÓS-VENDA') and closed_on between p_start and p_end),
lost as (select * from base where stage='PERDIDO' and id in(select lead_id from stage_events where to_stage='PERDIDO'))
select jsonb_build_object(
 'leads',(select count(*) from cohort), 'new_today',(select count(*) from base,dates where inserted_on=today),
 'new_week',(select count(*) from base,dates where inserted_on between week and week+6), 'new_month',(select count(*) from base,dates where inserted_on between month_start and (month_start+interval '1 month'-interval '1 day')::date),
 'opportunities',(select count(*) from base where stage in('OPORTUNIDADE','PROPOSTA','NEGOCIAÇÃO')),
 'negotiations',(select count(*) from base where stage='NEGOCIAÇÃO'),
 'proposals',(select count(distinct lead_id) from stage_events where to_stage='PROPOSTA'),
 'closings',(select count(*) from won),'revenue',(select coalesce(sum(closed_value),0) from won),
 'pipeline',(select coalesce(sum(potential_value),0) from base where stage not in('FECHADO','PÓS-VENDA','PERDIDO')),
 'ticket',(select coalesce(avg(closed_value),0) from won),
 'conversion',(select coalesce(round(100.0*count(*) filter(where stage in('FECHADO','PÓS-VENDA'))/nullif(count(*),0),1),0) from cohort),
 'weekly_revenue',(select coalesce(sum(closed_value),0) from base,dates where stage in('FECHADO','PÓS-VENDA') and closed_on between week and week+6),
 'monthly_revenue',(select coalesce(sum(closed_value),0) from base,dates where stage in('FECHADO','PÓS-VENDA') and closed_on between month_start and (month_start+interval '1 month'-interval '1 day')::date),
 'due_today',(select count(*) from base,dates where stage not in('FECHADO','PÓS-VENDA','PERDIDO') and (next_action_at at time zone 'America/Sao_Paulo')::date=today),
 'overdue',(select count(*) from base where stage not in('FECHADO','PÓS-VENDA','PERDIDO') and next_action_at<now()),
 'followups_today',(select count(*) from base,dates where stage not in('FECHADO','PÓS-VENDA','PERDIDO') and (next_action_at at time zone 'America/Sao_Paulo')::date=today and next_action ilike '%follow-up%'),
 'followups_overdue',(select count(*) from base where stage not in('FECHADO','PÓS-VENDA','PERDIDO') and next_action_at<now() and next_action ilike '%follow-up%'),
 'missing_action',(select count(*) from base where stage not in('FECHADO','PÓS-VENDA','PERDIDO') and next_action_at is null),
 'meetings',(select count(*) from base,dates where (next_action_at at time zone 'America/Sao_Paulo')::date=today and next_action ilike '%reuni%'),
 'awaiting_proposals',(select count(*) from public.proposals p join base l on l.id=p.lead_id where p.status='Aguardando' and l.stage not in('FECHADO','PÓS-VENDA','PERDIDO')),
 'funnel',(select coalesce(jsonb_agg(funnel),'[]') from funnel), 'events',(select coalesce(jsonb_agg(events),'[]') from events),
 'sources',(select coalesce(jsonb_agg(t),'[]') from(select source label,count(*) total from cohort group by source order by count(*) desc)t),
 'products',(select coalesce(jsonb_agg(t),'[]') from(select coalesce(p.name,'Sem produto') label,count(*) total from cohort l left join public.products p on p.id=l.product_id group by p.name order by count(*) desc)t),
 'niches',(select coalesce(jsonb_agg(t),'[]') from(select coalesce(nullif(niche,''),'Não informado') label,count(*) total from cohort group by niche order by count(*) desc limit 20)t),
 'objections',(select coalesce(jsonb_agg(t),'[]') from(select o.name label,count(*) total from cohort l join public.objections o on o.id=l.objection_id group by o.name order by count(*) desc)t),
 'losses',(select count(*) from lost),
 'loss_reasons',(select coalesce(jsonb_agg(t),'[]') from(select loss_reason label,count(*) total from lost group by loss_reason order by count(*) desc)t),
 'loss_products',(select coalesce(jsonb_agg(t),'[]') from(select coalesce(p.name,'Sem produto') label,count(*) total from lost l left join public.products p on p.id=l.product_id group by p.name order by count(*) desc)t),
 'loss_niches',(select coalesce(jsonb_agg(t),'[]') from(select coalesce(nullif(niche,''),'Não informado') label,count(*) total from lost group by niche order by count(*) desc)t)
); $$;
revoke all on function public.crm_metrics(date,date,uuid) from public;
grant execute on function public.crm_metrics(date,date,uuid) to authenticated;


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

-- Users may change display names, never their own authorization role.
grant update(display_name) on public.profiles to authenticated;
create policy profile_names_update on public.profiles for update to authenticated
 using(id=(select auth.uid()) or (select public.is_admin()))
 with check(id=(select auth.uid()) or (select public.is_admin()));
alter table public.profiles add constraint profile_display_name_length check(length(display_name)<=100);

-- Upgrade only the known seed greeting. Preserve custom text and sent snapshots.
create function public.add_sender_to_seed_templates(p_user uuid) returns void
language sql security definer set search_path='' as $$
 update public.message_templates
 set message=replace(message,'Oi, {{responsavel}}. Tudo bem?',E'Oi, {{responsavel}}. Tudo bem?\n\nMe chamo {{usuario}}, da InovaLogix.')
 where user_id=p_user and category='Primeira abordagem'
 and name in ('SAÚDE — SEM SITE','SAÚDE — TEM SITE','SAÚDE — LANDING PAGE','TÉCNICO — SEM SITE','TÉCNICO — SITE EXISTENTE','TÉCNICO — AUTORIDADE','LOGÍSTICA — PROCESSOS','LOGÍSTICA — PLANILHAS','LOGÍSTICA — RETRABALHO','Indicação — Apresentação','Geral — Primeiro contato')
 and message like 'Oi, {{responsavel}}. Tudo bem?%' and message not like '%{{usuario}}%';
$$;
create or replace function public.seed_profile_templates() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.seed_message_templates(new.id);
 perform public.add_sender_to_seed_templates(new.id);
 return new;
end; $$;
select public.add_sender_to_seed_templates(id) from public.profiles;
revoke all on function public.add_sender_to_seed_templates(uuid),public.seed_profile_templates() from public;

create table public.completed_actions (
 id uuid primary key,
 lead_id uuid not null references public.leads(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),
 action text not null check(length(trim(action))>0),
 scheduled_at timestamptz not null,
 completed_on date not null,
 next_action text not null default '', next_action_at timestamptz,
 interaction_id uuid not null unique references public.lead_interactions(id) on delete cascade,
 recorded_at timestamptz not null default now()
);
create index completed_actions_lead on public.completed_actions(lead_id,completed_on desc);
alter table public.completed_actions enable row level security;
create policy completed_actions_read on public.completed_actions for select to authenticated
 using(exists(select 1 from public.leads l where l.id=lead_id));
revoke all on public.completed_actions from anon,authenticated;
grant select on public.completed_actions to authenticated;

create function public.complete_pending_action(p_id uuid,p_lead uuid,p_expected_action text,p_expected_at timestamptz,p_completed_on date,p_next_action text default '',p_next_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.leads; prior public.completed_actions; interaction uuid; next_text text:=trim(coalesce(p_next_action,'')); completed_instant timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or (l.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Lead unavailable'; end if;
 select * into prior from public.completed_actions where id=p_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.lead_id<>p_lead then raise exception 'Invalid completion'; end if;
  return prior.id;
 end if;
 if l.next_action_at is null or trim(l.next_action)='' or l.next_action is distinct from p_expected_action or l.next_action_at is distinct from p_expected_at then
  raise exception 'ACTION_CHANGED';
 end if;
 if p_completed_on is null or p_completed_on>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Invalid completion date'; end if;
 if (next_text='' and p_next_at is not null) or (next_text<>'' and p_next_at is null) or length(next_text)>10000 then raise exception 'Invalid next action'; end if;
 completed_instant:=case when p_completed_on=(now() at time zone 'America/Sao_Paulo')::date then now() else (p_completed_on+time '12:00') at time zone 'America/Sao_Paulo' end;
 insert into public.lead_interactions(lead_id,actor_id,type,description,occurred_at)
 values(l.id,auth.uid(),'Outro','Ação concluída: '||l.next_action,completed_instant) returning id into interaction;
 insert into public.completed_actions(id,lead_id,actor_id,action,scheduled_at,completed_on,next_action,next_action_at,interaction_id)
 values(p_id,l.id,auth.uid(),l.next_action,l.next_action_at,p_completed_on,next_text,p_next_at,interaction);
 update public.leads set next_action=next_text,next_action_at=p_next_at where id=l.id;
 return p_id;
end; $$;
revoke all on function public.complete_pending_action(uuid,uuid,text,timestamptz,date,text,timestamptz) from public;
grant execute on function public.complete_pending_action(uuid,uuid,text,timestamptz,date,text,timestamptz) to authenticated;

commit;
