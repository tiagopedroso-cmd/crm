-- Atualização dos nomes dos usuários e remetentes. Execute uma vez.
BEGIN;
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

COMMIT;
