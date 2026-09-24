"use client";
import { useEffect, useState } from "react";
import { ZodError } from "zod";
import { useReference, useRefresh } from "@/hooks/use-crm";
import { saveLead } from "@/services/crm";
import { dayKey, inputToInstant, localInput } from "@/lib/utils";
import { CHANNELS, SOURCES, type Lead } from "@/types/crm";
import { Modal, Notice } from "@/components/ui";
export function LeadForm({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead;
}) {
  const refs = useReference();
  const refresh = useRefresh();
  const [full, setFull] = useState(Boolean(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(lead?.product_id || "");
  const [value, setValue] = useState(lead?.potential_value || 0);
  useEffect(() => {
    if (open) {
      setError("");
      setFull(Boolean(lead));
      setProduct(lead?.product_id || "");
      setValue(lead?.potential_value || 0);
    }
  }, [open, lead]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const str = (key: string, fallback: unknown = "") =>
      f.has(key) ? String(f.get(key)) : String(fallback ?? "");
    try {
      const payload = {
        company: str("company"),
        contact_name: str("contact_name"),
        whatsapp: str("whatsapp"),
        email: str("email", lead?.email),
        instagram: str("instagram", lead?.instagram),
        website: str("website", lead?.website),
        niche: str("niche", lead?.niche),
        city: str("city", lead?.city),
        state: str("state", lead?.state).toUpperCase(),
        source: str("source", lead?.source || "Prospecção manual"),
        channel: str("channel", lead?.channel || "WhatsApp"),
        product_id: product || null,
        potential_value: value,
        stage: lead?.stage || "NOVO LEAD",
        inserted_on: str("inserted_on", lead?.inserted_on || dayKey()),
        first_contact_at: lead?.first_contact_at || null,
        next_action: str("next_action"),
        next_action_at: inputToInstant(str("next_action_at")),
        pain: str("pain", lead?.pain),
        objective: str("objective", lead?.objective),
        discovery_notes: str("discovery_notes", lead?.discovery_notes),
        urgency: str("urgency", lead?.urgency),
        decision_maker: str("decision_maker", lead?.decision_maker),
        budget:
          str("budget", lead?.budget) === ""
            ? null
            : Number(str("budget", lead?.budget)),
        objection_id: str("objection_id", lead?.objection_id) || null,
        loss_reason: str("loss_reason", lead?.loss_reason),
        closed_on: str("closed_on", lead?.closed_on) || null,
        closed_value:
          str("closed_value", lead?.closed_value) === ""
            ? null
            : Number(str("closed_value", lead?.closed_value)),
        payment_method: str("payment_method", lead?.payment_method),
        closing_notes: str("closing_notes", lead?.closing_notes),
        notes: str("notes", lead?.notes),
      };
      await saveLead(payload, lead?.id);
      await refresh();
      onClose();
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((issue) => issue.message).join(". ")
          : "Não foi possível salvar. Confira os campos e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input = (name: keyof Lead, label: string, type = "text") => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={String(lead?.[name] ?? "")}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={lead ? "Editar lead" : "Uma nova oportunidade"}
      description={
        lead
          ? "Mantenha o contexto da conversa sempre atualizado."
          : "Comece pela empresa. Complete os detalhes quando fizer sentido."
      }
      wide
    >
      <form onSubmit={submit} className="form-body">
        <div className="form-grid">
          <label className="span-2">
            Empresa *
            <input
              name="company"
              defaultValue={lead?.company}
              placeholder="Nome da empresa"
              maxLength={200}
              autoFocus
              required
            />
          </label>
          {input("contact_name", "Nome do contato")}
          {input("whatsapp", "WhatsApp", "tel")}
          <label>
            Produto de interesse
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setValue(
                  Number(
                    refs.data?.products.find((p) => p.id === e.target.value)
                      ?.suggested_value || 0,
                  ),
                );
              }}
            >
              <option value="">Selecione</option>
              {refs.data?.products
                .filter((p) => p.active || p.id === product)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Valor potencial (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
          <label>
            Próxima ação
            <input
              name="next_action"
              defaultValue={lead?.next_action}
              placeholder="Ex.: Fazer primeiro contato"
            />
          </label>
          <label>
            Quando? (horário de Brasília)
            <input
              name="next_action_at"
              type="datetime-local"
              defaultValue={localInput(lead?.next_action_at || null)}
            />
          </label>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => setFull(!full)}
        >
          {full ? "Ocultar detalhes" : "Adicionar informações completas"}{" "}
          {full ? "−" : "+"}
        </button>
        <div hidden={!full}>
          <h3 className="form-section">Perfil e origem</h3>
          <div className="form-grid">
            {input("email", "E-mail", "email")}
            {input("website", "Site (https://)", "url")}
            {input("instagram", "Instagram (https://)", "url")}
            {input("niche", "Nicho")}
            {input("city", "Cidade")}
            {input("state", "Estado (UF)")}
            <label>
              Origem
              <select
                name="source"
                defaultValue={lead?.source || "Prospecção manual"}
              >
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Canal
              <select name="channel" defaultValue={lead?.channel || "WhatsApp"}>
                {CHANNELS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Data de inserção
              <input
                name="inserted_on"
                type="date"
                defaultValue={lead?.inserted_on || dayKey()}
                required
              />
            </label>
          </div>
          <h3 className="form-section">Sondagem</h3>
          <div className="form-grid">
            {(["pain", "objective", "discovery_notes"] as const).map(
              (name, i) => (
                <label key={name} className="span-2">
                  {
                    [
                      "Necessidade / dor identificada",
                      "Objetivo do cliente",
                      "Observações da sondagem",
                    ][i]
                  }
                  <textarea name={name} defaultValue={lead?.[name]} />
                </label>
              ),
            )}
            {input("urgency", "Urgência")}
            {input("decision_maker", "Decisor")}
            {input("budget", "Orçamento conhecido (R$)", "number")}
            <label>
              Objeção atual
              <select
                name="objection_id"
                defaultValue={lead?.objection_id || ""}
              >
                <option value="">Nenhuma informada</option>
                {refs.data?.objections.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {lead && ["FECHADO", "PÓS-VENDA", "PERDIDO"].includes(lead.stage) && (
            <>
              <h3 className="form-section">Resultado do negócio</h3>
              <div className="form-grid">
                {input("closed_value", "Valor fechado (R$)", "number")}
                {input("closed_on", "Data de fechamento", "date")}
                {input("payment_method", "Forma de pagamento")}
                {input("loss_reason", "Motivo da perda")}
                {input("closing_notes", "Observação do fechamento")}
              </div>
            </>
          )}
          <label>
            Observações gerais
            <textarea name="notes" defaultValue={lead?.notes} />
          </label>
        </div>
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
          <button className="btn primary" disabled={busy || refs.isLoading}>
            {busy ? "Salvando…" : lead ? "Salvar alterações" : "Cadastrar lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
