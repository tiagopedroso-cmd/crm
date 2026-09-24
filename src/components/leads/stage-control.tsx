"use client";
import { useState } from "react";
import { STAGES, LOSSES, type Lead, type Stage } from "@/types/crm";
import { changeStage } from "@/services/crm";
import { useRefresh } from "@/hooks/use-crm";
import { dayKey } from "@/lib/utils";
import { Modal, Notice } from "@/components/ui";
export function StageDialog({
  lead,
  stage,
  onClose,
  onSave,
}: {
  lead: Lead;
  stage: Stage | null;
  onClose: () => void;
  onSave: (extra: Partial<Lead>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      open={Boolean(stage)}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={stage === "PERDIDO" ? "Registrar perda" : "Confirmar fechamento"}
      description="Este registro será salvo no histórico do lead."
    >
      <form
        className="form-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await onSave(
              stage === "PERDIDO"
                ? { loss_reason: String(f.get("loss_reason")) }
                : {
                    closed_value: Number(f.get("closed_value")),
                    closed_on: String(f.get("closed_on")),
                    payment_method: String(f.get("payment_method")),
                    closing_notes: String(f.get("closing_notes")),
                  },
            );
            onClose();
          } catch {
            setError("Não foi possível salvar a etapa. Tente novamente.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {stage === "PERDIDO" ? (
          <label>
            Motivo da perda *
            <input
              name="loss_reason"
              list="loss-reasons"
              required
              defaultValue={lead.loss_reason}
            />
            <datalist id="loss-reasons">
              {LOSSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </datalist>
          </label>
        ) : (
          <>
            <label>
              Valor fechado (R$) *
              <input
                name="closed_value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={lead.closed_value ?? lead.potential_value}
                required
              />
            </label>
            <label>
              Data do fechamento *
              <input
                name="closed_on"
                type="date"
                defaultValue={lead.closed_on || dayKey()}
                required
              />
            </label>
            <label>
              Forma de pagamento *
              <input
                name="payment_method"
                defaultValue={lead.payment_method}
                required
              />
            </label>
            <label>
              Observação
              <textarea
                name="closing_notes"
                defaultValue={lead.closing_notes}
              />
            </label>
          </>
        )}
        <Notice text={error} />
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function StageControl({ lead }: { lead: Lead }) {
  const refresh = useRefresh();
  const [pending, setPending] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(stage: Stage, extra: Partial<Lead> = {}) {
    setBusy(true);
    setError("");
    try {
      await changeStage(lead.id, stage, extra);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <select
        className="stage-select"
        aria-label={`Etapa de ${lead.company}`}
        value={lead.stage}
        disabled={busy}
        onChange={async (e) => {
          const s = e.target.value as Stage;
          if (["FECHADO", "PÓS-VENDA", "PERDIDO"].includes(s)) {
            setPending(s);
            return;
          }
          try {
            await update(s);
          } catch {
            setError("Falha ao mudar etapa");
          }
        }}
      >
        {STAGES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {error && (
        <small role="alert" className="error">
          {error}
        </small>
      )}
      {pending && (
        <StageDialog
          lead={lead}
          stage={pending}
          onClose={() => setPending(null)}
          onSave={(extra) => update(pending, extra)}
        />
      )}
    </>
  );
}
