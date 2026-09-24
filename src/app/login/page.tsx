"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const { error } = await browserClient().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Não foi possível entrar. Confira seu e-mail e senha e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-brand">
        <div className="brand">
          <BrandLogo />
        </div>
        <div>
          <p className="eyebrow">RELACIONAMENTOS QUE GERAM RESULTADOS</p>
          <h1>
            Todo grande negócio
            <br />
            começa com
            <br />
            <em>uma conversa.</em>
          </h1>
          <p>
            Traga novos leads. Cultive oportunidades.
            <br />
            Faça seu próximo movimento.
          </p>
        </div>
        <small>InovaLogix · Tecnologia a favor do seu negócio</small>
      </section>
      <section className="login-form">
        <div className="login-box">
          <div className="icon-tile">
            <LockKeyhole size={24} />
          </div>
          <h2>Bom ter você de volta.</h2>
          <p>Acesse sua operação comercial.</p>
          {!configured ? (
            <div className="notice">
              <strong>Conecte seu Supabase para começar</strong>
              <p>
                Crie o arquivo <code>.env.local</code> com a URL e a chave
                pública do projeto, execute as migrations e reinicie o servidor.
                O passo a passo está no README.
              </p>
              <p>Nenhum dado comercial é armazenado neste navegador.</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="voce@inovalogix.com.br"
                  required
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  required
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="btn primary wide" disabled={busy}>
                {busy ? "Entrando…" : "Entrar no CRM"}
                <ArrowRight size={18} />
              </button>
              <p className="muted small">
                Acesso restrito. Solicite ao administrador a criação ou
                recuperação da sua conta.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
