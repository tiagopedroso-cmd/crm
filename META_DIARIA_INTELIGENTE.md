# Meta Diária Inteligente — análise e implementação

## Estrutura existente reutilizada
O CRM já possui Next.js/React/TypeScript, Supabase, `leads`, `lead_interactions`, `lead_approaches`, `lead_cadences`, `campaign_messages`, a view `lead_listing`, Pipeline e Dashboard. A implementação reutiliza essas estruturas: não cria uma segunda régua nem duplica histórico.

## Arquivos alterados
- `src/app/(crm)/dashboard/page.tsx` — inclui a Meta de Hoje antes dos indicadores existentes.
- `src/app/(crm)/pipeline/page.tsx` — amplia filtros de follow-up/tentativa.
- `src/app/globals.css` — estilos responsivos usando o Design System existente.
- `src/components/leads/lead-card.tsx` — tentativa 1/5…5/5, vencimento e sugestão após conclusão.
- `src/components/leads/message-button.tsx` — primeiro contato passa a mostrar a próxima data calculada automaticamente.
- `src/components/leads/followup-button.tsx` — registro do follow-up e próxima data automática; inclui a correção TypeScript do build anterior.
- `src/components/leads/filters.tsx` — novos filtros sem remover os atuais.
- `src/lib/outreach.ts` — intervalo padrão passa para 3 dias úteis.
- `src/services/crm.ts` — filtros de régua/tentativa.
- `src/types/crm.ts` — campos/filtros adicionais.
- `tsconfig.json` — mantém fora do typecheck as cópias locais/patches que estavam causando o erro de build.

## Novos arquivos
- `src/lib/business-days.ts` — regra centralizada de dias úteis.
- `src/services/daily-prospecting.ts` — cálculo da capacidade, fila e previsão.
- `src/components/analytics/daily-prospecting-target.tsx` — Meta de Hoje, fila e próximas ações.
- `supabase/migrations/202610020001_daily_smart_target.sql` — migração segura.
- `supabase/upgrade-daily-smart-target.sql` — mesma migração para execução manual no SQL Editor.
- `tests/business-days.test.ts` — testes da regra de dias úteis.

## Banco de dados
É necessária uma migração. Ela não apaga leads, abordagens nem histórico. A régua existente é ajustada para **5 tentativas totais** (primeiro contato + 4 follow-ups). O banco passa a calcular e gravar automaticamente a próxima data elegível. A view `lead_listing` ganha `cadence_last_sent_at`.

## 3 dias úteis
A função SQL `crm_add_business_days` e a função TypeScript `addBusinessDays` ignoram sábado e domingo. A regra fica centralizada para que feriados possam ser incorporados depois. Ex.: segunda + 3 dias úteis = quinta; quinta + 3 = terça.

## Fila diária
Capacidade fixa: 30. Primeiro entram follow-ups elegíveis ordenados pela data mais antiga; depois entram novos leads, até completar a capacidade restante. Se houver 35 follow-ups e nenhuma mensagem realizada, os 30 mais antigos entram na fila e 5 ficam pendentes. Contatos já realizados no dia reduzem a capacidade disponível.

O modo de recuperação é detectado automaticamente quando existe follow-up atrasado ou mais de 25 follow-ups elegíveis. Nesse modo a referência visual é 5 novos leads/dia; normalizado o backlog, volta para 6. A referência não reserva vagas contra follow-ups prioritários e não é trava rígida.

## Leads antigos / backlog
Leads `CONTATADO` com histórico em `lead_approaches` e sem `lead_cadences` recebem uma régua reconstruída a partir do histórico real, sem inventar tentativas. Cadências existentes sem próxima data recebem a data elegível calculada a partir do último envio. Leads sem qualquer histórico verificável não têm tentativa inventada e permanecem intactos para revisão manual.

## Resposta e Pipeline
Ao sair de `CONTATADO`, a régua é pausada; `RESPONDEU` marca `RESPONDED`. Ao retornar para `CONTATADO`, uma régua pausada/respondida é reativada no mesmo ponto. Régua concluída não reabre automaticamente. Etapas comerciais posteriores, Fechado e Perdido ficam fora da fila automática.

## Impactos
- A regra anterior de 5 follow-ups (6 contatos contando a abordagem) passa para 4 follow-ups (5 tentativas totais), conforme a nova especificação.
- O agendamento manual após cada envio deixa de ser necessário; o CRM calcula +3 dias úteis automaticamente.
- O WhatsApp continua sendo aberto pelo usuário. Nenhum envio automático foi implementado.
- O histórico existente é preservado.
