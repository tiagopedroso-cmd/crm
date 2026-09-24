"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProfile, useRefresh } from "@/hooks/use-crm";
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  defaultTemplate,
} from "@/services/outreach";
import {
  TEMPLATE_GROUPS,
  TEMPLATE_VARIABLES,
  type MessageTemplate,
} from "@/lib/outreach";
import { Modal, Notice, Loading } from "@/components/ui";
const blank = {
  name: "",
  niche_group: "Geral",
  message:
    "Oi, {{responsavel}}. Tudo bem?\n\nMe chamo {{usuario}}, da InovaLogix.\n\n",
  is_active: true,
};
export function TemplateManager() {
  const profile = useProfile();
  const refresh = useRefresh();
  const query = useQuery({
    queryKey: ["message-templates", profile.id],
    queryFn: listTemplates,
  });
  const [draft, setDraft] = useState<(typeof blank & { id?: string }) | null>(
    null,
  );
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [variable, setVariable] = useState<string>(TEMPLATE_VARIABLES[0]);
  const area = useRef<HTMLTextAreaElement>(null);
  async function run(fn: () => Promise<void>, close = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
      if (close) {
        setDraft(null);
        setDeleting(null);
      }
      setNotice("Modelos atualizados.");
    } catch {
      setError("Não foi possível salvar. Confira os campos e tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card panel" id="mensagens">
      <div className="section-heading">
        <div>
          <h2>Mensagens de abordagem</h2>
          <p>
            Seus modelos privados. Defina um padrão por grupo ou deixe o CRM
            sugerir pelo nicho e site.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            setDraft({ ...blank });
            setError("");
          }}
        >
          Criar template
        </button>
      </div>
      <Notice text={notice} />
      {!draft && !deleting && <Notice text={error} />}
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <div className="notice error">
          Não foi possível carregar os modelos.{" "}
          <button className="btn" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="template-list">
          {query.data?.map((t) => (
            <article className="template-row" key={t.id}>
              <div>
                <strong>{t.name}</strong>
                <p className="muted">
                  {t.niche_group} · {t.is_active ? "Ativo" : "Inativo"}
                  {t.is_default ? " · Padrão" : ""}
                </p>
              </div>
              <div className="actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setDraft({
                      id: t.id,
                      name: t.name,
                      niche_group: t.niche_group,
                      message: t.message,
                      is_active: t.is_active,
                    });
                    setError("");
                  }}
                >
                  Editar
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setDraft({
                      name: t.name.slice(0, 140) + " (cópia)",
                      niche_group: t.niche_group,
                      message: t.message,
                      is_active: true,
                    });
                    setError("");
                  }}
                >
                  Duplicar
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      saveTemplate(
                        {
                          name: t.name,
                          niche_group: t.niche_group,
                          message: t.message,
                          is_active: !t.is_active,
                        },
                        t.id,
                      ),
                    )
                  }
                >
                  {t.is_active ? "Desativar" : "Ativar"}
                </button>
                <button
                  className="btn"
                  disabled={busy || !t.is_active || t.is_default}
                  onClick={() => void run(() => defaultTemplate(t.id))}
                >
                  Definir padrão
                </button>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => {
                    setDeleting(t);
                    setError("");
                  }}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={Boolean(draft)}
        onClose={() => {
          if (!busy) setDraft(null);
        }}
        title={draft?.id ? "Editar template" : "Criar template"}
        wide
      >
        {draft && (
          <form
            className="form-body"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  saveTemplate(
                    {
                      name: draft.name.trim(),
                      niche_group: draft.niche_group,
                      message: draft.message.trim(),
                      is_active: draft.is_active,
                    },
                    draft.id,
                  ),
                true,
              );
            }}
          >
            <Notice text={error} />
            <div className="form-grid">
              <label>
                Nome do modelo
                <input
                  required
                  maxLength={150}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Grupo
                <select
                  value={draft.niche_group}
                  onChange={(e) =>
                    setDraft({ ...draft, niche_group: e.target.value })
                  }
                >
                  {TEMPLATE_GROUPS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              Variáveis:{" "}
              {TEMPLATE_VARIABLES.map((v) => "{{" + v + "}}").join(" · ")}
            </p>
            <div className="actions">
              <select
                aria-label="Variável disponível"
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                {TEMPLATE_VARIABLES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const start =
                      area.current?.selectionStart ?? draft.message.length,
                    end = area.current?.selectionEnd ?? start;
                  const token = "{{" + variable + "}}";
                  setDraft({
                    ...draft,
                    message:
                      draft.message.slice(0, start) +
                      token +
                      draft.message.slice(end),
                  });
                  requestAnimationFrame(() => {
                    area.current?.focus();
                    area.current?.setSelectionRange(
                      start + token.length,
                      start + token.length,
                    );
                  });
                }}
              >
                Inserir variável
              </button>
            </div>
            <label>
              Texto do modelo
              <textarea
                ref={area}
                rows={12}
                required
                maxLength={8000}
                value={draft.message}
                onChange={(e) =>
                  setDraft({ ...draft, message: e.target.value })
                }
              />
            </label>
            <label className="check-inline">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) =>
                  setDraft({ ...draft, is_active: e.target.checked })
                }
              />
              Modelo ativo
            </label>
            <div className="modal-actions">
              <button className="btn primary" disabled={busy}>
                Salvar modelo
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title="Excluir template"
      >
        <div className="form-body">
          <Notice text={error} />
          <p>
            Excluir {deleting?.name}? As abordagens já confirmadas preservarão o
            nome do modelo e o texto enviado.
          </p>
          <div className="modal-actions">
            <button
              className="btn danger"
              disabled={busy}
              onClick={() =>
                deleting && void run(() => deleteTemplate(deleting.id), true)
              }
            >
              Confirmar exclusão
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
