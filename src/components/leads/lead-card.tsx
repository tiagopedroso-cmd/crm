"use client";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { actionStatus, dateLabel, money, dayKey } from "@/lib/utils";
import { businessDaysLate } from "@/lib/business-days";
import type { Lead } from "@/types/crm";
import { StageControl } from "./stage-control";
import { CompleteActionButton } from "./complete-action-button";
import { MessageButton } from "./message-button";
import { FollowupButton } from "./followup-button";

export function LeadCard({
  lead,
  product,
  stageControl = true,
}: {
  lead: Lead;
  product?: string;
  stageControl?: boolean;
}) {
  const status = actionStatus(lead);
  const cadenceAttempt = Math.min(5, (lead.cadence_step || 0) + 1);
  const cadenceDay = lead.cadence_next_at?.slice(0, 10) || "";
  const lateDays = cadenceDay ? businessDaysLate(cadenceDay, dayKey()) : 0;

  return (
    <article className="lead-card">
      <div className="card-top">
        <span className="company-initial">
          {lead.company.slice(0, 2).toUpperCase()}
        </span>

        <div className="actions">
          {stageControl && <CompleteActionButton lead={lead} compact />}
          {stageControl && (
            <MessageButton lead={lead} compact showFollowup={false} />
          )}
          <Link
            href={`/leads/${lead.id}`}
            className="icon-btn"
            aria-label={`Abrir ${lead.company}`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>

      <Link className="company-link" href={`/leads/${lead.id}`}>
        {lead.company}
      </Link>

      <p className="muted">{lead.contact_name || "Contato a identificar"}</p>
      <p className="muted">Cadastrado por: {lead.creator_name}</p>

      <div className="card-money">
        <span>{product || "Produto a definir"}</span>
        <strong>{money(lead.potential_value)}</strong>
      </div>

      {lead.stage === "CONTATADO" && lead.cadence_status && (
        <div className="cadence-strip">
          <strong>
            {lead.cadence_status === "COMPLETED"
              ? "Régua concluída · Tentativa 5/5"
              : `Tentativa ${cadenceAttempt}/5`}
          </strong>

          <small>{lead.cadence_campaign || "Cadência comercial"}</small>

          {lead.cadence_status === "IN_PROGRESS" && cadenceDay && (
            <small
              className={`cadence-due ${lateDays ? "overdue" : ""}`}
            >
              {lateDays
                ? `Follow-up atrasado há ${lateDays} dia(s) útil(eis)`
                : cadenceDay === dayKey()
                  ? "Follow-up disponível hoje"
                  : `Próximo contato: ${new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    }).format(
                      new Date(`${cadenceDay}T12:00:00-03:00`),
                    )}`}
            </small>
          )}

          {lead.cadence_status === "COMPLETED" && (
            <small>
              Sem resposta · considere mover para Perdido (Não respondeu).
            </small>
          )}
        </div>
      )}

      <div
        className={`next-action ${
          status === "Ação atrasada" ? "overdue" : ""
        }`}
      >
        <Clock3 size={15} />
        <div>
          {lead.next_action || "Defina o próximo passo"}
          <small>
            {lead.next_action_at
              ? dateLabel(lead.next_action_at, true)
              : "Sem próxima ação"}
          </small>
        </div>
      </div>

      {status && (
        <span
          className={`badge ${
            status === "Ação atrasada" ? "red" : "amber"
          }`}
        >
          {status}
        </span>
      )}

      {lead.is_demo && <span className="badge">Demonstração</span>}

      {stageControl && <FollowupButton lead={lead} />}
      {stageControl && <StageControl lead={lead} />}
    </article>
  );
}
