"use client";
import { MessageButton } from "@/components/leads/message-button";
import { CompleteActionButton } from "@/components/leads/complete-action-button";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { listLeads } from "@/services/crm";
import { actionStatus, dateLabel } from "@/lib/utils";
import { Empty, ErrorState, Loading, Pagination } from "@/components/ui";
export function AgendaList({
  compact = false,
  action = "agenda",
  owner,
}: {
  compact?: boolean;
  action?: string;
  owner?: string;
}) {
  const [page, setPage] = useState(0);
  const size = compact ? 5 : 20;
  const query = useQuery({
    queryKey: ["agenda", action, page, size, owner],
    queryFn: () => listLeads({ action, owner_id: owner }, page, size),
  });
  return (
    <section className="card panel">
      <div className="section-heading">
        <div>
          <h2>Próximas ações</h2>
          <p>Comece pelos contatos que precisam de você.</p>
        </div>
        {compact && (
          <Link className="text-button" href="/agenda">
            Ver agenda <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !query.data?.rows.length ? (
        <Empty
          title="Agenda em dia"
          text="Agende uma próxima ação no Lead 360° para manter a conversa viva."
        />
      ) : (
        <>
          <div className="agenda-list">
            {query.data.rows.map((l) => (
              <div
                key={l.id}
                className={`agenda-item ${actionStatus(l) === "Ação atrasada" ? "late" : ""}`}
              >
                <div className="agenda-time">
                  {l.next_action_at
                    ? new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(l.next_action_at))
                    : "—"}
                  <small>
                    {l.next_action_at
                      ? dateLabel(l.next_action_at).slice(0, 5)
                      : "Sem data"}
                  </small>
                </div>
                <div className="agenda-company">
                  <Link className="company-link" href={`/leads/${l.id}`}>
                    {l.company}
                  </Link>
                  <span>{l.next_action || "Definir próxima ação"}</span>
                </div>
                <span
                  className={`badge ${actionStatus(l) === "Ação atrasada" ? "red" : ""}`}
                >
                  {actionStatus(l) || "Agendado"}
                </span>
                {!l.first_contact_at && <MessageButton lead={l} compact />}
                <CompleteActionButton lead={l} compact />
                <Link
                  href={`/leads/${l.id}`}
                  className="icon-btn"
                  aria-label={`Abrir ${l.company}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            ))}
          </div>
          {!compact && (
            <Pagination
              page={page}
              count={query.data.count}
              onChange={setPage}
              size={size}
            />
          )}
        </>
      )}
    </section>
  );
}
