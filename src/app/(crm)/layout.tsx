import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    redirect("/login");
  const db = await serverClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("id,display_name,role")
    .eq("id", user.id)
    .single();
  if (!profile)
    return (
      <main className="setup">
        <h1>Conclua a configuração do banco</h1>
        <p>
          O usuário está autenticado, mas seu perfil não foi encontrado. Execute
          as migrations descritas no README.
        </p>
        <a href="/login">Voltar ao login</a>
      </main>
    );
  return <Shell profile={profile}>{children}</Shell>;
}
