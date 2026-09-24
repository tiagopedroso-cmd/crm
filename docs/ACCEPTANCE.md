# Homologação

## Resultado da validação local — 24/09/2026

- TypeScript e build de produção aprovados.
- 13 testes de utilitários, migrations e regras PostgreSQL/RLS aprovados.
- 11 cenários de interface aprovados: navegação/responsividade, CRUD completo e logout em desktop, tablet e celular; arraste com rollback e metas/propostas/pós-venda/CSV no desktop. As quatro combinações redundantes desses dois cenários adicionais com tablet/celular são explicitamente ignoradas.
- Capturas de desktop e celular inspecionadas. Corrigidos largura do Lead 360°, acesso ao logout mobile e estado otimista do checklist.
- `npm audit` sem vulnerabilidades conhecidas na árvore instalada.
- Auth real, cookies no domínio publicado, envio de recuperação e sincronização entre aparelhos físicos continuam pendentes de um projeto Supabase configurado. Os testes de interface usam autenticação simulada e banco temporário; não certificam o ambiente de produção.

## Testes locais reproduzíveis

- `npm run typecheck`: contratos TypeScript.
- `npm test`: migrations em PostgreSQL embarcado, RLS, autoria, constraints, histórico, receita fechada, pós-venda, metas, catálogo, exclusão e utilitários de data/CSV.
- `npm run build`: compilação otimizada e rotas Next.js.
- `npm run test:e2e`: cenários de interface em ambiente simulado isolado, sem acessar dados reais. Consulte a configuração dos testes para os requisitos do navegador.

## Validar com o Supabase de homologação

| Fluxo | Procedimento | Resultado esperado |
|---|---|---|
| Login/logout | Entrar com senha válida, inválida e sair | Apenas senha válida concede acesso; após sair, voltar/recarregar exige login |
| Cadastro rápido | Informar somente empresa | Lead salvo com data comercial de hoje |
| Edição e exclusão | Completar sondagem, editar, excluir com confirmação | Alterações persistidas; filhos removidos na exclusão |
| Busca e filtros | Empresa, contato, telefone, nicho; combinar todos os filtros | Resultados e contagem coerentes, com paginação |
| Interação | Registrar WhatsApp e observação retroativa | Timeline mostra autoria; última interação não regride |
| Próxima ação | Agendar hoje, ontem e limpar ambos os campos | Agenda/alertas corretos; campo parcial rejeitado |
| Cadência | Selecionar D+2 e ajustar manualmente | Data baseada no primeiro contato, sem envio de mensagem |
| Pipeline | Arrastar entre colunas e mudar pelo seletor no celular | Persistência imediata e histórico |
| Falha de gravação | Simular falha de rede durante arraste | Card retorna à etapa anterior e erro fica visível |
| Fechamento | Informar R$ 1.200 para potencial de R$ 1.500 | Receita de R$ 1.200 pela data informada |
| Perda | Tentar confirmar sem motivo | Não salva até informar motivo |
| Pós-venda | Mover fechado para pós-venda e marcar checklist | Mantém receita e salva checklist |
| Dashboard/placar | Criar dados controlados por período | Contagens conforme as definições do README |
| Metas | Editar metas e recarregar | Metas persistem e barras se atualizam |
| CSV/backup | Exportar mais de uma página e valores com fórmulas | Todos os registros permitidos; fórmulas neutralizadas |
| Responsividade | 390px, 768px, 1440px; ampliar texto 200% | Drawer, cards, controles utilizáveis, Kanban com rolagem própria |
| Dois dispositivos | Cadastrar no notebook, abrir/recarregar no celular | Mesmos dados com mesma conta |
| RLS | Repetir matriz A/B/admin do README | Nenhum vazamento entre vendedores ou para anônimos |

O ambiente Supabase real e o deploy não são disponibilizados pelo repositório. Não considerar testes simulados como homologação de Auth, rede, recuperação de conta ou sincronização entre dispositivos reais.
