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
