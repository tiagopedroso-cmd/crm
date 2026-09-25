"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Globe } from "lucide-react";
import { getLead, deleteLead } from "@/services/crm";
import { useReference, useRefresh } from "@/hooks/use-crm";
import { dateLabel, money, actionStatus, whatsappUrl } from "@/lib/utils";
import { MessageButton } from "@/components/leads/message-button";
import { CompleteActionButton } from "@/components/leads/complete-action-button";
import { LeadForm } from "@/components/leads/lead-form";
import { StageControl } from "@/components/leads/stage-control";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { Loading, ErrorState, Modal, Notice } from "@/components/ui";
export default function Lead360({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const query = useQuery({
    queryKey: ["lead", id],
    queryFn: () => getLead(id),
  });
  const refs = useReference();
  const refresh = useRefresh();
  const router = useRouter();
  const [quickAction, setQuickAction] = useState<{
    tab: string;
    type: string;
    nonce: number;
  }>();
  function openAction(tab: string, type = "WhatsApp") {
    setQuickAction({ tab, type, nonce: Date.now() });
    requestAnimationFrame(() =>
      document
        .getElementById("lead-activity")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data)
    return <ErrorState retry={() => query.refetch()} />;
  const l = query.data;

  return (
    <>
      <Link className="back-link" href="/leads">
        <ArrowLeft size={16} />
        Voltar aos leads
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            LEAD 360° {l.is_demo ? "· DEMONSTRAÇÃO" : ""}
          </p>
          <h1>{l.company}</h1>
          <p>
            {l.contact_name || "Contato a identificar"} ·{" "}
            {[l.city, l.state].filter(Boolean).join(", ") ||
              "Localização não informada"}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setEditing(true)}>
            <Pencil size={16} />
            Editar
          </button>
          <button
            className="icon-btn danger"
            aria-label="Excluir lead"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="detail-grid">
        <aside className="detail-summary">
          <section className="card panel">
            <p className="eyebrow">ETAPA ATUAL</p>
            <span className="badge">{l.stage}</span>
            <div className="detail-value">
              <small>Valor potencial</small>
              <strong>{money(l.potential_value)}</strong>
              <span>
                {refs.data?.products.find((p) => p.id === l.product_id)?.name ||
                  "Produto não definido"}
              </span>
            </div>
            <div className="lead-quick-actions">
              <h3>Ações</h3>
              <MessageButton lead={l} />
              {whatsappUrl(l.whatsapp) && (
                <a
                  className="btn wide"
                  href={whatsappUrl(l.whatsapp)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
              <button
                className="btn"
                onClick={() => openAction("interaction", "Ligação")}
              >
                Registrar ligação
              </button>
              <button className="btn" onClick={() => openAction("interaction")}>
                Registrar interação
              </button>
              <button className="btn" onClick={() => openAction("action")}>
                Agendar follow-up
              </button>
              <button className="btn" onClick={() => openAction("action")}>
                Criar próxima ação
              </button>
              <label>
                Mudar etapa
                <StageControl lead={l} />
              </label>
            </div>
            <dl className="facts">
              {[
                ["Cadastrado por", l.creator_name],
                ["WhatsApp", l.whatsapp],
                ["E-mail", l.email],
                ["Nicho", l.niche],
                ["Origem", l.source],
                ["Canal", l.channel],
                [
                  "Responsável",
                  refs.data?.profiles.find((p) => p.id === l.owner_id)
                    ?.display_name || "Minha conta",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v || "Não informado"}</dd>
                </div>
              ))}
            </dl>
            {l.website && (
              <a
                className="external-link"
                href={l.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={16} />
                Visitar site ↗
              </a>
            )}
            {l.instagram && (
              <a
                className="external-link"
                href={l.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram ↗
              </a>
            )}
          </section>
          <section className="card panel">
            <p className="eyebrow">PRÓXIMO MOVIMENTO</p>
            <h3>{l.next_action || "Defina uma próxima ação"}</h3>
            <p>{dateLabel(l.next_action_at, true)}</p>
            <CompleteActionButton lead={l} />
            {actionStatus(l) && (
              <span
                className={`badge ${actionStatus(l) === "Ação atrasada" ? "red" : "amber"}`}
              >
                {actionStatus(l)}
              </span>
            )}
          </section>
          <section className="card panel">
            <h3>Datas importantes</h3>
            <dl className="facts">
              {[
                ["Inserção", dateLabel(l.inserted_on)],
                ["Primeiro contato", dateLabel(l.first_contact_at, true)],
                ["Última interação", dateLabel(l.last_interaction_at, true)],
                ["Criação", dateLabel(l.created_at, true)],
                ["Atualização", dateLabel(l.updated_at, true)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
        <div className="detail-main">
          <section className="card panel">
            <h2>Contexto da oportunidade</h2>
            <div className="context-grid">
              {[
                ["Dor identificada", l.pain],
                ["Objetivo do cliente", l.objective],
                ["Sondagem", l.discovery_notes],
                [
                  "Objeção",
                  refs.data?.objections.find((o) => o.id === l.objection_id)
                    ?.name,
                ],
                ["Urgência", l.urgency],
                ["Decisor", l.decision_maker],
                [
                  "Orçamento",
                  l.budget === null ? "Não informado" : money(l.budget),
                ],
                ["Observações", l.notes],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="eyebrow">{label}</p>
                  <p className="preserve">{value || "Ainda não informado"}</p>
                </div>
              ))}
            </div>
            {["FECHADO", "PÓS-VENDA"].includes(l.stage) && (
              <div className="won-summary">
                <strong>Negócio fechado · {money(l.closed_value || 0)}</strong>
                <span>
                  {dateLabel(l.closed_on)} · {l.payment_method}
                </span>
                <p>{l.closing_notes}</p>
              </div>
            )}
            {l.stage === "PERDIDO" && (
              <div className="notice error">
                Motivo da perda: {l.loss_reason}
              </div>
            )}
          </section>
          <LeadTimeline lead={l} action={quickAction} />
        </div>
      </div>
      <LeadForm open={editing} onClose={() => setEditing(false)} lead={l} />
      <Modal
        open={deleting}
        onClose={() => {
          if (!busy) setDeleting(false);
        }}
        title="Excluir este lead?"
        description="O lead, as interações, as propostas e o histórico serão excluídos permanentemente."
      >
        <div className="form-body">
          <p>
            <strong>{l.company}</strong>
          </p>
          <Notice text={error} />
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => setDeleting(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteLead(id);
                  await refresh();
                  router.push("/leads");
                } catch {
                  setError("Não foi possível excluir o lead.");
                  setBusy(false);
                }
              }}
            >
              Excluir definitivamente
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
