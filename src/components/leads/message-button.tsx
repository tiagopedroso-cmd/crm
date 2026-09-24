"use client";
import { useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useProfile } from "@/hooks/use-crm";
import { leadMessage, whatsappUrl } from "@/lib/utils";
import type { Lead } from "@/types/crm";
import { Modal } from "@/components/ui";

export function MessageButton({
  lead,
  compact = false,
}: {
  lead: Lead;
  compact?: boolean;
}) {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const id = useId();
  const validPhone = whatsappUrl(lead.whatsapp);
  const href = whatsappUrl(lead.whatsapp, message);
  return (
    <>
      <button
        type="button"
        className={compact ? "icon-btn" : "btn whatsapp wide"}
        aria-label={`Enviar mensagem para ${lead.company}`}
        title={
          validPhone
            ? "Enviar mensagem pelo WhatsApp"
            : "Cadastre um telefone válido para enviar mensagem"
        }
        disabled={!validPhone}
        onClick={() => {
          setMessage(
            leadMessage(lead.company, lead.contact_name, profile.display_name),
          );
          setOpen(true);
        }}
      >
        <MessageCircle size={18} />
        {!compact && "Enviar mensagem"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mensagem pelo WhatsApp"
        description="Revise o texto. O envio será feito por você no WhatsApp."
      >
        <div className="form-body">
          <p>
            <strong>{lead.company}</strong>
            <br />
            Contato: {lead.contact_name || "Responsável a identificar"}
            <br />
            Telefone: {lead.whatsapp}
          </p>
          <label htmlFor={id}>Mensagem personalizada</label>
          <textarea
            id={id}
            rows={8}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="modal-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            {href && message.trim() && (
              <a
                className="btn whatsapp"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir no WhatsApp
              </a>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
