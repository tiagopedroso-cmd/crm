import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  createUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { POST } from "../src/app/api/users/route";
const payload = {
  name: "Joana",
  email: "joana@example.test",
  password: "senha-apenas-de-teste",
};
const request = (
  body: unknown = payload,
  origin = "https://crm.example.test",
) =>
  new Request("https://crm.example.test/api/users", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-private-test-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.test");
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "admin" } },
    error: null,
  });
  mocks.single.mockResolvedValue({ data: { role: "ADMIN" }, error: null });
  mocks.createClient.mockReturnValue({
    auth: { admin: { createUser: mocks.createUser } },
  });
  mocks.createUser.mockResolvedValue({
    data: { user: { id: "new-user", email: payload.email } },
    error: null,
  });
});
describe("Cadastro de usuários no servidor", () => {
  it("rejeita origens externas e sessões ausentes", async () => {
    expect((await POST(request(payload, "https://attacker.test"))).status).toBe(
      403,
    );
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("vendedor não pode criar usuários mesmo chamando a API diretamente", async () => {
    mocks.single.mockResolvedValue({ data: { role: "VENDEDOR" }, error: null });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("valida dados e não aceita papel ou metadados arbitrários", async () => {
    for (const body of [
      { ...payload, name: " " },
      { ...payload, password: "curta" },
      { ...payload, email: "invalido" },
      { ...payload, role: "ADMIN" },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
  it("cria conta com nome sem trocar sessão ou expor senha e chave", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { display_name: "Joana" },
    });
    const body = await response.text();
    expect(body).not.toContain(payload.password);
    expect(body).not.toContain("fake-private-test-key");
  });
  it("informa configuração ausente e conta duplicada", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-private-test-key");
    mocks.createUser.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists" },
    });
    expect((await POST(request())).status).toBe(409);
  });
});
