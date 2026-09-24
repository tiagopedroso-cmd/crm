"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addInteraction,
  leadDetails,
  scheduleAction,
  saveProposal,
  afterSale,
} from "@/services/crm";
import { useReference, useRefresh } from "@/hooks/use-crm";
import { AFTER_SALES, INTERACTIONS, type Lead } from "@/types/crm";
import {
  dateLabel,
  dayKey,
  inputToInstant,
  localInput,
  money,
} from "@/lib/utils";
import { Empty, ErrorState, Loading, Notice } from "@/components/ui";
export function LeadTimeline({
  lead,
  action,
}: {
  lead: Lead;
  action?: { tab: string; type: string; nonce: number };
}) {
  const refresh = useRefresh();
  const refs = useReference();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("history");
  useEffect(() => {
    if (action) setTab(action.tab);
  }, [action]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [afterDraft, setAfterDraft] = useState<Record<string, boolean> | null>(
    null,
  );
  const details = useQuery({
    queryKey: ["details", lead.id, page],
    queryFn: () => leadDetails(lead.id, page),
  });
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch {
      setError("Não foi possível salvar. Confira os campos e tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  const timeline = [
    ...(details.data?.interactions.map((i) => ({
      id: i.id,
      date: i.occurred_at,
      title: i.type,
      description: [
        i.description,
        ...(details.data?.approaches
          .filter((a) => a.interaction_id === i.id)
          .map((a) => `Modelo: ${a.template_name}\n${a.message}`) || []),
      ].join("\n\n"),
      actor: i.actor_id,
    })) || []),
    ...(details.data?.history.map((h) => ({
      id: h.id,
      date: h.created_at,
      title: h.from_stage ? "Etapa alterada" : "Lead cadastrado",
      description: h.from_stage
        ? `${h.from_stage} → ${h.to_stage}${h.reason ? " · " + h.reason : ""}`
        : h.to_stage,
      actor: h.actor_id,
    })) || []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card panel" id="lead-activity">
      <div className="tabs">
        {[
          ["history", "Histórico"],
          ["interaction", "Nova interação"],
          ["action", "Próxima ação"],
          ["proposals", "Propostas"],
          ["after", "Pós-venda"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <Notice text={error} />
      {details.isLoading ? (
        <Loading />
      ) : details.isError ? (
        <ErrorState retry={() => details.refetch()} />
      ) : (
        <>
          {tab === "history" && (
            <>
              {!timeline.length ? (
                <Empty
                  title="A história começa aqui"
                  text="Registre a primeira conversa com este lead."
                />
              ) : (
                <ol className="timeline">
                  {timeline.map((t) => (
                    <li key={t.id}>
                      <span className="timeline-dot" />
                      <div>
                        <small>
                          {dateLabel(t.date, true)} ·{" "}
                          {refs.data?.profiles.find((p) => p.id === t.actor)
                            ?.display_name || "Responsável registrado"}
                        </small>
                        <strong>{t.title}</strong>
                        <p>{t.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="pagination">
                <button
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Mais recentes
                </button>
                <span>Página {page + 1}</span>
                <button
                  className="btn"
                  disabled={!details.data?.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Mais antigos
                </button>
              </div>
            </>
          )}
          {tab === "interaction" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                void run(async () => {
                  await addInteraction(
                    lead.id,
                    String(f.get("type")),
                    String(f.get("description")),
                    inputToInstant(String(f.get("occurred_at")))!,
                  );
                  form.reset();
                  setTab("history");
                  setPage(0);
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Tipo
                  <select
                    name="type"
                    key={action?.nonce}
                    defaultValue={action?.type || "WhatsApp"}
                  >
                    {INTERACTIONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Data e hora (Brasília)
                  <input
                    name="occurred_at"
                    type="datetime-local"
                    defaultValue={localInput(new Date().toISOString())}
                    max={localInput(new Date().toISOString())}
                    required
                  />
                </label>
                <label className="span-2">
                  Como foi a conversa?
                  <textarea
                    name="description"
                    placeholder="Contexto, decisões e combinados…"
                    maxLength={10000}
                    required
                  />
                </label>
              </div>
              <button className="btn primary" disabled={busy}>
                Registrar interação
              </button>
            </form>
          )}
          {tab === "action" && (
            <>
              <h3>Qual é o próximo passo?</h3>
              <p className="muted">
                Cadência sugerida a partir do primeiro contato. Nenhuma mensagem
                é enviada automaticamente.
              </p>
              <div className="cadence">
                {[
                  [0, "Abordagem"],
                  [2, "1º follow-up"],
                  [5, "2º follow-up"],
                  [10, "3º follow-up"],
                  [20, "Retomada"],
                  [30, "Nutrição"],
                ].map(([days, label]) => (
                  <button
                    className="btn"
                    disabled={busy}
                    key={days}
                    onClick={() => {
                      const d = new Date(
                        lead.first_contact_at || new Date().toISOString(),
                      );
                      d.setUTCDate(d.getUTCDate() + Number(days));
                      void run(() =>
                        scheduleAction(
                          lead.id,
                          String(label),
                          `${dayKey(d)}T09:00:00-03:00`,
                        ),
                      );
                    }}
                  >
                    <small>D{Number(days) ? `+${days}` : "0"}</small>
                    {label}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(() =>
                    scheduleAction(
                      lead.id,
                      String(f.get("next_action")),
                      inputToInstant(String(f.get("next_action_at")))!,
                    ),
                  );
                }}
              >
                <div className="form-grid">
                  <label>
                    Ação
                    <input
                      name="next_action"
                      defaultValue={lead.next_action}
                      required
                    />
                  </label>
                  <label>
                    Data e hora (Brasília)
                    <input
                      name="next_action_at"
                      type="datetime-local"
                      defaultValue={localInput(lead.next_action_at)}
                      required
                    />
                  </label>
                </div>
                <button className="btn primary" disabled={busy}>
                  Agendar próximo passo
                </button>
              </form>
            </>
          )}
          {tab === "proposals" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void run(async () => {
                    await saveProposal({
                      lead_id: lead.id,
                      title: String(f.get("title")),
                      amount: Number(f.get("amount")),
                      url: String(f.get("url")),
                      sent_on: String(f.get("sent_on")),
                      notes: String(f.get("notes")),
                    });
                    form.reset();
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    Nome da proposta
                    <input name="title" required maxLength={200} />
                  </label>
                  <label>
                    Valor (R$)
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      defaultValue={lead.potential_value}
                    />
                  </label>
                  <label>
                    Enviada em
                    <input
                      name="sent_on"
                      type="date"
                      required
                      defaultValue={dayKey()}
                    />
                  </label>
                  <label>
                    Link do documento (https://)
                    <input name="url" type="url" pattern="https://.*" />
                  </label>
                  <label className="span-2">
                    Observação
                    <textarea name="notes" />
                  </label>
                </div>
                <button className="btn primary" disabled={busy}>
                  Registrar proposta
                </button>
              </form>
              <div className="proposal-list">
                {details.data?.proposals.map((p) => (
                  <article key={p.id} className="list-row">
                    <div>
                      <strong>{p.title}</strong>
                      <p>
                        {money(p.amount)} · {dateLabel(p.sent_on)}
                      </p>
                      {p.url && (
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={p.url}
                        >
                          Abrir documento ↗
                        </a>
                      )}
                      <small>{p.notes}</small>
                    </div>
                    <select
                      aria-label={`Status da proposta ${p.title}`}
                      value={p.status}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() =>
                          saveProposal({
                            ...p,
                            status: e.target.value as typeof p.status,
                          }),
                        )
                      }
                    >
                      {["Aguardando", "Aceita", "Recusada"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
              <div className="pagination">
                <button
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page + 1}</span>
                <button
                  className="btn"
                  disabled={!details.data?.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </>
          )}
          {tab === "after" && (
            <>
              <h3>O relacionamento continua</h3>
              <p className="muted">
                Acompanhe a entrega e as novas oportunidades com este cliente.
              </p>
              <div className="checklist">
                {Object.entries(AFTER_SALES).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        afterDraft?.[key] ?? details.data?.afterSales?.[key],
                      )}
                      disabled={busy}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        setAfterDraft({
                          ...details.data?.afterSales,
                          [key]: checked,
                        });
                        await run(() => afterSale(lead.id, key, checked));
                        setAfterDraft(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
