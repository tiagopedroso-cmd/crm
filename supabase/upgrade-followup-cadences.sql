-- Structured outreach cadence: campaign + first contact + 5 follow-ups.
create table public.campaign_messages (
 template_id uuid not null references public.message_templates(id) on delete cascade,
 step integer not null check(step between 0 and 20),
 message text not null check(length(trim(message)) between 1 and 8000),
 primary key(template_id,step)
);
create table public.lead_cadences (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 template_id uuid not null references public.message_templates(id),
 campaign_name text not null,
 status text not null default 'IN_PROGRESS' check(status in ('NOT_STARTED','IN_PROGRESS','RESPONDED','COMPLETED','PAUSED')),
 current_step integer not null default 0 check(current_step between 0 and 20),
 total_followups integer not null default 5 check(total_followups between 1 and 20),
 started_at timestamptz not null default now(),
 last_sent_at timestamptz not null default now(),
 next_followup_at timestamptz,
 updated_at timestamptz not null default now()
);
create index lead_cadences_user_status on public.lead_cadences(user_id,status);
create index lead_cadences_next on public.lead_cadences(next_followup_at) where status='IN_PROGRESS';
alter table public.campaign_messages enable row level security;
alter table public.lead_cadences enable row level security;
create policy campaign_messages_read on public.campaign_messages for select to authenticated using(exists(select 1 from public.message_templates t where t.id=template_id and t.user_id=auth.uid()));
create policy cadence_read on public.lead_cadences for select to authenticated using(user_id=auth.uid() or public.is_admin());
revoke all on public.campaign_messages,public.lead_cadences from anon,authenticated;
grant select on public.campaign_messages,public.lead_cadences to authenticated;

update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e resolvi entrar em contato porque trabalhamos com algo que pode fazer sentido para vocês.

Ajudamos empresas a usar tecnologia tanto para melhorar a forma como conquistam e atendem clientes quanto para simplificar processos que ainda dão trabalho no dia a dia.

Já desenvolvemos algumas soluções bem interessantes nesse sentido.

Posso te mostrar alguns exemplos ou, se preferir, me conta algo que você gostaria de melhorar hoje na {{empresa}} e eu te mostro o que poderíamos fazer. Sem compromisso nenhum!

O que prefere?$msg$ where name=$msg$Geral — Primeiro contato$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

O {{indicado_por}} comentou comigo sobre a {{empresa}} e me passou seu contato. Disse que poderia fazer sentido a gente conversar.

Eu trabalho desenvolvendo soluções digitais para empresas, desde presença digital até sistemas e automações para processos internos.

Posso te mostrar rapidamente alguns exemplos do que fazemos ou, se preferir, me conta algo que vocês gostariam de melhorar hoje na {{empresa}} e eu vejo se consigo contribuir com alguma ideia.

O que prefere?$msg$ where name=$msg$Indicação — Apresentação$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e queria compartilhar uma situação que encontramos com frequência.

Muitas empresas começam controlando a operação em planilhas porque é simples e funciona bem.

O problema é que, conforme a operação cresce, algumas dessas planilhas acabam virando praticamente um sistema — só que ainda dependem de atualização, conferência e acompanhamento manual.

Já transformamos controles assim em sistemas próprios.

Posso te mostrar um caso prático ou, se preferir, me conta uma planilha importante que vocês usam hoje na {{empresa}} e eu te mostro como ela poderia ser transformada em um sistema. Sem compromisso nenhum!

O que prefere?$msg$ where name=$msg$LOGÍSTICA — PLANILHAS$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e uma coisa me chamou atenção.

Existem alguns processos que muitas empresas mantêm manuais simplesmente porque sempre foram feitos assim — mas que hoje poderiam acontecer praticamente sozinhos.

Já fizemos esse tipo de trabalho em outras empresas.

Você prefere que eu te mostre um caso prático ou me conta um processo que hoje é manual na {{empresa}} e eu monto um esboço de como poderíamos automatizá-lo, sem compromisso?$msg$ where name=$msg$LOGÍSTICA — PROCESSOS$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e queria compartilhar uma situação que encontramos com frequência.

Em muitas empresas, a mesma informação acaba passando por várias pessoas e sendo copiada, conferida ou lançada mais de uma vez em planilhas, sistemas e WhatsApp.

São pequenas tarefas que parecem normais no dia a dia, mas que, quando se repetem várias vezes, acabam consumindo bastante tempo da equipe.

Já automatizamos processos justamente para eliminar esse tipo de retrabalho.

Posso te mostrar um caso prático ou, se preferir, me conta uma tarefa repetitiva que vocês têm hoje na {{empresa}} e eu te mostro como ela poderia ser simplificada. Sem compromisso nenhum!

O que prefere?$msg$ where name=$msg$LOGÍSTICA — RETRABALHO$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e vi que vocês utilizam as redes sociais para divulgar os serviços.

Notei um ponto no caminho entre alguém conhecer vocês pelo Instagram e realmente entrar em contato ou agendar.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$ where name=$msg$SAÚDE — LANDING PAGE$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e percebi que hoje vocês concentram bastante da presença digital nas redes sociais.

Notei um ponto que pode fazer diferença quando alguém conhece vocês pela primeira vez e começa a pesquisar mais antes de entrar em contato.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$ where name=$msg$SAÚDE — SEM SITE$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e acabei entrando no site de vocês.

Notei alguns pontos no caminho entre alguém conhecer os serviços, sentir segurança e realmente entrar em contato ou agendar.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$ where name=$msg$SAÚDE — TEM SITE$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} e vi que vocês trabalham com {{nicho}}.

Nesse tipo de serviço acontece algo interessante: muitas vezes a pessoa recebe uma indicação e, antes de entrar em contato, pesquisa a empresa para conhecer melhor o trabalho.

Notei um ponto na forma como a {{empresa}} aparece nesse momento de pesquisa.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$ where name=$msg$TÉCNICO — AUTORIDADE$msg$;
update public.message_templates set message=$msg$Oi! Tudo bem?

Meu nome é {{usuario}}.

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} na região.

Notei uma coisa na presença de vocês no Google que pode estar fazendo alguns clientes pesquisarem a empresa e acabarem procurando outro prestador.

Você prefere que eu te explique o que observei por aqui mesmo ou que eu te mostre uma sugestão visual?$msg$ where name=$msg$TÉCNICO — SEM SITE$msg$;
update public.message_templates set message=$msg$Oi, {{responsavel}}, tudo bem?

Meu nome é {{usuario}}.

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} na região e acabei entrando no site de vocês.

Notei alguns pontos que podem estar dificultando o caminho de quem entra no site até pedir um orçamento.

Posso te mostrar rapidamente o que observei?$msg$ where name=$msg$TÉCNICO — SITE EXISTENTE$msg$;
-- Geral — Primeiro contato
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e resolvi entrar em contato porque trabalhamos com algo que pode fazer sentido para vocês.

Ajudamos empresas a usar tecnologia tanto para melhorar a forma como conquistam e atendem clientes quanto para simplificar processos que ainda dão trabalho no dia a dia.

Já desenvolvemos algumas soluções bem interessantes nesse sentido.

Posso te mostrar alguns exemplos ou, se preferir, me conta algo que você gostaria de melhorar hoje na {{empresa}} e eu te mostro o que poderíamos fazer. Sem compromisso nenhum!

O que prefere?$msg$),
(1,$msg$Oi, {{responsavel}}!

Só para deixar mais claro o tipo de trabalho que comentei.

Normalmente ajudamos empresas em duas frentes:

De um lado, melhorar a presença digital e transformar mais pessoas interessadas em contatos.

Do outro, criar sistemas e automações para reduzir tarefas manuais e organizar processos internos.

Posso te mostrar um exemplo de cada frente ou, se preferir, me diz qual delas faria mais sentido hoje para a {{empresa}}.

O que prefere?$msg$),
(2,$msg${{responsavel}}, vou te dar alguns exemplos para ficar mais fácil visualizar.

Às vezes a oportunidade está em:

— receber mais contatos pelo site; — apresentar melhor os serviços da empresa; — facilitar pedidos de orçamento; — automatizar uma tarefa repetitiva; — substituir um controle que cresceu demais no Excel; — centralizar informações que hoje ficam espalhadas.

São projetos bem diferentes, mas todos têm algo em comum: usar tecnologia para facilitar alguma parte do negócio.

Posso te mostrar alguns exemplos que já desenvolvemos ou, se preferir, me fala qual desses pontos chamou mais sua atenção.

O que prefere?$msg$),
(3,$msg${{responsavel}}, uma coisa que fazemos quando identificamos uma oportunidade é transformar a ideia em algo mais visual antes mesmo de falar em projeto.

Pode ser o esboço de uma página, um fluxo de automação, uma tela de sistema ou uma sugestão de como organizar determinado processo.

Assim fica muito mais fácil entender se a ideia realmente faria sentido para a empresa.

Posso te mostrar um exemplo desse tipo de esboço ou, se preferir, me conta algo que gostaria de melhorar na {{empresa}} e eu penso em uma ideia para vocês.

O que prefere?$msg$),
(4,$msg$Um detalhe importante, {{responsavel}}:

Nem sempre uma melhoria precisa começar com um projeto grande.

Às vezes uma página específica, uma pequena automação ou um sistema simples para resolver um único processo já consegue gerar uma diferença interessante no dia a dia.

Por isso normalmente preferimos começar entendendo onde existe uma oportunidade e depois pensar na solução.

Posso te mostrar algumas soluções menores que podem ser implementadas primeiro ou, se preferir, me conta uma situação da {{empresa}} que você gostaria de simplificar.

O que prefere?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Entrei em contato porque acredito que tecnologia faz mais sentido quando resolve algo concreto — seja ajudando a empresa a conquistar mais clientes ou retirando trabalho manual da operação.

Então, se em algum momento vocês quiserem avaliar alguma ideia nesse sentido, fico à disposição.

Posso te deixar alguns exemplos do que desenvolvemos ou, se preferir, você me conta algo que gostaria de melhorar na {{empresa}} e eu te devolvo uma sugestão inicial. Sem compromisso nenhum!

O que prefere?$msg$)
) v(step,message) where t.name=$msg$Geral — Primeiro contato$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- Indicação — Apresentação
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

O {{indicado_por}} comentou comigo sobre a {{empresa}} e me passou seu contato. Disse que poderia fazer sentido a gente conversar.

Eu trabalho desenvolvendo soluções digitais para empresas, desde presença digital até sistemas e automações para processos internos.

Posso te mostrar rapidamente alguns exemplos do que fazemos ou, se preferir, me conta algo que vocês gostariam de melhorar hoje na {{empresa}} e eu vejo se consigo contribuir com alguma ideia.

O que prefere?$msg$),
(1,$msg$Oi, {{responsavel}}!

Só para contextualizar melhor o motivo do meu contato.

Nosso trabalho normalmente entra em duas situações:

Quando a empresa quer melhorar sua presença digital e gerar mais oportunidades de contato;

ou quando existe algum processo interno que poderia ser organizado, automatizado ou transformado em sistema.

Foi por trabalhar justamente nessas frentes que o {{indicado_por}} comentou sobre vocês comigo.

Posso te mostrar um exemplo de cada uma ou, se preferir, me diz qual dessas duas áreas faria mais sentido hoje para a {{empresa}}.

O que prefere?$msg$),
(2,$msg${{responsavel}}, uma coisa que gosto de fazer antes de falar em proposta é tornar a ideia mais concreta.

Dependendo da necessidade, consigo montar um esboço de página, uma tela de sistema ou até desenhar como determinado processo poderia funcionar com automação.

Assim vocês conseguem visualizar a ideia antes de decidir se vale a pena avançar.

Posso te mostrar um exemplo de algo que já fizemos ou, se preferir, me passa uma ideia/processo da {{empresa}} e eu penso em uma possibilidade para vocês.

O que prefere?

============================================================ MENSAGEM 5 — FOLLOW-UP 4 SUGESTÃO: ~4 A 5 DIAS APÓS O FOLLOW-UP 3 OBJETIVO: REDUZIR A BARREIRA DE ENTRADA ============================================================

Um ponto importante, {{responsavel}}:

Não precisa existir um projeto grande em mente para a gente conversar.

Às vezes uma oportunidade começa em algo bem específico: uma página que poderia converter melhor, uma planilha que ficou complexa ou uma tarefa que a equipe repete todos os dias.

A partir daí conseguimos avaliar se realmente existe algo que valha a pena desenvolver.

Posso te mandar algumas ideias de projetos menores ou, se preferir, me conta algo que hoje poderia ser mais simples na {{empresa}}.

O que prefere?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO + CANAL ABERTO ============================================================

{{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Como cheguei até você através do {{indicado_por}}, quis pelo menos me apresentar e deixar o canal aberto caso faça sentido conversarmos em algum momento.

Se surgir alguma ideia envolvendo presença digital, sistemas ou automação na {{empresa}}, pode contar comigo.

Posso te deixar alguns exemplos do nosso trabalho para você ter como referência ou, se preferir, me conta alguma ideia que vocês tenham por aí e eu te devolvo uma sugestão inicial. Sem compromisso nenhum!

O que prefere?$msg$),
(3,$msg${{responsavel}}, uma coisa que gosto de fazer antes de falar em proposta é tornar a ideia mais concreta.

Dependendo da necessidade, consigo montar um esboço de página, uma tela de sistema ou até desenhar como determinado processo poderia funcionar com automação.

Assim vocês conseguem visualizar a ideia antes de decidir se vale a pena avançar.

Posso te mostrar um exemplo de algo que já fizemos ou, se preferir, me passa uma ideia/processo da {{empresa}} e eu penso em uma possibilidade para vocês.

O que prefere?$msg$),
(4,$msg$Um ponto importante, {{responsavel}}:

Não precisa existir um projeto grande em mente para a gente conversar.

Às vezes uma oportunidade começa em algo bem específico: uma página que poderia converter melhor, uma planilha que ficou complexa ou uma tarefa que a equipe repete todos os dias.

A partir daí conseguimos avaliar se realmente existe algo que valha a pena desenvolver.

Posso te mandar algumas ideias de projetos menores ou, se preferir, me conta algo que hoje poderia ser mais simples na {{empresa}}.

O que prefere?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Como cheguei até você através do {{indicado_por}}, quis pelo menos me apresentar e deixar o canal aberto caso faça sentido conversarmos em algum momento.

Se surgir alguma ideia envolvendo presença digital, sistemas ou automação na {{empresa}}, pode contar comigo.

Posso te deixar alguns exemplos do nosso trabalho para você ter como referência ou, se preferir, me conta alguma ideia que vocês tenham por aí e eu te devolvo uma sugestão inicial. Sem compromisso nenhum!

O que prefere?$msg$)
) v(step,message) where t.name=$msg$Indicação — Apresentação$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- LOGÍSTICA — PLANILHAS
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e queria compartilhar uma situação que encontramos com frequência.

Muitas empresas começam controlando a operação em planilhas porque é simples e funciona bem.

O problema é que, conforme a operação cresce, algumas dessas planilhas acabam virando praticamente um sistema — só que ainda dependem de atualização, conferência e acompanhamento manual.

Já transformamos controles assim em sistemas próprios.

Posso te mostrar um caso prático ou, se preferir, me conta uma planilha importante que vocês usam hoje na {{empresa}} e eu te mostro como ela poderia ser transformada em um sistema. Sem compromisso nenhum!

O que prefere?$msg$),
(1,$msg$Oi, {{responsavel}}!

Só complementando o que te falei sobre as planilhas.

Quando uma planilha começa a ter várias abas, fórmulas, responsáveis, atualizações diárias e informações que outras pessoas precisam consultar, na prática ela já está fazendo o papel de um pequeno sistema.

A diferença é que muita coisa ainda depende de alguém alimentar, conferir e compartilhar manualmente.

Posso te mostrar um exemplo de uma planilha que virou sistema ou, se preferir, um modelo de dashboard que centraliza essas informações.

O que prefere?$msg$),
(2,$msg${{responsavel}}, alguns sinais costumam aparecer quando uma planilha começa a ficar pequena para o processo:

“não mexe nessa fórmula” “qual é a versão atual?” “faltou atualizar” “preciso juntar esses dados” “me manda a planilha depois”

Se alguma dessas situações acontece por aí, provavelmente existe uma oportunidade interessante de simplificar esse controle.

Posso te mostrar como essas situações ficam dentro de um sistema ou, se preferir, me conta qual controle em Excel mais exige trabalho hoje na {{empresa}} e eu penso em uma alternativa.

O que prefere?$msg$),
(3,$msg$Um detalhe importante, {{responsavel}}:

Quando uma empresa usa a mesma planilha há bastante tempo, ela normalmente já carrega algo muito valioso: as regras reais de como aquele processo funciona.

Então a ideia não é simplesmente jogar esse controle fora.

Podemos aproveitar o que já funciona e evoluir para uma solução com acessos, histórico, automações, indicadores e informações centralizadas.

Posso te mostrar um exemplo dessa evolução ou, se preferir, me passa um controle que vocês usam na {{empresa}} e eu te digo como eu estruturaria isso em um sistema.

O que prefere?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO + ENTREGA DE VALOR ============================================================

{{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Só queria deixar uma última ideia:

Se existe hoje na {{empresa}} alguma planilha que é essencial para a operação e precisa ser atualizada, conferida ou compartilhada constantemente, talvez ela já seja uma boa candidata para virar algo mais automatizado.

É exatamente esse tipo de projeto que desenvolvemos.

Posso te deixar um caso prático para consultar ou, se preferir, você me passa uma planilha/processo que usam hoje e eu monto um esboço de solução sem compromisso nenhum.

O que prefere?$msg$),
(4,$msg$Um detalhe importante, {{responsavel}}:

Quando uma empresa usa a mesma planilha há bastante tempo, ela normalmente já carrega algo muito valioso: as regras reais de como aquele processo funciona.

Então a ideia não é simplesmente jogar esse controle fora.

Podemos aproveitar o que já funciona e evoluir para uma solução com acessos, histórico, automações, indicadores e informações centralizadas.

Posso te mostrar um exemplo dessa evolução ou, se preferir, me passa um controle que vocês usam na {{empresa}} e eu te digo como eu estruturaria isso em um sistema.

O que prefere?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Só queria deixar uma última ideia:

Se existe hoje na {{empresa}} alguma planilha que é essencial para a operação e precisa ser atualizada, conferida ou compartilhada constantemente, talvez ela já seja uma boa candidata para virar algo mais automatizado.

É exatamente esse tipo de projeto que desenvolvemos.

Posso te deixar um caso prático para consultar ou, se preferir, você me passa uma planilha/processo que usam hoje e eu monto um esboço de solução sem compromisso nenhum.

O que prefere?$msg$)
) v(step,message) where t.name=$msg$LOGÍSTICA — PLANILHAS$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- LOGÍSTICA — PROCESSOS
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e uma coisa me chamou atenção.

Existem alguns processos que muitas empresas mantêm manuais simplesmente porque sempre foram feitos assim — mas que hoje poderiam acontecer praticamente sozinhos.

Já fizemos esse tipo de trabalho em outras empresas.

Você prefere que eu te mostre um caso prático ou me conta um processo que hoje é manual na {{empresa}} e eu monto um esboço de como poderíamos automatizá-lo, sem compromisso?$msg$),
(1,$msg$Oi, {{responsavel}}!

Só para deixar mais claro o tipo de processo que mencionei:

Imagine uma informação que chega pelo WhatsApp, alguém confere, lança em uma planilha ou sistema, avisa outra pessoa e depois precisa acompanhar até a conclusão.

Dependendo do processo, várias dessas etapas podem acontecer automaticamente.

E não necessariamente é preciso substituir os sistemas que a {{empresa}} já utiliza.

Você prefere que eu te mostre um exemplo de um processo antes e depois da automação ou me conta uma tarefa repetitiva daí e eu te mostro o que poderia ser automatizado?$msg$),
(2,$msg${{responsavel}}, uma forma simples de encontrar oportunidades de automação é observar algumas frases que se repetem no dia a dia:

“me manda no WhatsApp” “coloca na planilha” “avisa o responsável” “depois atualiza no sistema” “preciso conferir” “me cobra depois”

Quando uma dessas ações acontece várias vezes por dia, vale analisar se realmente precisa continuar dependendo de alguém para acontecer.

Você prefere que eu te envie alguns exemplos do que já pode ser automatizado hoje ou me conta qual dessas situações mais acontece na {{empresa}} e pensamos em cima dela?$msg$),
(3,$msg${{responsavel}}, vou te dar um exemplo bem simples.

Um processo que hoje funciona assim:

Solicitação → WhatsApp → conferência → planilha → responsável → atualização → acompanhamento.

Dependendo da operação, poderia funcionar assim:

Solicitação → registro automático → responsável acionado → atualização de status → gestão acompanha tudo em um único lugar.

O objetivo não é simplesmente colocar mais um sistema na empresa, mas retirar etapas que não precisam mais ser manuais.

Você prefere que eu te mostre esse fluxo visualmente ou me passa um processo da {{empresa}} para eu desenhar um exemplo mais próximo da realidade de vocês?$msg$),
(4,$msg$Um detalhe importante, {{responsavel}}:

Mesmo empresas que já possuem ERP, sistema de gestão ou outras ferramentas costumam manter algumas tarefas manuais entre uma etapa e outra.

Às vezes a oportunidade está justamente aí: integrar informações, disparar avisos automaticamente, gerar documentos, atualizar status ou centralizar acompanhamentos.

Ou seja, nem sempre é preciso trocar o que já funciona. Podemos atuar somente no processo que ainda gera trabalho manual.

Você prefere que eu te mostre um exemplo de automação integrada a um sistema existente ou um exemplo de solução criada para um processo específico?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Entrei em contato porque às vezes existe um processo que a equipe executa todos os dias e ninguém questiona muito, porque “sempre foi feito assim”.

É justamente aí que uma automação simples pode economizar várias etapas sem mudar toda a operação.

Se fizer sentido deixar algo para você avaliar, você prefere que eu te envie um caso prático ou me passa um processo manual da {{empresa}} e eu monto um esboço de solução sem compromisso?$msg$)
) v(step,message) where t.name=$msg$LOGÍSTICA — PROCESSOS$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- LOGÍSTICA — RETRABALHO
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} pesquisando empresas de {{nicho}} e queria compartilhar uma situação que encontramos com frequência.

Em muitas empresas, a mesma informação acaba passando por várias pessoas e sendo copiada, conferida ou lançada mais de uma vez em planilhas, sistemas e WhatsApp.

São pequenas tarefas que parecem normais no dia a dia, mas que, quando se repetem várias vezes, acabam consumindo bastante tempo da equipe.

Já automatizamos processos justamente para eliminar esse tipo de retrabalho.

Posso te mostrar um caso prático ou, se preferir, me conta uma tarefa repetitiva que vocês têm hoje na {{empresa}} e eu te mostro como ela poderia ser simplificada. Sem compromisso nenhum!

O que prefere?$msg$),
(1,$msg$Oi, {{responsavel}}!

Tem uma pergunta simples que ajuda bastante a encontrar esse tipo de retrabalho:

Depois que uma informação entra na empresa, quantas vezes alguém precisa mexer nela até o processo terminar?

Às vezes ela chega pelo WhatsApp, alguém copia para uma planilha, depois lança no sistema, avisa outra pessoa e mais tarde precisa atualizar tudo novamente.

Dependendo do processo, uma única entrada de informação poderia alimentar várias dessas etapas automaticamente.

Posso te mostrar um exemplo desse fluxo automatizado ou, se preferir, me conta como uma informação importante circula hoje na {{empresa}} e eu desenho uma alternativa.

O que prefere?$msg$),
(2,$msg${{responsavel}}, alguns sinais de retrabalho são tão comuns que acabam parecendo parte normal da operação:

“me manda de novo” “já lançou no sistema?” “atualiza a planilha também” “avisa no grupo” “preciso conferir antes” “depois consolida tudo”

O problema não é fazer isso uma vez.

É quando a equipe precisa repetir essas pequenas tarefas dezenas de vezes ao longo da semana.

Posso te mostrar como eliminar algumas dessas etapas ou, se preferir, me conta qual tarefa mais se repete por aí e eu penso em uma forma de simplificar.

O que prefere?$msg$),
(3,$msg${{responsavel}}, vou te dar um exemplo simples.

Hoje uma informação pode seguir assim:

Recebimento → conferência → planilha → sistema → WhatsApp → responsável → atualização.

Com uma automação, dependendo do processo:

Informação registrada uma vez → sistema atualiza → responsável recebe → status muda → gestão acompanha.

Ou seja: a equipe deixa de transportar a mesma informação manualmente de um lugar para outro.

Posso te mostrar esse antes e depois visualmente ou, se preferir, um exemplo de sistema que centraliza esse tipo de fluxo.

O que prefere?$msg$),
(4,$msg$Um detalhe importante, {{responsavel}}:

Eliminar retrabalho não significa necessariamente trocar os sistemas que a {{empresa}} já utiliza.

Muitas vezes podemos manter o que já funciona e automatizar justamente as etapas entre as ferramentas e as pessoas.

Pode ser um lançamento duplicado, envio de aviso, atualização de status, geração de documento, conferência ou consolidação de informações.

Posso te mostrar um exemplo de automação integrada ao que a empresa já usa ou, se preferir, você me passa uma tarefa repetitiva e eu monto um esboço de solução.

O que prefere?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Só queria deixar uma última reflexão:

Se alguém da equipe precisa copiar, conferir, lançar, atualizar ou repassar a mesma informação várias vezes, talvez exista uma oportunidade de fazer parte desse trabalho acontecer automaticamente.

É exatamente esse tipo de retrabalho que buscamos eliminar.

Posso te deixar um caso prático para consultar ou, se preferir, você me passa uma tarefa repetitiva da {{empresa}} e eu monto um esboço de como simplificaria esse fluxo. Sem compromisso nenhum!

O que prefere?$msg$)
) v(step,message) where t.name=$msg$LOGÍSTICA — RETRABALHO$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- SAÚDE — LANDING PAGE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e vi que vocês utilizam as redes sociais para divulgar os serviços.

Notei um ponto no caminho entre alguém conhecer vocês pelo Instagram e realmente entrar em contato ou agendar.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$),
(1,$msg$Oi, {{responsavel}}!

O ponto que observei é o seguinte:

Quando alguém vê um conteúdo ou anúncio sobre um procedimento, nem sempre essa pessoa está pronta para chamar no WhatsApp naquele momento.

Antes disso, ela pode querer entender melhor o procedimento, conhecer o profissional, ver avaliações, tirar dúvidas e sentir segurança para dar o próximo passo.

Quando todo esse caminho depende apenas do Instagram → WhatsApp, parte dessas informações acaba ficando espalhada.

Você prefere que eu te mostre como eu estruturaria esse caminho para a {{empresa}} ou um exemplo visual de como ele poderia funcionar?$msg$),
(2,$msg${{responsavel}}, pensando como alguém que acabou de conhecer a {{empresa}}:

Antes de entrar em contato, essa pessoa provavelmente quer responder algumas perguntas:

“Esse serviço é indicado para mim?” “Quem vai me atender?” “Posso confiar?” “Como funciona?” “Como faço para agendar?”

É justamente nesse intervalo entre descobrir vocês e tomar uma decisão que uma página específica pode ajudar.

Você prefere que eu te envie a estrutura que eu usaria para um dos serviços de vocês ou uma prévia visual de como essa página poderia ficar?$msg$),
(3,$msg$Um detalhe importante, {{responsavel}}:

A ideia não é substituir o Instagram.

É justamente aproveitar melhor o interesse que ele já gera.

A pessoa conhece o trabalho de vocês → acessa uma página específica → entende o serviço → conhece melhor o profissional → encontra respostas para as principais dúvidas → e então entra em contato ou agenda.

Assim, o WhatsApp recebe alguém muito mais informado sobre o serviço.

Você prefere que eu monte esse fluxo pensando no serviço mais procurado da {{empresa}} ou naquele que vocês mais gostariam de divulgar?$msg$),
(4,$msg${{responsavel}}, ao invés de ficar só te explicando essa ideia por mensagem, posso tornar isso mais prático.

Posso montar uma sugestão de página pensando na identidade da {{empresa}}, mostrando como eu organizaria apresentação, serviço, profissional, dúvidas e chamada para contato ou agendamento.

Assim você consegue avaliar a ideia aplicada ao trabalho de vocês, e não em um exemplo genérico.

Você prefere que eu prepare primeiro uma versão para celular ou uma versão para computador?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque vi que a {{empresa}} já produz conteúdo e gera interesse pelas redes sociais, e acredito que existe uma oportunidade de aproveitar melhor esse interesse antes de a pessoa chegar ao WhatsApp.

Antes de encerrar, posso deixar uma sugestão pronta para você avaliar quando tiver um tempo.

Você prefere receber uma prévia visual de como ficaria ou um resumo com a estrutura que eu recomendaria para a página?$msg$)
) v(step,message) where t.name=$msg$SAÚDE — LANDING PAGE$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- SAÚDE — SEM SITE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e percebi que hoje vocês concentram bastante da presença digital nas redes sociais.

Notei um ponto que pode fazer diferença quando alguém conhece vocês pela primeira vez e começa a pesquisar mais antes de entrar em contato.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$),
(1,$msg$Oi, {{responsavel}}!

O ponto que me chamou atenção foi o seguinte:

Na área da saúde, antes de entrar em contato, é natural que a pessoa queira conhecer melhor o profissional ou a clínica, entender os serviços, ver avaliações e encontrar informações que transmitam segurança.

Hoje, no caso da {{empresa}}, boa parte dessa validação acaba dependendo das redes sociais.

Um site próprio pode organizar essas informações em um único lugar e complementar o trabalho que vocês já fazem no Instagram.

Você prefere que eu te mostre quais informações eu priorizaria nesse site ou um exemplo visual de como ele poderia ficar?$msg$),
(2,$msg$Um ponto importante, {{responsavel}}:

Ter um site não significa deixar o Instagram de lado.

Os dois podem cumprir funções diferentes.

O Instagram ajuda alguém a descobrir e acompanhar o trabalho de vocês.

O site pode concentrar serviços, profissionais, informações importantes, localização, avaliações e caminhos para contato ou agendamento.

Assim, um canal fortalece o outro.

Você prefere que eu te mostre como conectaria Instagram + site + WhatsApp ou como estruturaria somente a página inicial da {{empresa}}?

============================================================ MENSAGEM 5 — FOLLOW-UP 4 SUGESTÃO: ~4 A 5 DIAS APÓS O FOLLOW-UP 3 OBJETIVO: DEMONSTRAÇÃO PERSONALIZADA ============================================================

{{responsavel}}, pensei em tornar essa ideia mais concreta.

Posso montar uma prévia de como eu imaginaria o site da {{empresa}}, seguindo a identidade e os serviços de vocês.

Não seria um modelo genérico de clínica: a ideia é mostrar como poderia ficar aplicado à realidade de vocês.

Você prefere que eu monte primeiro uma versão para celular ou uma versão para computador?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO COM CTA ============================================================

{{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque acredito que o trabalho que a {{empresa}} já apresenta nas redes sociais poderia ter também um espaço próprio para quem pesquisa vocês e quer conhecer melhor antes de entrar em contato.

Antes de encerrar, posso deixar uma ideia pronta para você avaliar quando tiver um tempo.

Você prefere receber uma prévia visual de como o site poderia ficar ou um resumo com a estrutura que eu recomendaria?$msg$),
(3,$msg$Um ponto importante, {{responsavel}}:

Ter um site não significa deixar o Instagram de lado.

Os dois podem cumprir funções diferentes.

O Instagram ajuda alguém a descobrir e acompanhar o trabalho de vocês.

O site pode concentrar serviços, profissionais, informações importantes, localização, avaliações e caminhos para contato ou agendamento.

Assim, um canal fortalece o outro.

Você prefere que eu te mostre como conectaria Instagram + site + WhatsApp ou como estruturaria somente a página inicial da {{empresa}}?$msg$),
(4,$msg${{responsavel}}, pensei em tornar essa ideia mais concreta.

Posso montar uma prévia de como eu imaginaria o site da {{empresa}}, seguindo a identidade e os serviços de vocês.

Não seria um modelo genérico de clínica: a ideia é mostrar como poderia ficar aplicado à realidade de vocês.

Você prefere que eu monte primeiro uma versão para celular ou uma versão para computador?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque acredito que o trabalho que a {{empresa}} já apresenta nas redes sociais poderia ter também um espaço próprio para quem pesquisa vocês e quer conhecer melhor antes de entrar em contato.

Antes de encerrar, posso deixar uma ideia pronta para você avaliar quando tiver um tempo.

Você prefere receber uma prévia visual de como o site poderia ficar ou um resumo com a estrutura que eu recomendaria?$msg$)
) v(step,message) where t.name=$msg$SAÚDE — SEM SITE$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- SAÚDE — TEM SITE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci o trabalho da {{empresa}} e acabei entrando no site de vocês.

Notei alguns pontos no caminho entre alguém conhecer os serviços, sentir segurança e realmente entrar em contato ou agendar.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$),
(1,$msg$Oi, {{responsavel}}!

O ponto que observei é que existe uma diferença entre um site que apresenta bem uma clínica e um site que também conduz quem está interessado até o próximo passo.

Na área da saúde, normalmente essa pessoa ainda quer entender o serviço, conhecer melhor o profissional, encontrar respostas para algumas dúvidas e sentir segurança antes de entrar em contato.

Foi olhando esse caminho que encontrei algumas oportunidades no site da {{empresa}}.

Você prefere que eu te mostre os 3 pontos que mais me chamaram atenção ou uma sugestão visual de como eu trabalharia esses pontos?$msg$),
(2,$msg$Um ponto importante, {{responsavel}}:

Encontrar oportunidades no site não significa necessariamente que vocês precisam descartar tudo e começar novamente.

Às vezes algumas mudanças estratégicas já podem melhorar bastante o caminho de quem acessa:

• apresentação dos serviços; • informações sobre os profissionais; • avaliações e elementos de confiança; • respostas para dúvidas importantes; • chamadas para WhatsApp ou agendamento.

A ideia é aproveitar o que a {{empresa}} já possui e identificar onde existem oportunidades de melhoria.

Você prefere que eu te mostre o que eu manteria no site atual ou o que eu priorizaria mudar primeiro?

============================================================ MENSAGEM 5 — FOLLOW-UP 4 SUGESTÃO: ~4 A 5 DIAS APÓS O FOLLOW-UP 3 OBJETIVO: DEMONSTRAÇÃO PERSONALIZADA ============================================================

{{responsavel}}, pensei em uma maneira mais prática de te mostrar isso.

Posso pegar uma parte do site atual da {{empresa}} e montar uma sugestão visual de como eu reorganizaria a experiência pensando em confiança, apresentação e contato/agendamento.

Assim você consegue comparar o atual com uma outra possibilidade antes de tomar qualquer decisão.

Você prefere que eu trabalhe primeiro a página inicial ou uma página de serviço/procedimento?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO COM CTA ============================================================

{{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque a {{empresa}} já possui uma presença digital construída, mas encontrei algumas oportunidades para fazer o site participar mais ativamente do caminho entre interesse, confiança e contato/agendamento.

Antes de encerrar, posso deixar essa análise pronta para você consultar quando tiver um tempo.

Você prefere receber um resumo dos principais pontos por aqui ou uma análise visual em PDF?$msg$),
(3,$msg$Um ponto importante, {{responsavel}}:

Encontrar oportunidades no site não significa necessariamente que vocês precisam descartar tudo e começar novamente.

Às vezes algumas mudanças estratégicas já podem melhorar bastante o caminho de quem acessa:

• apresentação dos serviços; • informações sobre os profissionais; • avaliações e elementos de confiança; • respostas para dúvidas importantes; • chamadas para WhatsApp ou agendamento.

A ideia é aproveitar o que a {{empresa}} já possui e identificar onde existem oportunidades de melhoria.

Você prefere que eu te mostre o que eu manteria no site atual ou o que eu priorizaria mudar primeiro?$msg$),
(4,$msg${{responsavel}}, pensei em uma maneira mais prática de te mostrar isso.

Posso pegar uma parte do site atual da {{empresa}} e montar uma sugestão visual de como eu reorganizaria a experiência pensando em confiança, apresentação e contato/agendamento.

Assim você consegue comparar o atual com uma outra possibilidade antes de tomar qualquer decisão.

Você prefere que eu trabalhe primeiro a página inicial ou uma página de serviço/procedimento?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque a {{empresa}} já possui uma presença digital construída, mas encontrei algumas oportunidades para fazer o site participar mais ativamente do caminho entre interesse, confiança e contato/agendamento.

Antes de encerrar, posso deixar essa análise pronta para você consultar quando tiver um tempo.

Você prefere receber um resumo dos principais pontos por aqui ou uma análise visual em PDF?$msg$)
) v(step,message) where t.name=$msg$SAÚDE — TEM SITE$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- TÉCNICO — AUTORIDADE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}! Tudo bem?

Meu nome é {{usuario}}.

Conheci a {{empresa}} e vi que vocês trabalham com {{nicho}}.

Nesse tipo de serviço acontece algo interessante: muitas vezes a pessoa recebe uma indicação e, antes de entrar em contato, pesquisa a empresa para conhecer melhor o trabalho.

Notei um ponto na forma como a {{empresa}} aparece nesse momento de pesquisa.

Você prefere que eu te explique o que observei por aqui ou que eu te mostre visualmente?$msg$),
(1,$msg$Oi, {{responsavel}}!

O ponto que me chamou atenção é que receber uma indicação não significa necessariamente que a decisão já foi tomada.

É comum a pessoa pesquisar o nome da empresa, olhar trabalhos realizados, serviços, avaliações e tentar entender se encontrou um prestador em quem pode confiar.

Ou seja: a indicação abre a porta, mas a presença digital ajuda a confirmar essa escolha.

Você prefere que eu te mostre como a {{empresa}} aparece hoje para quem faz essa pesquisa ou como eu estruturaria essa apresentação?$msg$),
(2,$msg$Um ponto importante, {{responsavel}}:

Instagram, Google e WhatsApp são ótimos canais, mas cada um mostra apenas uma parte da empresa.

Um espaço próprio permite reunir em um único lugar:

• serviços; • trabalhos realizados; • avaliações; • regiões atendidas; • diferenciais; • informações da empresa; • e um caminho direto para orçamento.

Assim, quando alguém recebe uma indicação, encontra uma apresentação organizada para validar a confiança que já veio de outra pessoa.

Você prefere que eu te mostre como eu organizaria essas informações para a {{empresa}} ou uma sugestão visual de como essa apresentação poderia ficar?

============================================================ MENSAGEM 5 — FOLLOW-UP 4 SUGESTÃO: ~4 A 5 DIAS APÓS O FOLLOW-UP 3 OBJETIVO: DEMONSTRAÇÃO PERSONALIZADA ============================================================

{{responsavel}}, pensei em tornar isso mais prático.

Posso montar uma prévia de como eu apresentaria a {{empresa}} para alguém que acabou de receber uma indicação e está pesquisando vocês pela primeira vez.

A ideia seria trabalhar principalmente autoridade, serviços, trabalhos realizados e facilidade para pedir orçamento.

Assim você consegue avaliar a ideia aplicada à própria empresa, em vez de olhar um exemplo genérico.

Você prefere que eu monte primeiro uma versão para celular ou uma versão para computador?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO COM CTA ============================================================

{{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque acredito que a autoridade que a {{empresa}} já construiu através de indicações pode ser melhor aproveitada quando alguém pesquisa vocês antes de entrar em contato.

Antes de encerrar, posso deixar uma ideia pronta para você avaliar quando tiver um tempo.

Você prefere receber uma prévia visual de como eu apresentaria a {{empresa}} ou um resumo dos principais pontos por aqui?$msg$),
(3,$msg$Um ponto importante, {{responsavel}}:

Instagram, Google e WhatsApp são ótimos canais, mas cada um mostra apenas uma parte da empresa.

Um espaço próprio permite reunir em um único lugar:

• serviços; • trabalhos realizados; • avaliações; • regiões atendidas; • diferenciais; • informações da empresa; • e um caminho direto para orçamento.

Assim, quando alguém recebe uma indicação, encontra uma apresentação organizada para validar a confiança que já veio de outra pessoa.

Você prefere que eu te mostre como eu organizaria essas informações para a {{empresa}} ou uma sugestão visual de como essa apresentação poderia ficar?$msg$),
(4,$msg${{responsavel}}, pensei em tornar isso mais prático.

Posso montar uma prévia de como eu apresentaria a {{empresa}} para alguém que acabou de receber uma indicação e está pesquisando vocês pela primeira vez.

A ideia seria trabalhar principalmente autoridade, serviços, trabalhos realizados e facilidade para pedir orçamento.

Assim você consegue avaliar a ideia aplicada à própria empresa, em vez de olhar um exemplo genérico.

Você prefere que eu monte primeiro uma versão para celular ou uma versão para computador?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque acredito que a autoridade que a {{empresa}} já construiu através de indicações pode ser melhor aproveitada quando alguém pesquisa vocês antes de entrar em contato.

Antes de encerrar, posso deixar uma ideia pronta para você avaliar quando tiver um tempo.

Você prefere receber uma prévia visual de como eu apresentaria a {{empresa}} ou um resumo dos principais pontos por aqui?$msg$)
) v(step,message) where t.name=$msg$TÉCNICO — AUTORIDADE$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- TÉCNICO — SEM SITE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi! Tudo bem?

Meu nome é {{usuario}}.

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} na região.

Notei uma coisa na presença de vocês no Google que pode estar fazendo alguns clientes pesquisarem a empresa e acabarem procurando outro prestador.

Você prefere que eu te explique o que observei por aqui mesmo ou que eu te mostre uma sugestão visual?$msg$),
(1,$msg$Oi! Vou te deixar um dado que explica por que te chamei.

Uma pesquisa recente mostrou que 84% dos consumidores pesquisaram empresas locais pela internet nos últimos 3 meses.

E tem um detalhe interessante: depois de encontrar avaliações positivas, 54% ainda vão até o site da empresa para conhecer melhor antes de decidir.

No caso da {{empresa}}, hoje quem procura vocês encontra outras informações, mas não encontra um site próprio para fazer essa validação.

Foi esse ponto que me chamou atenção.

Você prefere que eu te mostre como isso pode impactar a busca pela {{empresa}} ou um exemplo visual de como a página da sua empresa pode ficar?$msg$),
(2,$msg$Tive uma ideia.

Ao invés de ficar tentando te explicar por mensagem como um site poderia ajudar a {{empresa}}, posso montar uma prévia visual de como eu estruturaria a página de vocês.

Sem compromisso.

Aí você consegue olhar e decidir se faria sentido ou não para a empresa.

Você prefere que eu monte primeiro uma prévia visual da página ou um resumo com a estrutura recomendada?

============================================================ MENSAGEM 5 — FOLLOW-UP 4 SUGESTÃO: ~4 A 5 DIAS APÓS O FOLLOW-UP 3 OBJETIVO: QUEBRA DE OBJEÇÃO ============================================================

Uma coisa que escuto bastante é:

“Mas meus clientes já chegam pelo Instagram/indicação.”

E isso é ótimo.

O site não precisa substituir esses canais.

Ele pode funcionar justamente para a pessoa que recebeu uma indicação da {{empresa}}, pesquisou o nome de vocês no Google e quer confirmar se encontrou uma empresa profissional antes de chamar.

É mais sobre não perder quem já está procurando vocês do que depender do site para conseguir todos os clientes.

Você prefere que eu te mostre como uma página poderia complementar o Instagram da {{empresa}} ou como ela pode ajudar quem chega por indicação?

============================================================ MENSAGEM 6 — FOLLOW-UP 5 SUGESTÃO: ~5 A 7 DIAS APÓS O FOLLOW-UP 4 OBJETIVO: ENCERRAMENTO ELEGANTE ============================================================

Vou encerrar meus contatos por aqui para não ficar enchendo seu WhatsApp. 😅

Só quis te procurar porque realmente acredito que a {{empresa}} tem espaço para apresentar melhor o trabalho de vocês quando alguém pesquisa pela empresa na internet.

Antes de encerrar, posso deixar uma ideia pronta para você consultar quando quiser.

Você prefere receber uma sugestão visual da página ou um resumo dos principais pontos por aqui mesmo?

Abraço! {{usuario}}$msg$),
(3,$msg$Tive uma ideia.

Ao invés de ficar tentando te explicar por mensagem como um site poderia ajudar a {{empresa}}, posso montar uma prévia visual de como eu estruturaria a página de vocês.

Sem compromisso.

Aí você consegue olhar e decidir se faria sentido ou não para a empresa.

Você prefere que eu monte primeiro uma prévia visual da página ou um resumo com a estrutura recomendada?$msg$),
(4,$msg$Vou encerrar meus contatos por aqui para não ficar enchendo seu WhatsApp. 😅

Só quis te procurar porque realmente acredito que a {{empresa}} tem espaço para apresentar melhor o trabalho de vocês quando alguém pesquisa pela empresa na internet.

Antes de encerrar, posso deixar uma ideia pronta para você consultar quando quiser.

Você prefere receber uma sugestão visual da página ou um resumo dos principais pontos por aqui mesmo?

Abraço! {{usuario}}$msg$),
(5,$msg$Vou encerrar meus contatos por aqui para não ficar enchendo seu WhatsApp. 😅

Só quis te procurar porque realmente acredito que a {{empresa}} tem espaço para apresentar melhor o trabalho de vocês quando alguém pesquisa pela empresa na internet.

Antes de encerrar, posso deixar uma ideia pronta para você consultar quando quiser.

Você prefere receber uma sugestão visual da página ou um resumo dos principais pontos por aqui mesmo?

Abraço! {{usuario}}$msg$)
) v(step,message) where t.name=$msg$TÉCNICO — SEM SITE$msg$
on conflict(template_id,step) do update set message=excluded.message;
-- TÉCNICO — SITE EXISTENTE
insert into public.campaign_messages(template_id,step,message)
select t.id,v.step,v.message from public.message_templates t cross join (values
(0,$msg$Oi, {{responsavel}}, tudo bem?

Meu nome é {{usuario}}.

Encontrei a {{empresa}} pesquisando empresas de {{nicho}} na região e acabei entrando no site de vocês.

Notei alguns pontos que podem estar dificultando o caminho de quem entra no site até pedir um orçamento.

Posso te mostrar rapidamente o que observei?$msg$),
(1,$msg$Oi, {{responsavel}}.

Só para contextualizar melhor o motivo da minha mensagem:

Ter um site é importante, mas existe uma diferença grande entre ele apenas apresentar a empresa e realmente ajudar a gerar pedidos de orçamento.

Quando analiso um site de serviços, normalmente olho 3 pontos:

• se fica claro rapidamente o que a empresa faz; • se existem elementos que passam confiança; • e se é fácil para o visitante pedir um orçamento.

Foi olhando esses pontos que encontrei algumas oportunidades no site da {{empresa}}.

Você prefere que eu te envie uma análise completa em PDF ou um resumo dos principais pontos por aqui mesmo?$msg$),
(2,$msg${{responsavel}}, tem um teste bem simples que costumo fazer quando analiso um site de serviços.

Entro como se fosse um cliente que nunca conheceu a empresa e tento responder rapidamente:

“O que eles fazem?” “Por que eu deveria confiar neles?” “Como peço um orçamento agora?”

Se essas respostas não aparecem com facilidade, o visitante pode simplesmente voltar para o Google e continuar procurando.

Fiz esse exercício olhando o site da {{empresa}}.

Quer que eu te mostre os 3 pontos que mais me chamaram atenção?$msg$),
(3,$msg${{responsavel}}, pensei em uma forma ainda mais prática de te mostrar isso.

Posso pegar a página principal da {{empresa}} e montar uma sugestão visual de como eu reorganizaria alguns desses pontos.

Sem compromisso e sem precisar alterar o site atual.

Assim você consegue colocar o atual e a sugestão lado a lado e avaliar a diferença.

Você prefere que eu faça uma sugestão visual da página ou te mande primeiro os pontos que eu mudaria?$msg$),
(4,$msg$Um ponto importante, {{responsavel}}:

Melhorar um site não significa necessariamente jogar tudo fora e começar novamente.

Às vezes algumas mudanças pontuais já fazem bastante diferença:

• deixar a proposta da empresa mais clara; • destacar melhor os principais serviços; • reforçar avaliações, trabalhos e outros sinais de confiança; • facilitar o pedido de orçamento pelo WhatsApp.

A ideia é primeiro identificar onde estão as oportunidades e aproveitar o que a {{empresa}} já construiu.

Se eu tivesse que te apontar somente as 3 mudanças que eu priorizaria no site hoje, você gostaria que eu te enviasse?$msg$),
(5,$msg${{responsavel}}, vou encerrar meus contatos por aqui para não ficar insistindo no seu WhatsApp. 😅

Te procurei porque vi que a {{empresa}} já tem uma presença digital construída e encontrei algumas oportunidades que podem ajudar o site a trabalhar melhor na geração de contatos.

Antes de encerrar, posso te deixar essa análise pronta para você consultar quando quiser.

Prefere que eu envie por aqui mesmo ou em PDF?$msg$)
) v(step,message) where t.name=$msg$TÉCNICO — SITE EXISTENTE$msg$
on conflict(template_id,step) do update set message=excluded.message;

-- Existing contacted leads with a recorded approach start at the first follow-up.
insert into public.lead_cadences(lead_id,user_id,template_id,campaign_name,status,current_step,total_followups,started_at,last_sent_at)
select distinct on (a.lead_id) a.lead_id,a.user_id,a.template_id,a.template_name,'IN_PROGRESS',0,5,a.confirmed_at,a.confirmed_at
from public.lead_approaches a join public.leads l on l.id=a.lead_id
where l.stage='CONTATADO' and a.template_id is not null
order by a.lead_id,a.confirmed_at desc
on conflict(lead_id) do nothing;

-- First approach now starts a durable cadence tied to the selected campaign.
create or replace function public.confirm_approach(p_id uuid,p_lead uuid,p_template uuid,p_message text,p_phone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare l public.leads; t public.message_templates; previous public.lead_approaches; interaction uuid; total integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or (l.owner_id<>auth.uid() and not public.is_admin()) then raise exception 'Lead unavailable'; end if;
 select * into previous from public.lead_approaches where id=p_id;
 if found then return previous.id; end if;
 select * into t from public.message_templates where id=p_template and user_id=auth.uid() and is_active;
 if not found then raise exception 'Template unavailable'; end if;
 if p_message is null or length(trim(p_message)) not between 1 and 8000 or p_message ~ '\{{2}[^}}]*\}{2}' then raise exception 'Invalid message'; end if;
 if p_phone is null or p_phone !~ '^[1-9][0-9]{{9,14}}$' then raise exception 'Invalid phone'; end if;
 insert into public.lead_interactions(lead_id,actor_id,type,description) values(l.id,auth.uid(),'WhatsApp','Primeira abordagem comercial enviada.') returning id into interaction;
 insert into public.lead_approaches(id,lead_id,user_id,template_id,template_name,template_group,message,phone,niche,product_id,interaction_id)
 values(p_id,l.id,auth.uid(),t.id,t.name,t.niche_group,p_message,p_phone,l.niche,l.product_id,interaction);
 select greatest(count(*)-1,0)::integer into total from public.campaign_messages where template_id=t.id;
 insert into public.lead_cadences(lead_id,user_id,template_id,campaign_name,status,current_step,total_followups,started_at,last_sent_at)
 values(l.id,auth.uid(),t.id,t.name,'IN_PROGRESS',0,greatest(total,1),now(),now())
 on conflict(lead_id) do update set user_id=excluded.user_id,template_id=excluded.template_id,campaign_name=excluded.campaign_name,status='IN_PROGRESS',current_step=0,total_followups=excluded.total_followups,started_at=now(),last_sent_at=now(),next_followup_at=null,updated_at=now();
 perform set_config('crm.approach_reason','Primeira abordagem enviada via WhatsApp.',true);
 update public.leads set first_contact_at=coalesce(first_contact_at,now()),stage=case when stage='NOVO LEAD' then 'CONTATADO'::public.lead_stage else stage end where id=l.id;
 perform set_config('crm.approach_reason','',true);
 return p_id;
end; $$;

create function public.confirm_cadence_followup(p_id uuid,p_lead uuid,p_message text,p_phone text) returns integer
language plpgsql security definer set search_path='' as $$
declare l public.leads; c public.lead_cadences; interaction uuid; next_step integer; existing public.lead_approaches;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into l from public.leads where id=p_lead for update;
 if not found or l.stage<>'CONTATADO' then raise exception 'Lead unavailable for follow-up'; end if;
 if l.owner_id<>auth.uid() and not public.is_admin() then raise exception 'Lead unavailable'; end if;
 select * into c from public.lead_cadences where lead_id=p_lead for update;
 if not found or c.status<>'IN_PROGRESS' then raise exception 'Cadence unavailable'; end if;
 select * into existing from public.lead_approaches where id=p_id;
 if found then return c.current_step; end if;
 next_step:=c.current_step+1;
 if next_step>c.total_followups then raise exception 'Cadence completed'; end if;
 if p_message is null or length(trim(p_message)) not between 1 and 8000 or p_message ~ '\{{2}[^}}]*\}{2}' then raise exception 'Invalid message'; end if;
 if p_phone is null or p_phone !~ '^[1-9][0-9]{{9,14}}$' then raise exception 'Invalid phone'; end if;
 insert into public.lead_interactions(lead_id,actor_id,type,description) values(l.id,auth.uid(),'Follow-up','Follow-up '||next_step||' enviado · '||c.campaign_name) returning id into interaction;
 insert into public.lead_approaches(id,lead_id,user_id,template_id,template_name,template_group,message,phone,niche,product_id,interaction_id)
 select p_id,l.id,auth.uid(),t.id,t.name,t.niche_group,p_message,p_phone,l.niche,l.product_id,interaction from public.message_templates t where t.id=c.template_id;
 update public.lead_cadences set current_step=next_step,last_sent_at=now(),next_followup_at=null,status=case when next_step>=total_followups then 'COMPLETED' else 'IN_PROGRESS' end,updated_at=now() where lead_id=p_lead;
 update public.leads set next_action='',next_action_at=null where id=p_lead;
 return next_step;
end; $$;

create function public.schedule_cadence_followup(p_lead uuid,p_at timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.lead_cadences; n integer;
begin
 if p_at is null or p_at<=now() then raise exception 'Choose a future date'; end if;
 select * into c from public.lead_cadences where lead_id=p_lead for update;
 if not found or c.status<>'IN_PROGRESS' then return false; end if;
 n:=c.current_step+1;
 update public.lead_cadences set next_followup_at=p_at,updated_at=now() where lead_id=p_lead;
 update public.leads set next_action='Follow-up '||n||' WhatsApp',next_action_at=p_at where id=p_lead and stage='CONTATADO';
 return found;
end; $$;

create function public.sync_cadence_stage() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.stage='CONTATADO' and new.stage is distinct from old.stage then
  update public.lead_cadences set status=case when new.stage='RESPONDEU' then 'RESPONDED' else 'PAUSED' end,next_followup_at=null,updated_at=now() where lead_id=new.id and status='IN_PROGRESS';
  if new.stage='RESPONDEU' then new.next_action:=''; new.next_action_at:=null; end if;
 end if;
 return new;
end; $$;
create trigger cadence_stage before update of stage on public.leads for each row execute function public.sync_cadence_stage();

-- Replace listing view so pipeline filters can query cadence state directly.
drop view if exists public.lead_listing;
create view public.lead_listing with (security_invoker=true) as
select l.*,p.name as product_name,lower(l.company) as company_sort,lower(l.contact_name) as contact_sort,lower(l.creator_name) as creator_sort,lower(p.name) as product_sort,
 c.status as cadence_status,c.current_step as cadence_step,c.total_followups as cadence_total,c.campaign_name as cadence_campaign,c.next_followup_at as cadence_next_at
from public.leads l left join public.products p on p.id=l.product_id left join public.lead_cadences c on c.lead_id=l.id;
revoke all on public.lead_listing from anon; grant select on public.lead_listing to authenticated;

revoke all on function public.confirm_cadence_followup(uuid,uuid,text,text),public.schedule_cadence_followup(uuid,timestamptz),public.sync_cadence_stage() from public;
grant execute on function public.confirm_cadence_followup(uuid,uuid,text,text),public.schedule_cadence_followup(uuid,timestamptz) to authenticated;
