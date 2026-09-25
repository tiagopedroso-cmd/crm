import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("demo@inovalogix.test");
  await page.getByLabel("Senha", { exact: true }).fill("Demo123!");
  await page.getByRole("button", { name: "Entrar no CRM" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos fazer acontecer, Tiago." }),
  ).toBeVisible();
});
test("dashboard, navegação e responsividade", async ({ page }, testInfo) => {
  await expect(page.locator("body")).not.toContainText("NaN");
  await expect(
    page.getByText("Agenda de hoje", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Não foi possível carregar",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `artifacts/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  for (const [route, title] of [
    ["/leads", "Meus leads"],
    ["/pipeline", "Pipeline comercial"],
    ["/placar", "Placar comercial"],
    ["/relatorios", "Relatórios comerciais"],
    ["/configuracoes", "Configurações"],
    ["/agenda", "Agenda de hoje"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: title, exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Não foi possível carregar",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator(".sidebar")).toBeInViewport();
    await page
      .getByRole("button", { name: "Fechar menu", exact: true })
      .click();
  }
});
test("arraste salva etapa e desfaz movimento quando a API falha", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Arraste de mouse; seletor é verificado nos outros dispositivos.",
  );
  await page.goto("/pipeline");
  const card = page
    .locator(".draggable")
    .filter({ hasText: "Clínica Sorriso" });
  await expect(card).toBeVisible();
  async function dragTo(stage: string) {
    const handle = card.getByRole("button", {
      name: "Arrastar Clínica Sorriso",
    });
    const target = page
      .locator(".kanban-column")
      .filter({ has: page.getByRole("heading", { name: stage, exact: true }) });
    const a = await handle.boundingBox(),
      b = await target.boundingBox();
    if (!a || !b) throw new Error("Área de arraste ausente");
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2, {
      steps: 3,
    });
    await page.mouse.move(b.x + b.width / 2, b.y + 100, { steps: 20 });
    await page.mouse.up();
  }
  await dragTo("contatado");
  await expect(page.locator('.notice[role="status"]')).toContainText(
    "etapa atualizada",
  );
  await expect(card.getByRole("combobox")).toHaveValue("CONTATADO");
  await page.route("**/rest/v1/leads?*", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: '{"message":"Falha simulada"}',
      });
    else await route.continue();
  });
  await dragTo("respondeu");
  await expect(page.locator('.notice[role="status"]')).toContainText(
    "movimento foi desfeito",
  );
  await expect(card.getByRole("combobox")).toHaveValue("CONTATADO");
  await page.unroute("**/rest/v1/leads?*");
  await page.reload();
  await expect(card.getByRole("combobox")).toHaveValue("CONTATADO");
});
test("metas, propostas, pós-venda e CSV", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Fluxo complementar de negócio.",
  );
  await page.goto("/configuracoes");
  await page.getByLabel("Leads por dia", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Salvar metas" }).click();
  await expect(page.getByRole("status")).toContainText("Configuração salva");
  await page.reload();
  await expect(page.getByLabel("Leads por dia", { exact: true })).toHaveValue(
    "25",
  );
  await page.goto("/leads");
  await page.getByLabel("Pesquisar leads").fill("Clínica Sorriso");
  await page.locator("a.company-link:visible").first().click();
  await page.getByRole("button", { name: "Propostas", exact: true }).click();
  await page.getByLabel("Nome da proposta").fill("Site institucional");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "Registrar proposta" }).click();
  await expect(page.locator(".proposal-list")).toContainText(
    "Site institucional",
  );
  await page
    .getByLabel("Status da proposta Site institucional")
    .selectOption("Aceita");
  await page.getByRole("button", { name: "Pós-venda", exact: true }).click();
  await page.getByLabel("Projeto iniciado", { exact: true }).check();
  await expect(
    page.getByLabel("Projeto iniciado", { exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Pós-venda", exact: true }).click();
  await expect(
    page.getByLabel("Projeto iniciado", { exact: true }),
  ).toBeChecked();
  await page.goto("/leads");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await download).suggestedFilename()).toBe("inovalogix-leads.csv");
});
test("cadastro, edição, interação, agendamento, fechamento e exclusão", async ({
  page,
}, testInfo) => {
  const company = `Empresa QA ${testInfo.project.name} ${Date.now()}`;
  await page.getByRole("button", { name: "Novo lead", exact: true }).click();
  await page.getByLabel("Empresa *", { exact: true }).fill(company);
  await page.getByRole("button", { name: "Cadastrar lead" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/leads");
  await page.getByLabel("Pesquisar leads").fill(company);
  await page
    .locator("a.company-link:visible")
    .filter({ hasText: company })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: company, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: company, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome do contato").fill("Contato QA");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Contato QA · Localização não informada"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova interação", exact: true })
    .click();
  await page
    .getByLabel("Como foi a conversa?")
    .fill("Cliente precisa de uma landing page.");
  await page
    .locator("#lead-activity")
    .getByRole("button", { name: "Registrar interação" })
    .click();
  await expect(
    page.getByText("Cliente precisa de uma landing page."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Próxima ação", exact: true }).click();
  await page.getByLabel("Ação", { exact: true }).fill("Reunião de diagnóstico");
  await page
    .getByLabel("Data e hora (Brasília)", { exact: true })
    .fill("2026-09-25T10:00");
  await page.getByRole("button", { name: "Agendar próximo passo" }).click();
  await expect(
    page
      .locator(".detail-summary")
      .getByRole("heading", { name: "Reunião de diagnóstico" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Concluir ação de " + company, exact: true })
    .click();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await expect(
    page.getByLabel("Data de conclusão", { exact: true }),
  ).toHaveValue(today);
  await page
    .getByLabel("Data de conclusão", { exact: true })
    .fill("2026-09-20");
  await page.getByLabel("Nova ação (opcional)").fill("Enviar proposta QA");
  await page
    .getByLabel("Data e hora da nova ação (Brasília)")
    .fill("2026-09-28T10:00");
  await page.getByRole("button", { name: "Confirmar conclusão" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByText("Ação concluída: Reunião de diagnóstico", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".detail-summary")
      .getByRole("heading", { name: "Enviar proposta QA" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Concluir ação de " + company, exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar conclusão" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Concluir ação de " + company,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ação concluída: Enviar proposta QA", { exact: true }),
  ).toBeVisible();
  await page.getByLabel(`Etapa de ${company}`).selectOption("PERDIDO");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Motivo da perda *").fill("Preço");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Motivo da perda: Preço")).toBeVisible();
  await page.getByLabel(`Etapa de ${company}`).selectOption("FECHADO");
  await page.getByLabel("Valor fechado (R$) *").fill("1200");
  await page.getByLabel("Forma de pagamento *").fill("Pix");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText(/Negócio fechado · R\$/)).toContainText(
    "1.200,00",
  );
  await page.getByRole("button", { name: "Excluir lead", exact: true }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await page.getByLabel("Pesquisar leads").fill(company);
  await expect(
    page.getByRole("heading", { name: "Nenhum resultado" }),
  ).toBeVisible();
});
test("logout bloqueia retorno à área comercial", async ({ page }, testInfo) => {
  if (await page.getByRole("button", { name: "Abrir menu" }).isVisible())
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("autoria, filtros e ordenação dos leads", async ({ page }, testInfo) => {
  await page.goto("/leads");
  await expect(page.getByLabel("Ordenar por", { exact: true })).toHaveValue(
    "company_sort",
  );
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByLabel("Cadastrado por", { exact: true })
    .selectOption({ label: "Tiago" });
  await expect(
    page.locator(
      testInfo.project.name === "desktop"
        ? ".table-desktop tbody"
        : ".mobile-leads",
    ),
  ).toContainText("Tiago");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/rest/v1/lead_listing") &&
      r.url().includes("order=") &&
      decodeURIComponent(r.url()).includes("potential_value.desc"),
  );
  await page
    .getByLabel("Ordenar por", { exact: true })
    .selectOption("potential_value");
  await page.getByRole("button", { name: "Crescente ↑", exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  if (testInfo.project.name === "desktop") {
    await page.getByRole("button", { name: /Empresa \/ contato/ }).click();
    await expect(
      page.getByRole("columnheader", { name: /Empresa \/ contato/ }),
    ).toHaveAttribute("aria-sort", "ascending");
  }
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(page.getByLabel("Cadastrado por", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Ordenar por", { exact: true })).toHaveValue(
    "company_sort",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
