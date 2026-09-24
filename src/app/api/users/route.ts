import { createClient } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase/server";
import { createUserSchema } from "@/schemas/user";

// Admin Auth API is server-only; no service key is returned to the browser.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    const source = new URL(origin || "");
    // Next may use an internal hostname behind the proxy; Host is the browser-facing authority.
    sameOrigin =
      ["http:", "https:"].includes(source.protocol) &&
      source.host ===
        (request.headers.get("host") || new URL(request.url).host);
  } catch {
    /* Invalid or absent Origin. */
  }
  if (!sameOrigin) {
    return Response.json(
      { error: "Origem da solicitação inválida." },
      { status: 403 },
    );
  }
  const db = await serverClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user)
    return Response.json({ error: "Entre novamente no CRM." }, { status: 401 });
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "ADMIN")
    return Response.json(
      { error: "Somente administradores podem criar usuários." },
      { status: 403 },
    );
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return Response.json(
        { error: "Solicitação muito grande." },
        { status: 413 },
      );
    input = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success)
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey)
    return Response.json(
      {
        error:
          "O cadastro de usuários ainda precisa ser habilitado no servidor.",
      },
      { status: 503 },
    );
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { display_name: parsed.data.name },
  });
  if (error || !data.user) {
    const duplicate =
      error?.code === "email_exists" || error?.code === "user_already_exists";
    return Response.json(
      {
        error: duplicate
          ? "Já existe um usuário com este e-mail."
          : "Não foi possível criar o usuário. Confira os dados e tente novamente.",
      },
      { status: duplicate ? 409 : 400 },
    );
  }
  // create_profile trigger assigns VENDEDOR, goals and private templates atomically.
  return Response.json(
    { id: data.user.id, name: parsed.data.name, email: data.user.email },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
