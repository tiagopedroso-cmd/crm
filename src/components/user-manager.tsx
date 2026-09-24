"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { useProfile, useReference, useRefresh } from "@/hooks/use-crm";
import { displayNameSchema, createUserSchema } from "@/schemas/user";
import { Modal, Notice } from "@/components/ui";
export function UserManager() {
  const profile = useProfile(),
    refs = useReference(),
    refresh = useRefresh();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function rename(id: string, raw: FormDataEntryValue | null) {
    setBusy(true);
    setNotice("");
    try {
      const result = displayNameSchema.safeParse(raw);
      if (!result.success) throw new Error(result.error.issues[0].message);
      const { data, error } = await browserClient()
        .from("profiles")
        .update({ display_name: result.data })
        .eq("id", id)
        .select("id")
        .single();
      if (error || !data) throw new Error("Não foi possível salvar o nome.");
      await refresh();
      router.refresh();
      setNotice("Nome atualizado. As próximas abordagens usarão o novo nome.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card panel" id="usuarios">
      <div className="section-heading">
        <div>
          <h2>Usuários</h2>
          <p>O nome do usuário identifica quem envia as abordagens.</p>
        </div>
        {profile.role === "ADMIN" && (
          <button
            className="btn primary"
            onClick={() => {
              setCreating(true);
              setError("");
            }}
          >
            Adicionar usuário
          </button>
        )}
      </div>
      <Notice text={notice} />
      {(refs.data?.profiles || [profile]).map((p) => (
        <form
          key={p.id + p.display_name}
          className="user-name-row"
          onSubmit={(e) => {
            e.preventDefault();
            void rename(p.id, new FormData(e.currentTarget).get("name"));
          }}
        >
          <label>
            Nome do usuário {p.id === profile.id ? "(você)" : ""}
            <input
              name="name"
              defaultValue={p.display_name}
              required
              maxLength={100}
              placeholder="Ex.: Tiago"
              aria-label={
                "Nome de " +
                (p.id === profile.id ? "meu usuário" : p.display_name || p.id)
              }
            />
          </label>
          <span className="badge">
            {p.role === "ADMIN" ? "Administrador" : "Vendedor"}
          </span>
          <button className="btn" disabled={busy}>
            Salvar nome
          </button>
        </form>
      ))}
      {profile.role !== "ADMIN" && (
        <p className="muted">
          O cadastro de novos usuários é feito por um administrador.
        </p>
      )}
      <Modal
        open={creating}
        onClose={() => {
          if (!busy) setCreating(false);
        }}
        title="Adicionar usuário"
        description="O novo usuário terá acesso de vendedor, com seus próprios leads, metas e modelos."
      >
        <form
          className="form-body"
          autoComplete="off"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            const input = createUserSchema.safeParse({
              name: f.get("name"),
              email: f.get("email"),
              password: f.get("password"),
            });
            if (!input.success) {
              setError(input.error.issues[0].message);
              return;
            }
            setBusy(true);
            setError("");
            try {
              const response = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input.data),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  result.error || "Não foi possível criar o usuário.",
                );
              form.reset();
              setCreating(false);
              await refresh();
              setNotice(
                "Usuário " +
                  input.data.name +
                  " criado. Ele já pode entrar com o e-mail e a senha definidos.",
              );
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Não foi possível criar o usuário.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Notice text={error} />
          <div className="form-grid">
            <label className="span-2">
              Nome
              <input name="name" required maxLength={100} autoComplete="off" />
            </label>
            <label className="span-2">
              E-mail do novo usuário
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
              />
            </label>
            <label className="span-2">
              Senha de acesso
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>
          <p className="muted">
            Use pelo menos 12 caracteres. Entregue o acesso diretamente à
            pessoa; nenhum e-mail é enviado por este cadastro.
          </p>
          <div className="modal-actions">
            <button className="btn primary" disabled={busy}>
              {busy ? "Criando…" : "Criar usuário"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
