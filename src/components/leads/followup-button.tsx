"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, RotateCcw } from "lucide-react";
import { useProfile, useReference, useRefresh } from "@/hooks/use-crm";
import { followupDate, renderTemplate } from "@/lib/outreach";
import { whatsappUrl } from "@/lib/utils";
import { confirmCadenceFollowup, getCadenceContext } from "@/services/outreach";
import type { Lead } from "@/types/crm";
import { Modal, Notice } from "@/components/ui";

function formatCadenceDate(value: string) {
  const day = value.slice(0, 10);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${day}T12:00:00-03:00`));
}

export function FollowupButton({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) {
  const profile = useProfile();
  const refs = useReference();
  const refresh = useRefresh();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"edit" | "confirm" | "done">("edit");
  const [message, setMessage] = useState("");
  const [sentId, setSentId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["cadence", lead.id],
    queryFn: () => getCadenceContext(lead.id),
    enabled: lead.stage === "CONTATADO",
  });

  if (lead.stage !== "CONTATADO") return null;

  if (q.isLoading) {
    return (
      <button disabled className={compact ? "icon-btn" : "btn wide"}>
        <RotateCcw size={16} />
        {!compact && "Preparando…"}
      </button>
    );
  }

  const c = q.data;

  if (!c || c.status !== "IN_PROGRESS" || !c.next_message) {
    return c?.status === "COMPLETED" && !compact ? (
      <span className="badge green">Régua concluída · 5/5</span>
    ) : null;
  }

  const cadence = c;
  const next = cadence.current_step + 1;
  const attempt = Math.min(5, next + 1);

  // Espelha a proteção do banco: antes de next_followup_at o contato
  // não pode ser registrado. O backend continua sendo a autoridade final.
  const eligibleAt = cadence.next_followup_at
    ? new Date(cadence.next_followup_at)
    : null;
  const eligibleNow =
    !eligibleAt ||
    Number.isNaN(eligibleAt.getTime()) ||
    Date.now() >= eligibleAt.getTime();

  const availableLabel = cadence.next_followup_at
    ? formatCadenceDate(cadence.next_followup_at)
    : null;

  function start() {
    if (!eligibleNow) return;

    const product =
      refs.data?.products.find((p) => p.id === lead.product_id)?.name || "";

    setMessage(
      renderTemplate(
        cadence.next_message!,
        lead,
        product,
        profile.display_name,
      ).text,
    );
    setPhase("edit");
    setNotice("");
    setOpen(true);
  }

  const href = whatsappUrl(lead.whatsapp, message);

  async function confirm() {
    if (!sentId) return;

    setBusy(true);
    try {
      await confirmCadenceFollowup({
        id: sentId,
        lead: lead.id,
        message,
        phone: new URL(href!).pathname.slice(1),
      });

      const refreshed = await q.refetch();
      await refresh();

      if (attempt >= 5) {
        setNotice(
          "Régua concluída após 5 tentativas sem resposta. Considere mover o lead para Perdido com motivo Não respondeu.",
        );
      } else {
        const nextDate =
          refreshed.data?.next_followup_at || followupDate();

        setNotice(
          `Contato registrado. Próximo follow-up elegível em ${formatCadenceDate(nextDate)}, respeitando 3 dias úteis.`,
        );
      }

      setPhase("done");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "";

      if (message.includes("Follow-up is not eligible yet")) {
        setNotice(
          availableLabel
            ? `Este follow-up ainda não está disponível. Próximo contato permitido em ${availableLabel}.`
            : "Este follow-up ainda não está disponível.",
        );
      } else {
        setNotice("Não foi possível registrar o follow-up.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!eligibleNow) {
    const label = availableLabel
      ? `Follow-up ${next} disponível em ${availableLabel}`
      : `Follow-up ${next} ainda não disponível`;

    return (
      <button
        type="button"
        disabled
        className={compact ? "icon-btn" : "btn wide"}
        title={label}
      >
        <RotateCcw size={compact ? 18 : 16} />
        {!compact && label}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn" : "btn whatsapp wide"}
        onClick={start}
        title={`Enviar Follow-up ${next}`}
      >
        {compact ? <RotateCcw size={18} /> : <MessageCircle size={16} />}
        {!compact && `Enviar Follow-up ${next}`}
      </button>

      {open && (
        <Modal
          open
          onClose={() => !busy && setOpen(false)}
          title={`Follow-up ${next} · ${cadence.campaign_name}`}
          description={`Tentativa ${attempt} de 5. O CRM calculará automaticamente a próxima data elegível.`}
          wide
        >
          <div className="form-body">
            <Notice text={notice} />

            {phase === "edit" && (
              <>
                <label>
                  Mensagem sugerida
                  <textarea
                    rows={12}
                    maxLength={8000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>

                <div className="modal-actions">
                  {href ? (
                    <a
                      className="btn whatsapp"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setSentId(crypto.randomUUID());
                        setPhase("confirm");
                      }}
                    >
                      Enviar pelo WhatsApp
                    </a>
                  ) : (
                    <button disabled className="btn">
                      WhatsApp inválido
                    </button>
                  )}

                  <button className="btn" onClick={() => setOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {phase === "confirm" && (
              <>
                <h3>A mensagem foi enviada?</h3>
                <p>Confirme somente depois do envio manual no WhatsApp.</p>

                <label>
                  Texto efetivamente enviado
                  <textarea
                    rows={10}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>

                <div className="modal-actions">
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() => void confirm()}
                  >
                    {busy ? "Registrando…" : "Sim, registrar contato"}
                  </button>

                  <button className="btn" onClick={() => setPhase("edit")}>
                    Voltar
                  </button>
                </div>
              </>
            )}

            {phase === "done" && (
              <div className="modal-actions">
                <button
                  className="btn primary"
                  onClick={() => setOpen(false)}
                >
                  Concluir
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
