begin;
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
