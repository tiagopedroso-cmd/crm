import { test, expect } from "@playwright/test";
test("administrador edita nomes, cria vendedor e personaliza remetente", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("demo@inovalogix.test");
  await page.getByLabel("Senha", { exact: true }).fill("Demo123!");
  await page.getByRole("button", { name: "Entrar no CRM" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos fazer acontecer, Tiago." }),
  ).toBeVisible();
  await page.goto("/configuracoes");
  const mine = page
    .locator(".user-name-row")
    .filter({ has: page.getByLabel("Nome de meu usuário") });
  await mine.getByLabel("Nome de meu usuário").fill("Tiago Comercial");
  await mine.getByRole("button", { name: "Salvar nome" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Nome atualizado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar usuário" }).click();
  const dialog = page.getByRole("dialog");
  const newName = "Joana " + info.project.name;
  await dialog.getByLabel("Nome", { exact: true }).fill(newName);
  await dialog
    .getByLabel("E-mail do novo usuário")
    .fill("joana-" + info.project.name + "@example.test");
  await dialog.getByLabel("Senha de acesso").fill("Apenas-Teste-12345");
  await dialog
    .getByRole("button", { name: "Criar usuário", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Nome de " + newName)).toHaveValue(newName);
  await page.goto("/leads");
  await page
    .getByRole("button", {
      name: /^(Enviar abordagem|WhatsApp) para Clínica Sorriso$/,
    })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Mensagem personalizada"),
  ).toHaveValue(/Me chamo Tiago Comercial, da InovaLogix/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await page.goto("/configuracoes");
  await page.getByLabel("Nome de meu usuário").fill("Tiago");
  await page
    .locator(".user-name-row")
    .filter({ has: page.getByLabel("Nome de meu usuário") })
    .getByRole("button", { name: "Salvar nome" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Nome atualizado" }),
  ).toBeVisible();
});
