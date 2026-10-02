-- Meta Diária Inteligente: 30 contatos/dia, 5 tentativas totais e intervalo mínimo de 3 dias úteis.
-- A função de dias úteis é centralizada para permitir futura inclusão de feriados.

create or replace function public.crm_add_business_days(p_day date, p_days integer) returns date
language plpgsql immutable set search_path='' as $$
declare d date:=p_day; added integer:=0;
begin
 if p_days<0 then raise exception 'Business day amount must be non-negative'; end if;
 while added<p_days loop
  d:=d+1;
  if extract(isodow from d) between 1 and 5 then added:=added+1; end if;
 end loop;
 return d;
end; $$;

-- Recupera leads antigos que possuem histórico de abordagem, mas ainda não têm uma régua durável.
insert into public.lead_cadences(lead_id,user_id,template_id,campaign_name,status,current_step,total_followups,started_at,last_sent_at,next_followup_at)
select a.lead_id,
       (array_agg(a.user_id order by a.confirmed_at desc))[1],
       (array_agg(a.template_id order by a.confirmed_at desc))[1],
       (array_agg(a.template_name order by a.confirmed_at desc))[1],
       case when count(*)>=5 then 'COMPLETED' else 'IN_PROGRESS' end,
       least(greatest(count(*)-1,0),4)::integer,
       4,
       min(a.confirmed_at),
       max(a.confirmed_at),
       case when count(*)>=5 then null else (public.crm_add_business_days((max(a.confirmed_at) at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '09:00') at time zone 'America/Sao_Paulo' end
from public.lead_approaches a
join public.leads l on l.id=a.lead_id
where l.stage='CONTATADO' and a.template_id is not null and not exists(select 1 from public.lead_cadences c where c.lead_id=a.lead_id)
group by a.lead_id
on conflict(lead_id) do nothing;

-- A régua passa a ter 5 tentativas TOTAIS: primeiro contato + 4 follow-ups.
update public.lead_cadences
set total_followups=4,
    current_step=least(current_step,4),
    status=case when current_step>=4 then 'COMPLETED' else status end,
    next_followup_at=case when current_step>=4 then null else next_followup_at end,
    updated_at=now();

-- Backlog: todo contato em andamento ganha automaticamente sua primeira data elegível.
update public.lead_cadences c
set next_followup_at=(public.crm_add_business_days((c.last_sent_at at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '09:00') at time zone 'America/Sao_Paulo',
    updated_at=now()
from public.leads l
where l.id=c.lead_id and l.stage='CONTATADO' and c.status='IN_PROGRESS' and c.current_step<4 and c.next_followup_at is null;

-- Corrige primeiro contato, inicia a régua e agenda automaticamente +3 dias úteis.
create or replace function public.confirm_approach(p_id uuid,p_lead uuid,p_template uuid,p_message text,p_phone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare l public.leads; t public.message_templates; previous public.lead_approaches; interaction uuid; normalized_phone text; eligible timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or (l.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Lead unavailable'; end if;
 select * into previous from public.lead_approaches where id=p_id;
 if found then return previous.id; end if;
 select * into t from public.message_templates where id=p_template and user_id=auth.uid() and is_active;
 if not found then raise exception 'Template unavailable'; end if;
 if p_message is null or length(trim(p_message)) not between 1 and 8000 or p_message ~ '\{\{[^}]*\}\}' then raise exception 'Invalid message'; end if;
 normalized_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if normalized_phone !~ '^[1-9][0-9]{9,14}$' then raise exception 'Invalid phone'; end if;
 insert into public.lead_interactions(lead_id,actor_id,type,description) values(l.id,auth.uid(),'WhatsApp','Primeiro contato · Tentativa 1/5') returning id into interaction;
 insert into public.lead_approaches(id,lead_id,user_id,template_id,template_name,template_group,message,phone,niche,product_id,interaction_id)
 values(p_id,l.id,auth.uid(),t.id,t.name,t.niche_group,p_message,normalized_phone,l.niche,l.product_id,interaction);
 eligible:=(public.crm_add_business_days((now() at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '09:00') at time zone 'America/Sao_Paulo';
 insert into public.lead_cadences(lead_id,user_id,template_id,campaign_name,status,current_step,total_followups,started_at,last_sent_at,next_followup_at)
 values(l.id,auth.uid(),t.id,t.name,'IN_PROGRESS',0,4,now(),now(),eligible)
 on conflict(lead_id) do update set user_id=excluded.user_id,template_id=excluded.template_id,campaign_name=excluded.campaign_name,status='IN_PROGRESS',current_step=0,total_followups=4,started_at=now(),last_sent_at=now(),next_followup_at=eligible,updated_at=now();
 perform set_config('crm.approach_reason','Primeira abordagem enviada via WhatsApp.',true);
 update public.leads set first_contact_at=coalesce(first_contact_at,now()),stage=case when stage='NOVO LEAD' then 'CONTATADO'::public.lead_stage else stage end,next_action='Follow-up 1 WhatsApp',next_action_at=eligible where id=l.id;
 perform set_config('crm.approach_reason','',true);
 return p_id;
end; $$;

create or replace function public.confirm_cadence_followup(p_id uuid,p_lead uuid,p_message text,p_phone text) returns integer
language plpgsql security definer set search_path='' as $$
declare l public.leads; c public.lead_cadences; interaction uuid; next_step integer; existing public.lead_approaches; normalized_phone text; eligible timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or l.stage<>'CONTATADO' then raise exception 'Lead unavailable for follow-up'; end if;
 if l.owner_id<>auth.uid() and not public.is_admin() then raise exception 'Lead unavailable'; end if;
 select * into c from public.lead_cadences where lead_id=p_lead for update;
 if not found or c.status<>'IN_PROGRESS' then raise exception 'Cadence unavailable'; end if;
 select * into existing from public.lead_approaches where id=p_id;
 if found then return c.current_step; end if;
 next_step:=c.current_step+1;
 if next_step>4 then raise exception 'Cadence completed'; end if;
 if c.next_followup_at is not null and now()<c.next_followup_at then raise exception 'Follow-up is not eligible yet'; end if;
 if p_message is null or length(trim(p_message)) not between 1 and 8000 or p_message ~ '\{\{[^}]*\}\}' then raise exception 'Invalid message'; end if;
 normalized_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if normalized_phone !~ '^[1-9][0-9]{9,14}$' then raise exception 'Invalid phone'; end if;
 insert into public.lead_interactions(lead_id,actor_id,type,description) values(l.id,auth.uid(),'Follow-up','Follow-up '||next_step||' · Tentativa '||(next_step+1)||'/5 · '||c.campaign_name) returning id into interaction;
 insert into public.lead_approaches(id,lead_id,user_id,template_id,template_name,template_group,message,phone,niche,product_id,interaction_id)
 select p_id,l.id,auth.uid(),t.id,t.name,t.niche_group,p_message,normalized_phone,l.niche,l.product_id,interaction from public.message_templates t where t.id=c.template_id;
 if next_step>=4 then
  update public.lead_cadences set current_step=4,total_followups=4,last_sent_at=now(),next_followup_at=null,status='COMPLETED',updated_at=now() where lead_id=p_lead;
  update public.leads set next_action='',next_action_at=null where id=p_lead;
 else
  eligible:=(public.crm_add_business_days((now() at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '09:00') at time zone 'America/Sao_Paulo';
  update public.lead_cadences set current_step=next_step,total_followups=4,last_sent_at=now(),next_followup_at=eligible,status='IN_PROGRESS',updated_at=now() where lead_id=p_lead;
  update public.leads set next_action='Follow-up '||(next_step+1)||' WhatsApp',next_action_at=eligible where id=p_lead;
 end if;
 return next_step;
end; $$;

-- Reagendamento manual continua possível, mas nunca antes dos 3 dias úteis mínimos.
create or replace function public.schedule_cadence_followup(p_lead uuid,p_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.lead_cadences; n integer; minimum_at timestamptz;
begin
 select * into c from public.lead_cadences where lead_id=p_lead for update;
 if not found or c.status<>'IN_PROGRESS' or c.current_step>=4 then return false; end if;
 minimum_at:=(public.crm_add_business_days((c.last_sent_at at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '00:00') at time zone 'America/Sao_Paulo';
 if p_at is null or p_at<minimum_at then raise exception 'Minimum interval is 3 business days'; end if;
 n:=c.current_step+1;
 update public.lead_cadences set next_followup_at=p_at,updated_at=now() where lead_id=p_lead;
 update public.leads set next_action='Follow-up '||n||' WhatsApp',next_action_at=p_at where id=p_lead and stage='CONTATADO';
 return found;
end; $$;

-- Sair de CONTATADO pausa a prospecção. Voltar para CONTATADO reativa a mesma régua,
-- preservando campanha, histórico e tentativa. Régua concluída nunca é reaberta automaticamente.
create or replace function public.sync_cadence_stage() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.lead_cadences; eligible timestamptz;
begin
 if old.stage='CONTATADO' and new.stage is distinct from old.stage then
  update public.lead_cadences set status=case when new.stage='RESPONDEU' then 'RESPONDED' else 'PAUSED' end,next_followup_at=null,updated_at=now() where lead_id=new.id and status='IN_PROGRESS';
  new.next_action:=''; new.next_action_at:=null;
 elsif new.stage='CONTATADO' and old.stage is distinct from new.stage then
  select * into c from public.lead_cadences where lead_id=new.id;
  if found and c.status in ('RESPONDED','PAUSED') and c.current_step<4 then
   eligible:=(public.crm_add_business_days((c.last_sent_at at time zone 'America/Sao_Paulo')::date,3)::timestamp + time '09:00') at time zone 'America/Sao_Paulo';
   update public.lead_cadences set status='IN_PROGRESS',total_followups=4,next_followup_at=greatest(eligible,now()),updated_at=now() where lead_id=new.id;
   new.next_action:='Follow-up '||(c.current_step+1)||' WhatsApp'; new.next_action_at:=greatest(eligible,now());
  end if;
 end if;
 return new;
end; $$;

-- Exponha o último envio para a UI e para cálculos futuros sem duplicar regra.
drop view if exists public.lead_listing;
create view public.lead_listing with (security_invoker=true) as
select l.*,p.name as product_name,lower(l.company) as company_sort,lower(l.contact_name) as contact_sort,lower(l.creator_name) as creator_sort,lower(p.name) as product_sort,
 c.status as cadence_status,c.current_step as cadence_step,c.total_followups as cadence_total,c.campaign_name as cadence_campaign,c.next_followup_at as cadence_next_at,c.last_sent_at as cadence_last_sent_at
from public.leads l left join public.products p on p.id=l.product_id left join public.lead_cadences c on c.lead_id=l.id;
revoke all on public.lead_listing from anon; grant select on public.lead_listing to authenticated;

revoke all on function public.crm_add_business_days(date,integer) from public;
grant execute on function public.crm_add_business_days(date,integer) to authenticated;
