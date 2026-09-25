# InovaLogix · CRM Comercial

CRM em português para acompanhar prospecção, próximas ações, negociações e pós-venda. Reconstruído em Next.js, React e TypeScript a partir da identidade visual do HTML de referência. O PostgreSQL do Supabase é a única fonte dos dados comerciais.

## Requisitos

- Node.js 22 ou 24 LTS e npm.
- Projeto Supabase com PostgreSQL e Auth.
- GitHub e Vercel para publicação (opcionais para execução local).

## Instalação

```sh
git clone <URL_DO_SEU_REPOSITORIO>
cd CRM
npm ci
```

Copie `.env.example` para `.env.local` e preencha:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Nas variáveis públicas, nunca use uma chave `service_role` ou `sb_secret_`. O cadastro administrativo utiliza uma chave separada, exclusivamente no servidor, conforme a seção de usuários. A chave pública não concede acesso aos dados sem sessão e políticas RLS válidas. Não versionar `.env.local`.

## Supabase e migrations

1. Crie um projeto no [Supabase](https://supabase.com/dashboard).
2. No SQL Editor, execute **em ordem**, uma única vez, os arquivos de `supabase/migrations`:
   - `202609230001_crm.sql`: tabelas, constraints, índices, triggers, grants e RLS.
   - `202609230002_analytics.sql`: agregações comerciais com `SECURITY INVOKER`.
3. Alternativamente, use o Supabase CLI, vincule o projeto com `supabase link --project-ref SEU_REF` e execute `supabase db push`. Revise o projeto vinculado antes de aplicar.
4. Em Settings → API, copie a URL e a chave pública para o ambiente.

As migrations não são idempotentes para execução manual repetida. Com CLI, o histórico de migrations evita reaplicações. Não execute alterações destrutivas em um banco com dados sem backup.

### Auth e primeiro usuário

1. Em Authentication → Providers, habilite e-mail/senha.
2. Desabilite novos cadastros públicos em Authentication → Settings. O CRM não oferece autoinscrição.
3. Em Authentication → Users → Add user, crie seu usuário e confirme o e-mail pelo painel. Utilize uma senha forte.
4. O trigger cria automaticamente `profiles` com papel **VENDEDOR** e `sales_goals` com as metas iniciais. Não se promove o primeiro cadastro automaticamente: isso permitiria apropriação administrativa se o cadastro público estivesse habilitado.
5. Promova seu usuário pelo SQL Editor, usando o UUID exibido no Auth:

```sql
update public.profiles
set role = 'ADMIN', display_name = 'Tiago'
where id = 'UUID_DO_SEU_USUARIO';
```

Somente uma sessão administrativa do banco pode alterar papéis. Nem vendedores nem administradores do CRM recebem permissão SQL para editar a tabela de perfis. Gestão de equipe e recuperação de senha são operadas pelo painel Supabase nesta versão.

Em Authentication → URL Configuration, cadastre o domínio de produção como Site URL e os endereços de desenvolvimento necessários. O login atual é por senha, sem OAuth ou magic link.

## Executar

```sh
npm run dev
```

Abra [o CRM local](http://127.0.0.1:3000). Sem variáveis, a tela de login mostra o estado de configuração; não cria um banco local fictício nem libera telas comerciais.

```sh
npm run typecheck
npm test
npm run build
npm start
```

### Testes de interface

```sh
npm run test:e2e
```

É necessário ter Google Chrome instalado. O Playwright inicia Chrome headless em desktop (1440px), tablet (768px) e celular (390px). As portas locais 3100 e 54329 precisam estar livres. O adaptador em `scripts/e2e-server.mjs` simula somente o protocolo de Auth/API e executa as migrations reais em um PGlite temporário. Esses dados desaparecem ao terminar; o adaptador não faz parte da aplicação e não deve ser publicado. Capturas ficam em `artifacts/` e falhas em `test-results/`, ambos ignorados pelo Git. Não configure as credenciais de teste no Vercel.

O servidor padrão escuta apenas em `127.0.0.1`. Para testar pelo celular na mesma rede, execute `npx next dev --hostname 0.0.0.0` e acesse o IP local do computador na porta 3000. Para uso regular no notebook e celular, prefira o domínio HTTPS publicado. Os dois dispositivos devem usar a mesma conta e o mesmo projeto Supabase.

## Funcionalidades

- Autenticação por senha, logout, sessão em cookies e proteção do layout no servidor.
- Dashboard pessoal com período, agenda, metas, receita fechada e potencial ativo.
- Leads com cadastro rápido, edição completa, busca, filtros e paginação.
- Lead 360° com contato, sondagem, interações, propostas e checklist de pós-venda.
- Pipeline em três grupos: Prospecção, Negócios e Relacionamento. Arraste pelo ícone no card ou use o seletor, inclusive para mover entre grupos. Confirmação de fechamento e motivo obrigatório de perda.
- Atualização otimista do arraste, rollback em falha e histórico de etapa atômico no banco.
- Agenda com ações atrasadas, hoje, futuras e leads sem próxima ação.
- Cadência manual D0, D+2, D+5, D+10, D+20 e D+30. O clique agenda uma ação a partir do primeiro contato (ou da data atual quando ausente), sem enviar mensagens.
- Placar semanal, conversões, relatórios por período e filtros de responsável para admin.
- Metas pessoais editáveis; produtos e objeções editáveis por admin.
- CSV de todos os leads que correspondem aos filtros, com neutralização de fórmulas.
- Exportação JSON das tabelas acessíveis ao usuário e demonstração removível.

## Regras e definições

- **Faturamento:** soma `closed_value` para negócios atualmente em FECHADO ou PÓS-VENDA, usando `closed_on`. Reabrir ou marcar como perdido retira o negócio do faturamento. Não é um livro contábil nem registro de recebimentos.
- **Datas:** eventos usam `timestamptz`; inserção e fechamento usam `date`. Exibição, agregação e entrada de horários usam `America/Sao_Paulo` (UTC−03 no Brasil atual). A semana começa segunda-feira. Períodos padrão vão do início do intervalo até hoje.
- **Metas:** ficam em `sales_goals`. Meta mensal total = principal + sistemas. As metas iniciais existem no banco, não como um fallback oculto de interface.
- **Primeiro contato:** preenchido ao passar NOVO LEAD → CONTATADO, somente quando vazio. Uma vez preenchido, não é sobrescrito. Saltar a etapa não inventa uma data de contato.
- **Última interação:** mantém a maior data entre as interações registradas. Registrar uma observação retroativa não faz a data regredir.
- **Conversão de coorte:** o funil considera leads inseridos no período e as etapas realmente visitadas, com contagem distinta por lead. A etapa inicial representa toda a coorte. Etapas puladas não são inferidas, por isso uma taxa adjacente pode superar 100%. A taxa Lead → cliente considera clientes atuais dessa coorte.
- **Placar de atividades:** conta leads distintos que visitaram cada etapa no período do evento. Fechamentos usam data de fechamento. Voltar e entrar novamente na mesma etapa não conta duas vezes no mesmo período.
- **Ações:** texto e data/hora são preenchidos juntos, ou ambos ficam vazios. Ausência gera alerta, não bloqueia cadastro rápido. Atraso é relativo ao instante atual; uma ação de hoje já vencida aparece como atrasada.
- **Reuniões da agenda:** são próximas ações cujo texto contém “reuni”. Use “Reunião de diagnóstico”, por exemplo.
- **Propostas:** registros próprios com link HTTPS, valor, data e estado. Alterar o estado da proposta não fecha o lead automaticamente; o fechamento exige valor, data e forma de pagamento.
- **Pós-venda:** checklist comercial independente, sem gestão de projeto ou financeiro.
- **Backup JSON:** exportação lógica por páginas, não snapshot transacional; prefira realizá-la em momento sem alterações simultâneas. Não inclui senhas, sessão Auth ou arquivos dos links de proposta. Recuperação integral de produção deve usar backups nativos do Supabase. Importador JSON não faz parte desta versão.

## Segurança

RLS está habilitada em todas as tabelas comerciais. Vendedores acessam apenas seus leads, seus históricos e suas metas. Administradores podem ler e alterar toda a operação; produtos e objeções são compartilhados somente entre usuários autenticados. Tabelas relacionadas verificam acesso ao lead pai via RLS. O histórico de pipeline é escrito apenas por trigger; clientes não podem forjar ou excluir seus eventos. A autoria de interações deve ser igual ao usuário autenticado.

Triggers `SECURITY DEFINER` usam `search_path` vazio e nomes qualificados. A função administrativa apenas consulta o papel persistido; não confia em metadata editável pelo usuário. Agregações são `SECURITY INVOKER`, portanto mantêm RLS. O servidor autentica via `getUser`; o proxy renova cookies via `getClaims` seguindo a [documentação do Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

Validação de formulários usa Zod/HTML; constraints e RLS permanecem efetivas mesmo para requisições diretas. React escapa textos; links aceitam protocolos HTTP(S), e links de propostas/Instagram exigem HTTPS. Não há HTML de usuário interpretado nem envio automático de mensagens. CSV neutraliza valores que poderiam executar fórmulas em planilhas.

## Testar RLS no projeto real

Os testes automatizados executam as migrations em PostgreSQL embarcado (PGlite), com duas identidades e um administrador. Para homologação, repita os testes abaixo com **duas contas reais** no Supabase; o teste embarcado não valida infraestrutura Auth, cookies e rede do seu projeto.

1. Crie A e B como VENDEDORES; deixe C como ADMIN.
2. Entre como A, cadastre um lead, registre interação e proposta.
3. Entre como B em uma janela anônima. O lead de A não pode aparecer na lista, busca, agenda, relatórios ou exportações; abrir diretamente seu UUID deve falhar.
4. Usando o client Supabase autenticado como B, tente inserir uma interação/proposta/pós-venda no lead de A, alterar o proprietário para A e editar o papel em `profiles`. As operações devem ser negadas.
5. Como C, confira acesso aos dois vendedores e edição de produtos.
6. Sem sessão, tente selecionar `leads` com a chave pública. O acesso deve ser negado.
7. Tente marcar PERDIDO sem motivo e FECHADO sem valor/data/pagamento diretamente pela API. O banco deve rejeitar.

Nunca valide isolamento apenas com o SQL Editor padrão ou `service_role`, pois esses acessos ignoram RLS.

## GitHub

```sh
git init
git add .
git commit -m "Implementa CRM comercial InovaLogix"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO_PRIVADO>
git push -u origin main
```

Antes do commit, confira `git status` e a ausência de `.env.local`, backups e dados reais. O projeto inclui lockfile para instalação reproduzível. Não é necessário plugin GitHub para usar Git/CLI.

## Vercel

1. Importe o repositório no [painel Vercel](https://vercel.com/new), escolhendo Next.js.
2. Configure Node.js 22 ou 24 e mantenha os comandos padrão (`npm run build`).
3. Em Environment Variables, adicione as duas variáveis de `.env.example`, para os ambientes desejados. Use projeto Supabase separado para homologação quando possível.
4. Faça deploy e registre o domínio HTTPS no Supabase Auth.
5. Faça login, cadastre um lead e confirme persistência após recarregar e em outro dispositivo.
6. Toda alteração de variável `NEXT_PUBLIC_*` exige novo build/deploy.

Nenhuma credencial, projeto Supabase, repositório remoto ou implantação é criada automaticamente por este código.

## Estrutura

```text
src/app/                  Rotas Next.js, layout protegido e login
src/components/           Shell, formulários, pipeline, agenda e análises
src/hooks/                Contexto, consultas compartilhadas e períodos
src/services/crm.ts       Acesso paginado ao Supabase e mutações
src/schemas/              Validação dos leads
src/types/                Tipos e enumerações do domínio
src/lib/                  Datas, CSV e clientes Supabase
supabase/migrations/      Schema, regras, RLS e agregações
tests/                    Regras comerciais e testes de isolamento
```

Consultas independentes são paralelas; listas e históricos são paginados. React Query compartilha cache de referência, invalida dados após mutações e revalida ao recuperar foco. Não há realtime nesta versão: recarregar ou voltar o foco busca os mesmos dados oficiais. O Kanban carrega no máximo 20 leads por coluna/página. Metas e dashboard são pessoais; relatórios administrativos permitem visão da operação.

## Homologação antes de produção

Confira `docs/ACCEPTANCE.md` para separar o que foi validado localmente do que depende do seu projeto Supabase real. Login/logout reais, entrega de e-mail de recuperação, persistência entre dispositivos e RLS no ambiente publicado precisam dessa etapa. Não há envio automático de WhatsApp, IA, automação de e-mail, ERP, nota fiscal ou financeiro completo.

## Abordagem comercial individual pelo WhatsApp

Para atualizar um CRM já instalado, execute **somente** `supabase/upgrade-outreach.sql` no SQL Editor do projeto Supabase, uma vez, antes de publicar esta versão. O arquivo aplica a migration `202609240001_outreach.sql` em uma transação. Não execute novamente o instalador inicial em um banco existente. Pela CLI, use o fluxo de migrations do seu projeto (confira o histórico remoto antes de `db push`).

- Onze modelos iniciais são copiados para cada usuário existente e novo. Configurações → Mensagens de abordagem permite criar, editar, duplicar, ativar/desativar, excluir e definir um padrão por grupo. Templates são privados inclusive entre administradores; RLS usa exclusivamente o usuário autenticado.
- O nicho sugere o grupo, a origem Indicação tem prioridade e o site cadastrado sugere a variante. Um padrão pessoal tem prioridade. Todos os modelos ativos continuam disponíveis para escolha manual. Revise alegações sobre o site e a empresa antes de usar os modelos.
- Variáveis: responsável, empresa, nicho, produto, cidade, indicado_por, site e origem. O cadastro inclui “Indicado por”. Campos ausentes recebem alternativas; variáveis desconhecidas exigem revisão antes de abrir o WhatsApp.
- Lista, cards do Pipeline, Lead 360 e Agenda (sem primeiro contato) abrem o modal individual. Copiar ou abrir o WhatsApp **não** grava uma interação. O texto editado nunca altera o modelo original.
- Após enviar dentro do WhatsApp, volte à mesma aba e confirme “Sim, registrar envio”. É possível ajustar o texto efetivamente enviado antes de confirmar. O rascunho permanece apenas na memória dessa aba; recarregar ou fechar o modal antes da confirmação descarta o rascunho.
- A RPC `confirm_approach` verifica sessão, acesso ao lead e propriedade do template; bloqueia o lead e grava interação, snapshot da abordagem, primeiro contato e etapa numa transação. Uma chave de idempotência evita duplicação ao repetir a mesma confirmação após falha de rede. Etapas diferentes de NOVO LEAD e primeiro contato existente são preservados.
- O follow-up sugerido é D+2, às 09h em Brasília. A ação existente só é substituída após marcar a confirmação. Uma comparação atômica detecta alterações concorrentes.
- `lead_approaches` preserva o texto, nome/grupo do template, telefone, nicho, produto, usuário e interação. Possui campos opcionais `response_interaction_id` e `responded_at` para vinculação futura de respostas. Respostas não são inferidas automaticamente; painéis avançados ficam para outra etapa. Excluir um template mantém os snapshots de abordagens.

Validação: `npm test`, `npm run test:e2e`, `npm run build`. Os testes de interface interceptam o domínio WhatsApp; nenhuma mensagem real é enviada. O banco dos testes é PostgreSQL local (PGlite) com as migrations e políticas reais, sem dados de produção.

## Usuários e nome do remetente

Após a atualização de abordagens, aplique `supabase/upgrade-user-names.sql` uma vez. Em Configurações → Usuários, cada pessoa pode editar seu nome; administradores podem editar os nomes visíveis e adicionar usuários com nome, e-mail e senha (mínimo 12 caracteres). As novas contas são sempre VENDEDOR, recebem metas e modelos privados pelos triggers existentes e podem entrar imediatamente. Nenhum e-mail é enviado pelo cadastro; o administrador entrega o acesso à pessoa.

O endpoint `POST /api/users` valida origem, sessão com Supabase Auth e perfil ADMIN antes de chamar a API administrativa. Configure `SUPABASE_SERVICE_ROLE_KEY` **somente no servidor** (Vercel/local). Nunca use prefixo NEXT_PUBLIC nessa variável, nunca a envie ao cliente e nunca a versione. As duas variáveis NEXT_PUBLIC continuam usando exclusivamente a chave pública. A edição de nome usa RLS e permissão restrita à coluna display_name: não permite promover contas. Administradores são atribuídos separadamente pelo proprietário no Supabase.

A variável `{{usuario}}` representa o nome do usuário conectado; `{{responsavel}}` permanece sendo o contato do lead. Os modelos iniciais passam a incluir “Me chamo {{usuario}}, da InovaLogix.”. Modelos com saudação já personalizada e snapshots de abordagens anteriores são preservados. Novos usuários recebem modelos com essa apresentação. Sem nome cadastrado, a apresentação padrão usa “Sou da InovaLogix.”. Após alterar seu nome, as próximas abordagens usam o nome atualizado.

## Concluir ações pendentes

Em bancos existentes, aplique `supabase/upgrade-completed-actions.sql` uma única vez antes do deploy. A instalação inicial já inclui a migration.

O botão ✓ “Concluir ação” aparece na Agenda, lista de leads, Pipeline e Lead 360 quando há ação com data. O formulário sugere hoje em Brasília, aceita uma data de conclusão anterior e permite cadastrar a próxima ação com data e hora. Sem sucessora, a pendência é removida. A conclusão fica no Histórico e em `completed_actions`, incluída no backup. Etapa e primeiro contato não são alterados. A RPC verifica acesso, detecta ação alterada por outra sessão e evita duplicação em tentativas repetidas.

## Autoria e ordenação

Aplique `supabase/upgrade-lead-creator-sort.sql` uma vez nos bancos existentes. A autoria dos registros antigos é recuperada do evento inicial do histórico; sem autor registrado, é exibido “Não identificado”, sem atribuir o cadastro por suposição. Novos leads recebem o usuário autenticado e seu nome no momento do cadastro. Esses campos permanecem imutáveis mesmo ao trocar responsável.

Meus leads inicia em ordem alfabética por empresa, com contato como desempate. Os cabeçalhos alternam crescente/decrescente; o seletor oferece a mesma ordenação no celular. Produto e valor têm ordenações independentes. A view `lead_listing` aplica RLS do usuário e a ordenação ocorre antes da paginação; o CSV respeita a ordem e os filtros. “Cadastrado por” está nos filtros avançados, separado de Responsável.
