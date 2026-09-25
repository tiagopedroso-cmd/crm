begin;
alter table public.leads add column created_by uuid references public.profiles(id), add column creator_name text not null default 'Não identificado';
update public.leads l set created_by=h.actor_id,creator_name=coalesce(nullif(p.display_name,''),'Usuário sem nome')
from public.pipeline_history h join public.profiles p on p.id=h.actor_id
where h.lead_id=l.id and h.from_stage is null;
create function public.stamp_lead_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.created_by:=auth.uid();
  select coalesce(nullif(display_name,''),'Usuário sem nome') into new.creator_name from public.profiles where id=new.created_by;
  new.creator_name:=coalesce(new.creator_name,'Não identificado');
 else
  new.created_by:=old.created_by; new.creator_name:=old.creator_name;
 end if;
 return new;
end; $$;
create trigger leads_creator before insert or update on public.leads for each row execute function public.stamp_lead_creator();
revoke all on function public.stamp_lead_creator() from public;
create index leads_creator on public.leads(created_by);
create view public.lead_listing with (security_invoker=true) as
select l.*,p.name as product_name,lower(l.company) as company_sort,lower(l.contact_name) as contact_sort,lower(l.creator_name) as creator_sort,lower(p.name) as product_sort
from public.leads l left join public.products p on p.id=l.product_id;
revoke all on public.lead_listing from anon;
grant select on public.lead_listing to authenticated;

commit;
