"use client";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { actionStatus, dateLabel, money } from "@/lib/utils";
import type { Lead } from "@/types/crm";
import { StageControl } from "./stage-control";
import { CompleteActionButton } from "./complete-action-button";
import { MessageButton } from "./message-button";
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
  return (
    <article className="lead-card">
      <div className="card-top">
        <span className="company-initial">
          {lead.company.slice(0, 2).toUpperCase()}
        </span>
        <div className="actions">
          {stageControl && <CompleteActionButton lead={lead} compact />}
          {stageControl && <MessageButton lead={lead} compact />}
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
      <div className="card-money">
        <span>{product || "Produto a definir"}</span>
        <strong>{money(lead.potential_value)}</strong>
      </div>
      <div
        className={`next-action ${status === "Ação atrasada" ? "overdue" : ""}`}
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
          className={`badge ${status === "Ação atrasada" ? "red" : "amber"}`}
        >
          {status}
        </span>
      )}
      {lead.is_demo && <span className="badge">Demonstração</span>}
      {stageControl && <StageControl lead={lead} />}
    </article>
  );
}
