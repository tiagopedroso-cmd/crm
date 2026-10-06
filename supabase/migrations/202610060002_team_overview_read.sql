-- ============================================================
-- 202610060002_team_overview_read.sql
--
-- VISÃO GERAL DA EQUIPE
--
-- Regras:
--
-- ADMIN:
--   - Pode visualizar todos os perfis
--   - Pode visualizar todos os leads
--   - Pode visualizar todas as cadências
--   - Pode usar "Todos" na Visão Geral
--   - Meta diária = 40 x quantidade de usuários
--
-- USUÁRIO COMUM:
--   - Visualiza apenas o próprio perfil
--   - Visualiza apenas os próprios leads
--   - Visualiza apenas as próprias cadências
--   - Meta diária individual = 40
--
-- IMPORTANTE:
-- Esta migration altera somente políticas de LEITURA.
-- As políticas existentes de INSERT / UPDATE / DELETE
-- permanecem inalteradas.
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================

-- Remove a política permissiva criada pela versão anterior,
-- caso ela tenha sido executada.

drop policy if exists profiles_team_read
on public.profiles;


-- Nova política:
-- usuário comum vê o próprio perfil;
-- administrador vê todos.

create policy profiles_team_read
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);


-- ============================================================
-- 2. LEADS
-- ============================================================

-- Remove a política permissiva anterior, caso exista.

drop policy if exists leads_team_read
on public.leads;


-- Nova política:
-- usuário comum vê apenas leads próprios;
-- administrador vê todos os leads.

create policy leads_team_read
on public.leads
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
);


-- ============================================================
-- 3. LEAD CADENCES
-- ============================================================

-- Remove a política permissiva anterior, caso exista.

drop policy if exists cadence_team_read
on public.lead_cadences;


-- Nova política:
-- usuário comum vê apenas as próprias cadências;
-- administrador vê todas.

create policy cadence_team_read
on public.lead_cadences
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);


-- ============================================================
-- 4. GARANTE PERMISSÕES DE SELECT
-- ============================================================

grant select
on public.profiles
to authenticated;

grant select
on public.leads
to authenticated;

grant select
on public.lead_cadences
to authenticated;


-- ============================================================
-- 5. VERIFICAÇÃO DAS POLÍTICAS
-- ============================================================

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'leads',
    'lead_cadences'
  )
order by
  tablename,
  policyname;