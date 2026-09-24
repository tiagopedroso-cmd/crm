import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Never contact WhatsApp during tests; exercise the actual link and confirmation UI.
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, body: "WhatsApp de teste" }),
  );
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("demo@inovalogix.test");
  await page.getByLabel("Senha", { exact: true }).fill("Demo123!");
  await page.getByRole("button", { name: "Entrar no CRM" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos fazer acontecer, Tiago." }),
  ).toBeVisible();
});
test("abordagem individual, confirmação e follow-up sem sobrescrita silenciosa", async ({
  page,
  context,
}, info) => {
  await page.goto("/leads");
  await page
    .getByRole("button", {
      name: /^(Enviar abordagem|WhatsApp) para Clínica Sorriso$/,
    })
    .filter({ visible: true })
    .click();
  const dialog = page.getByRole("dialog");
  const message = dialog.getByLabel("Mensagem personalizada");
  await expect(message).toHaveValue(/Oi, Ana Oliveira/);
  await expect(message).toHaveValue(/Clínica Sorriso/);
  await expect(dialog.getByLabel("Modelo")).toHaveValue(/.+/);
  const rendered = await message.inputValue();
  expect(rendered).toContain("não têm um site próprio");
  const text = "Olá, Ana! Uma conversa para Clínica Sorriso & equipe.";
  await message.fill(text);
  await dialog.getByRole("button", { name: "Copiar mensagem" }).click();
  await expect(dialog.getByRole("status")).toContainText("Mensagem copiada");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
  const link = dialog.getByRole("link", { name: "Enviar pelo WhatsApp" });
  const url = new URL((await link.getAttribute("href"))!);
  expect(url.pathname).toBe("/5511999998888");
  expect(url.searchParams.get("text")).toBe(text);
  await page.screenshot({
    path: `artifacts/approach-${info.project.name}.png`,
    fullPage: true,
  });
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  const popup = context.waitForEvent("page");
  await link.click();
  await (await popup).close();
  await expect(
    dialog.getByRole("heading", {
      name: "WhatsApp aberto. A mensagem foi enviada?",
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Não / Voltar" }).click();
  await expect(message).toHaveValue(text);
  const popup2 = context.waitForEvent("page");
  await link.click();
  await (await popup2).close();
  await dialog.getByRole("button", { name: "Sim, registrar envio" }).click();
  await expect(
    dialog.getByRole("heading", {
      name: "Envio registrado. Agendar primeiro follow-up?",
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Agendar", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Confirmo substituir esta próxima ação.").check();
  await dialog.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("link", { name: "Clínica Sorriso", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clínica Sorriso", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Etapa de Clínica Sorriso")).toHaveValue(
    "CONTATADO",
  );
  await expect(page.locator(".timeline")).toContainText(
    "Primeira abordagem comercial enviada.",
  );
  await expect(page.locator(".timeline")).toContainText(text);
  await expect(page.locator(".timeline")).toContainText(
    "Primeira abordagem enviada via WhatsApp.",
  );
  await expect(page.locator("body")).toContainText("1º follow-up WhatsApp");
});
test("configurações de modelos, variável, duplicação e exclusão", async ({
  page,
}, info) => {
  const name = `Modelo teste ${info.project.name}`;
  await page.goto("/configuracoes");
  await page
    .getByRole("button", { name: "Criar template", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do modelo").fill(name);
  await dialog.getByLabel("Texto do modelo").fill("Olá ");
  await dialog.getByLabel("Variável disponível").selectOption("responsavel");
  await dialog.getByRole("button", { name: "Inserir variável" }).click();
  await expect(dialog.getByLabel("Texto do modelo")).toHaveValue(
    "Olá {{responsavel}}",
  );
  await dialog.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(dialog).not.toBeVisible();
  let row = page
    .locator(".template-row")
    .filter({ has: page.getByText(name, { exact: true }) });
  await row.getByRole("button", { name: "Definir padrão" }).click();
  await expect(row).toContainText("Padrão");
  await row.getByRole("button", { name: "Duplicar" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nome do modelo")).toHaveValue(
    name + " (cópia)",
  );
  await dialog.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(dialog).not.toBeVisible();
  await row.getByRole("button", { name: "Desativar" }).click();
  await expect(row).toContainText("Inativo");
  for (const target of [name, name + " (cópia)"]) {
    row = page
      .locator(".template-row")
      .filter({ has: page.getByText(target, { exact: true }) });
    await row.getByRole("button", { name: "Excluir", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar exclusão" })
      .click();
    await expect(row).toHaveCount(0);
  }
});
