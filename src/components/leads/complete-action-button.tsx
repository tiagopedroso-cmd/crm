"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { Lead } from "@/types/crm";
import { dayKey, dateLabel, inputToInstant } from "@/lib/utils";
import { useRefresh } from "@/hooks/use-crm";
import { completePendingAction } from "@/services/crm";
import { Modal, Notice } from "@/components/ui";
export function CompleteActionButton({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Lead | null>(null);
  if (!lead.next_action_at || !lead.next_action.trim()) return null;
  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn complete-action" : "btn complete-action"}
        title="Concluir ação pendente"
        aria-label={"Concluir ação de " + lead.company}
        onClick={() => setSnapshot({ ...lead })}
      >
        <Check size={18} />
        {!compact && "Concluir ação"}
      </button>
      {snapshot && (
        <CompleteActionDialog
          lead={snapshot}
          onClose={() => setSnapshot(null)}
        />
      )}
    </>
  );
}
function CompleteActionDialog({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const refresh = useRefresh();
  const [completed, setCompleted] = useState(dayKey);
  const [next, setNext] = useState("");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <Modal
      open
      title="Concluir ação pendente"
      description="Registre a data da conclusão e, se desejar, deixe o próximo passo agendado."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="form-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!completed || completed > dayKey())
              throw new Error("Informe uma data de conclusão até hoje.");
            if (Boolean(next.trim()) !== Boolean(at))
              throw new Error(
                "Preencha a nova ação e sua data juntas, ou deixe ambas em branco.",
              );
            await completePendingAction({
              id: requestId,
              leadId: lead.id,
              expectedAction: lead.next_action,
              expectedAt: lead.next_action_at!,
              completedOn: completed,
              nextAction: next.trim(),
              nextAt: inputToInstant(at),
            });
            await refresh();
            onClose();
          } catch (cause) {
            const message =
              cause && typeof cause === "object" && "message" in cause
                ? String(cause.message)
                : "";
            setError(
              message.includes("ACTION_CHANGED")
                ? "Esta ação foi alterada ou já foi concluída. Feche este formulário e confira a ação atual antes de continuar."
                : cause instanceof Error
                  ? cause.message
                  : "Não foi possível concluir. Tente novamente; a mesma conclusão não será duplicada.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          <strong>{lead.company}</strong>
        </p>
        <p>
          Ação: <strong>{lead.next_action}</strong>
          <br />
          Agendada para {dateLabel(lead.next_action_at, true)}
        </p>
        <Notice text={error} />
        <div className="form-grid">
          <label className="span-2">
            Data de conclusão
            <input
              type="date"
              required
              max={dayKey()}
              value={completed}
              onChange={(e) => setCompleted(e.target.value)}
            />
          </label>
          <label className="span-2">
            Nova ação (opcional)
            <input
              maxLength={10000}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required={Boolean(at)}
              placeholder="Ex.: Enviar proposta"
            />
          </label>
          <label className="span-2">
            Data e hora da nova ação (Brasília)
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              required={Boolean(next.trim())}
            />
          </label>
        </div>
        <p className="muted">
          A ação concluída ficará no histórico. Sem uma nova ação, o lead sairá
          da lista de ações agendadas.
        </p>
        <div className="modal-actions">
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Confirmar conclusão"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
