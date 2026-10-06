-- ============================================================
-- SISTEMAS — IDENTIFICAR DECISOR
--
-- Aplicação:
-- Leads interessados em Sistema que ainda não possuem
-- o Nome do Contato preenchido.
--
-- Objetivo:
-- Identificar o nome e o contato da pessoa responsável por
-- avaliar projetos de sistemas, processos ou melhorias internas.
--
-- Cadência:
-- 5 tentativas totais:
-- step 0 = abordagem inicial
-- step 1 = follow-up 1
-- step 2 = follow-up 2
-- step 3 = follow-up 3
-- step 4 = follow-up 4
-- ============================================================


create or replace function public.seed_system_decision_maker_template(
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_id uuid;
begin

  -- ==========================================================
  -- LOCALIZA TEMPLATE EXISTENTE DO USUÁRIO
  -- ==========================================================

  select mt.id
  into v_template_id
  from public.message_templates mt
  where mt.user_id = p_user
    and mt.name = 'SISTEMAS — IDENTIFICAR DECISOR'
  order by mt.created_at
  limit 1;


  -- ==========================================================
  -- CRIA TEMPLATE CASO AINDA NÃO EXISTA
  -- ==========================================================

  if v_template_id is null then

    insert into public.message_templates (
      user_id,
      name,
      niche_group,
      message,
      is_default,
      is_active
    )
    values (
      p_user,
      'SISTEMAS — IDENTIFICAR DECISOR',
      'Geral',

      $msg$Oi! Tudo bem?

Meu nome é {{usuario}}.

Estou entrando em contato porque trabalhamos com desenvolvimento de sistemas personalizados e queria falar com a pessoa que avalia esse tipo de projeto na {{empresa}}.

Você consegue me informar o nome e o contato do responsável por sistemas/processos, ou esse assunto fica com compras/administrativo?$msg$,

      false,
      true
    )
    returning id into v_template_id;

  else

    -- Se já existir, garante que o template permaneça ativo
    -- e com a abordagem inicial atualizada.

    update public.message_templates
    set
      niche_group = 'Geral',

      message = $msg$Oi! Tudo bem?

Meu nome é {{usuario}}.

Estou entrando em contato porque trabalhamos com desenvolvimento de sistemas personalizados e queria falar com a pessoa que avalia esse tipo de projeto na {{empresa}}.

Você consegue me informar o nome e o contato do responsável por sistemas/processos, ou esse assunto fica com compras/administrativo?$msg$,

      is_default = false,
      is_active = true

    where id = v_template_id;

  end if;


  -- ==========================================================
  -- CADÊNCIA
  -- ==========================================================

  insert into public.campaign_messages (
    template_id,
    step,
    message
  )
  values

  -- ==========================================================
  -- TENTATIVA 1/5
  -- ABORDAGEM INICIAL
  -- ==========================================================

  (
    v_template_id,
    0,

    $msg$Oi! Tudo bem?

Meu nome é {{usuario}}.

Estou entrando em contato porque trabalhamos com desenvolvimento de sistemas personalizados e queria falar com a pessoa que avalia esse tipo de projeto na {{empresa}}.

Você consegue me informar o nome e o contato do responsável por sistemas/processos, ou esse assunto fica com compras/administrativo?$msg$
  ),


  -- ==========================================================
  -- TENTATIVA 2/5
  -- FOLLOW-UP 1
  -- ==========================================================

  (
    v_template_id,
    1,

    $msg$Oi! Passando novamente porque talvez eu tenha falado com o canal errado.

É sobre desenvolvimento de sistemas personalizados para organizar e automatizar processos internos.

Normalmente esse assunto fica com Sistemas/TI ou com Operações/Administrativo.

Qual dessas áreas cuida disso aí na {{empresa}}?

Se puder, me passa também o nome ou contato da pessoa responsável.$msg$
  ),


  -- ==========================================================
  -- TENTATIVA 3/5
  -- FOLLOW-UP 2
  -- ==========================================================

  (
    v_template_id,
    2,

    $msg$Oi! Só contextualizando para facilitar o direcionamento: não é suporte de informática nem venda de software pronto.

Desenvolvemos sistemas sob medida quando a empresa tem processos que dependem de planilhas, WhatsApp, controles manuais ou ferramentas que não conversam entre si.

Quem seria a pessoa mais indicada para eu apresentar isso: o responsável por processos ou o responsável por sistemas?

Se puder me passar o nome e contato, eu falo diretamente com ela.$msg$
  ),


  -- ==========================================================
  -- TENTATIVA 4/5
  -- FOLLOW-UP 3
  -- ==========================================================

  (
    v_template_id,
    3,

    $msg$Olá! Para não tomar o tempo de vocês, preciso somente chegar à pessoa certa.

Se você me passar o nome e o contato do responsável que avalia projetos de sistemas e melhoria de processos na {{empresa}}, eu direciono a conversa diretamente para ele.

Esse tema fica mais próximo de Sistemas/TI ou de Operações/Administrativo?$msg$
  ),


  -- ==========================================================
  -- TENTATIVA 5/5
  -- FOLLOW-UP 4
  -- ==========================================================

  (
    v_template_id,
    4,

    $msg$Oi! Faço meu último contato por aqui para não ficar insistindo no canal errado.

Quero apenas identificar quem avalia projetos de sistemas e melhoria de processos na {{empresa}}.

Antes de encerrar: devo direcionar esse assunto para Sistemas/TI ou para Operações/Administrativo?

Se puder me passar o nome e o contato da pessoa responsável, sigo diretamente com ela.$msg$
  )

  on conflict (template_id, step)
  do update
  set message = excluded.message;

end;
$$;


-- ============================================================
-- CRIA A CAMPANHA PARA TODOS OS USUÁRIOS JÁ EXISTENTES
-- ============================================================

select public.seed_system_decision_maker_template(p.id)
from public.profiles p;


-- ============================================================
-- CRIA AUTOMATICAMENTE PARA NOVOS USUÁRIOS
-- ============================================================

create or replace function
public.seed_system_decision_maker_template_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  perform public.seed_system_decision_maker_template(new.id);

  return new;

end;
$$;


-- ============================================================
-- TRIGGER
-- ============================================================

drop trigger if exists
profile_seed_system_decision_maker_template
on public.profiles;


create trigger
profile_seed_system_decision_maker_template
after insert
on public.profiles
for each row
execute function
public.seed_system_decision_maker_template_on_profile();


-- ============================================================
-- SEGURANÇA
-- ============================================================

revoke all
on function public.seed_system_decision_maker_template(uuid)
from public;


revoke all
on function public.seed_system_decision_maker_template_on_profile()
from public;


-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

select
  mt.user_id,
  mt.id as template_id,
  mt.name as campanha,
  mt.niche_group,
  mt.is_active,
  cm.step,
  cm.message
from public.message_templates mt
left join public.campaign_messages cm
  on cm.template_id = mt.id
where mt.name = 'SISTEMAS — IDENTIFICAR DECISOR'
order by
  mt.user_id,
  cm.step;