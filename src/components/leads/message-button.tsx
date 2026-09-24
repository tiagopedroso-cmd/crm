"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Copy } from "lucide-react";
import { useProfile, useReference, useRefresh } from "@/hooks/use-crm";
import { dateLabel, inputToInstant, whatsappUrl } from "@/lib/utils";
import { followupDate, renderTemplate, suggestTemplate } from "@/lib/outreach";
import {
  listTemplates,
  confirmApproach,
  scheduleFollowup,
} from "@/services/outreach";
import { getLead } from "@/services/crm";
import type { Lead } from "@/types/crm";
import { Modal, Loading, Notice } from "@/components/ui";

export function MessageButton({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const valid = whatsappUrl(lead.whatsapp);
  const first = !lead.first_contact_at;
  const label = first ? "Enviar abordagem" : "WhatsApp";
  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn" : "btn whatsapp wide"}
        aria-label={label + " para " + lead.company}
        title={
          valid
            ? label
            : "Cadastre o WhatsApp deste lead para iniciar uma abordagem."
        }
        disabled={!valid}
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={18} />
        {!compact && label}
      </button>
      {!valid && !compact && (
        <small className="muted">
          Cadastre o WhatsApp deste lead para iniciar uma abordagem.
        </small>
      )}
      {open && <ApproachDialog lead={lead} onClose={() => setOpen(false)} />}
    </>
  );
}
function ApproachDialog({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const profile = useProfile();
  const refs = useReference();
  const refresh = useRefresh();
  const templates = useQuery({
    queryKey: ["message-templates", profile.id],
    queryFn: listTemplates,
  });
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"edit" | "confirm" | "followup">("edit");
  const [sent, setSent] = useState<{
    id: string;
    template: string;
    message: string;
    phone: string;
  } | null>(null);
  const [current, setCurrent] = useState(lead);
  const [at, setAt] = useState(followupDate);
  const [replace, setReplace] = useState(false);
  const initialized = useRef(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const product =
    refs.data?.products.find((p) => p.id === lead.product_id)?.name || "";
  function choose(id: string) {
    const template = templates.data?.find((t) => t.id === id);
    if (!template) return;
    const rendered = renderTemplate(
      template.message,
      lead,
      product,
      profile.display_name,
    );
    setSelected(id);
    setMessage(rendered.text);
    setNotice(
      rendered.unknown.length
        ? "Revise as informações não reconhecidas no modelo: " +
            rendered.unknown.join(", ")
        : "",
    );
  }
  useEffect(() => {
    if (initialized.current || !templates.data || !refs.data) return;
    initialized.current = true;
    const template = suggestTemplate(templates.data, lead, product);
    if (template) {
      const rendered = renderTemplate(
        template.message,
        lead,
        product,
        profile.display_name,
      );
      setSelected(template.id);
      setMessage(rendered.text);
      if (rendered.unknown.length)
        setNotice(
          "Revise as variáveis não reconhecidas: " +
            rendered.unknown.join(", "),
        );
    }
  }, [templates.data, refs.data, lead, product, profile.display_name]);
  const href = whatsappUrl(lead.whatsapp, message);
  const canOpen = Boolean(
    href &&
    selected &&
    message.trim() &&
    !/\{\{|\}\}|\[informação a revisar\]/.test(message),
  );
  async function confirm() {
    if (!sent || busy) return;
    setBusy(true);
    setNotice("");
    try {
      await confirmApproach({ ...sent, lead: lead.id });
      setPhase("followup");
      const fresh = await getLead(lead.id);
      setCurrent(fresh);
      await refresh();
    } catch {
      setNotice(
        "Não foi possível concluir. Tente novamente: a mesma confirmação não será registrada duas vezes.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function schedule() {
    setBusy(true);
    setNotice("");
    try {
      const instant = inputToInstant(at);
      if (!instant || new Date(instant) <= new Date()) throw new Error("date");
      const saved = await scheduleFollowup(
        lead.id,
        instant,
        current.next_action,
        current.next_action_at,
      );
      if (!saved) {
        setCurrent(await getLead(lead.id));
        setReplace(false);
        setNotice(
          "A próxima ação mudou. Confira os dados atuais e confirme novamente.",
        );
        return;
      }
      await refresh();
      onClose();
    } catch {
      setNotice("Não foi possível agendar. Confira a data e tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Enviar abordagem"
      description="Uma conversa por vez. O envio é concluído por você dentro do WhatsApp."
      wide
    >
      <div className="form-body approach-layout">
        <aside className="approach-context">
          <h3>{lead.company}</h3>
          <dl className="facts">
            {[
              ["Responsável", lead.contact_name || "Não informado"],
              ["WhatsApp", lead.whatsapp],
              ["Nicho", lead.niche || "Não informado"],
              ["Produto", product || "Não definido"],
              ["Origem", lead.source],
              ["Site", lead.website || "Não cadastrado"],
              ["Indicado por", lead.referred_by || "Não informado"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
        <div className="approach-editor">
          <Notice text={notice} />
          {phase === "edit" && (
            <>
              {templates.isLoading || refs.isLoading ? (
                <Loading />
              ) : templates.isError || refs.isError ? (
                <div className="notice error">
                  Não foi possível carregar os modelos.{" "}
                  <button
                    className="btn"
                    onClick={() => {
                      void templates.refetch();
                      void refs.refetch();
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <>
                  <label>
                    Modelo
                    <select
                      value={selected}
                      onChange={(event) => choose(event.target.value)}
                    >
                      <option value="" disabled>
                        Selecione um modelo
                      </option>
                      {templates.data
                        ?.filter((t) => t.is_active)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.is_default ? " · Padrão" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!templates.data?.some((t) => t.is_active) && (
                    <p>
                      Nenhum modelo ativo.{" "}
                      <Link href="/configuracoes">Criar em Configurações</Link>
                    </p>
                  )}
                  <p className="muted">
                    Confira as observações sobre o site e o negócio antes de
                    usar a sugestão. Trocar o modelo substitui o rascunho
                    abaixo.
                  </p>
                  <label htmlFor={messageId}>Mensagem personalizada</label>
                  <textarea
                    id={messageId}
                    className="approach-message"
                    rows={12}
                    maxLength={8000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <small className="muted">
                    Esta edição vale apenas para esta abordagem.
                  </small>
                  <div className="modal-actions approach-actions">
                    <button
                      className="btn"
                      disabled={!message.trim()}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(message);
                          setNotice("Mensagem copiada.");
                        } catch {
                          setNotice(
                            "Não foi possível copiar. Selecione o texto e copie manualmente.",
                          );
                        }
                      }}
                    >
                      <Copy size={16} />
                      Copiar mensagem
                    </button>
                    {canOpen ? (
                      <a
                        className="btn whatsapp"
                        href={href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          setSent({
                            id: sent?.id || crypto.randomUUID(),
                            template: selected,
                            message,
                            phone: new URL(href!).pathname.slice(1),
                          });
                          setNotice("");
                          setPhase("confirm");
                        }}
                      >
                        Enviar pelo WhatsApp
                      </a>
                    ) : (
                      <button className="btn whatsapp" disabled>
                        Enviar pelo WhatsApp
                      </button>
                    )}
                    <button className="btn" onClick={onClose}>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {phase === "confirm" && (
            <>
              <h3>WhatsApp aberto. A mensagem foi enviada?</h3>
              <p>
                Confirme somente depois de enviar no WhatsApp. Se alterou o
                texto lá, ajuste abaixo para guardar o que realmente enviou.
              </p>
              <label>
                Texto efetivamente enviado
                <textarea
                  rows={9}
                  maxLength={8000}
                  value={sent?.message || ""}
                  onChange={(e) =>
                    setSent((s) => (s ? { ...s, message: e.target.value } : s))
                  }
                />
              </label>
              <div className="modal-actions approach-actions">
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    !sent?.message.trim() ||
                    /\{\{|\}\}/.test(sent?.message || "")
                  }
                  onClick={() => void confirm()}
                >
                  {busy ? "Registrando…" : "Sim, registrar envio"}
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setPhase("edit");
                    setSent(null);
                  }}
                >
                  Não / Voltar
                </button>
              </div>
            </>
          )}
          {phase === "followup" && (
            <>
              <h3>Envio registrado. Agendar primeiro follow-up?</h3>
              <p>
                Próxima ação: <strong>1º follow-up WhatsApp</strong>
              </p>
              <label>
                Próximo follow-up (Brasília)
                <input
                  ref={dateRef}
                  type="datetime-local"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                  required
                />
              </label>
              {current.next_action_at && (
                <div className="notice">
                  <p>
                    Ação atual: <strong>{current.next_action}</strong> ·{" "}
                    {dateLabel(current.next_action_at, true)}
                  </p>
                  <label className="check-inline">
                    <input
                      type="checkbox"
                      checked={replace}
                      onChange={(e) => setReplace(e.target.checked)}
                    />
                    Confirmo substituir esta próxima ação.
                  </label>
                </div>
              )}
              <div className="modal-actions approach-actions">
                <button
                  className="btn primary"
                  disabled={
                    busy || Boolean(current.next_action_at && !replace) || !at
                  }
                  onClick={() => void schedule()}
                >
                  Agendar
                </button>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => dateRef.current?.focus()}
                >
                  Alterar data
                </button>
                <button className="btn" disabled={busy} onClick={onClose}>
                  Agora não
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
