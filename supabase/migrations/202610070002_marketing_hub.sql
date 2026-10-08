-- Marketing Hub: planejamento editorial, criativos e resultados.
create table if not exists public.marketing_campaigns (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references public.profiles(id),
 name text not null check(length(trim(name)) between 1 and 200), objective text not null default '', start_date date not null, end_date date not null,
 channels text[] not null default '{}', budget numeric(14,2) not null default 0 check(budget>=0), audience text not null default '', goals text not null default '',
 status text not null default 'PLANEJAMENTO' check(status in ('PLANEJAMENTO','ATIVA','CONCLUIDA','PAUSADA')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_date>=start_date)
);
create table if not exists public.marketing_contents (
 id uuid primary key default gen_random_uuid(), campaign_id uuid references public.marketing_campaigns(id) on delete set null,
 owner_id uuid not null default auth.uid() references public.profiles(id), responsible_id uuid not null default auth.uid() references public.profiles(id),
 title text not null check(length(trim(title)) between 1 and 240), theme text not null default '', pillar text not null default '', objective text not null default '', format text not null default 'Arte estática',
 channels text[] not null default '{}', caption text not null default '', creative_text text not null default '', cta text not null default '', hashtags text not null default '',
 scheduled_at timestamptz, published_at timestamptz, publication_url text not null default '',
 status text not null default 'IDEIA' check(status in ('IDEIA','EM_PRODUCAO','REVISAO','APROVADO','PROGRAMADO','PUBLICADO')),
 notes text not null default '', feedback text not null default '', learnings text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.marketing_creatives (
 id uuid primary key default gen_random_uuid(), content_id uuid not null references public.marketing_contents(id) on delete cascade,
 owner_id uuid not null default auth.uid() references public.profiles(id), name text not null, asset_url text not null,
 version integer not null default 1 check(version>0), approved boolean not null default false, notes text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.marketing_metrics (
 id uuid primary key default gen_random_uuid(), content_id uuid not null references public.marketing_contents(id) on delete cascade,
 owner_id uuid not null default auth.uid() references public.profiles(id), reach integer not null default 0 check(reach>=0), impressions integer not null default 0 check(impressions>=0),
 interactions integer not null default 0 check(interactions>=0), comments integer not null default 0 check(comments>=0), shares integer not null default 0 check(shares>=0), saves integer not null default 0 check(saves>=0),
 clicks integer not null default 0 check(clicks>=0), contacts integer not null default 0 check(contacts>=0), leads integer not null default 0 check(leads>=0),
 measured_on date not null default (now() at time zone 'America/Sao_Paulo')::date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(content_id, measured_on)
);
create index if not exists marketing_campaigns_owner_dates on public.marketing_campaigns(owner_id,start_date,end_date);
create index if not exists marketing_contents_schedule on public.marketing_contents(owner_id,scheduled_at);
create index if not exists marketing_contents_campaign on public.marketing_contents(campaign_id);
create index if not exists marketing_creatives_content on public.marketing_creatives(content_id);
create index if not exists marketing_metrics_content_date on public.marketing_metrics(content_id,measured_on desc);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_contents enable row level security;
alter table public.marketing_creatives enable row level security;
alter table public.marketing_metrics enable row level security;

drop policy if exists marketing_campaigns_access on public.marketing_campaigns;
create policy marketing_campaigns_access on public.marketing_campaigns for all to authenticated using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
drop policy if exists marketing_contents_access on public.marketing_contents;
create policy marketing_contents_access on public.marketing_contents for all to authenticated using(owner_id=auth.uid() or responsible_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or responsible_id=auth.uid() or public.is_admin());
drop policy if exists marketing_creatives_access on public.marketing_creatives;
create policy marketing_creatives_access on public.marketing_creatives for all to authenticated using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
drop policy if exists marketing_metrics_access on public.marketing_metrics;
create policy marketing_metrics_access on public.marketing_metrics for all to authenticated using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());

revoke all on public.marketing_campaigns,public.marketing_contents,public.marketing_creatives,public.marketing_metrics from anon,authenticated;
grant select,insert,update,delete on public.marketing_campaigns,public.marketing_contents,public.marketing_creatives,public.marketing_metrics to authenticated;
