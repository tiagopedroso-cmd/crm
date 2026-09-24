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

