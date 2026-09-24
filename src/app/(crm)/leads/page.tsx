"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowUpRight } from "lucide-react";
import { listLeads, exportLeads } from "@/services/crm";
import { useReference } from "@/hooks/use-crm";
import { EMPTY_FILTERS, type Filters } from "@/types/crm";
import { actionStatus, dateLabel, download, money, toCsv } from "@/lib/utils";
import { LeadFilters } from "@/components/leads/filters";
import { LeadCard } from "@/components/leads/lead-card";
import { MessageButton } from "@/components/leads/message-button";
import { StageControl } from "@/components/leads/stage-control";
import {
  Loading,
  ErrorState,
  Empty,
  Pagination,
  Notice,
} from "@/components/ui";
export default function Leads() {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [debounced, setDebounced] = useState(filters);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const refs = useReference();
  useEffect(() => {
    setFilters((f) => ({
      ...f,
      search: new URLSearchParams(window.location.search).get("q") || "",
    }));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filters);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [filters]);
  const query = useQuery({
    queryKey: ["leads", debounced, page],
    queryFn: () => listLeads(debounced, page),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RELACIONAMENTOS</p>
          <h1>Meus leads</h1>
          <p>Cada contato, uma conversa para continuar.</p>
        </div>
        <button
          className="btn"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const rows = await exportLeads(debounced);
              download(
                toCsv(
                  rows.map((l) => ({
                    ...l,
                    product:
                      refs.data?.products.find((p) => p.id === l.product_id)
                        ?.name || "",
                  })),
                ),
                "inovalogix-leads.csv",
                "text/csv;charset=utf-8",
              );
              setMessage(
                `${rows.length} leads exportados com os filtros atuais.`,
              );
            } catch {
              setMessage("Falha ao exportar os leads.");
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download size={17} />
          {exporting ? "Exportando…" : "Exportar CSV"}
        </button>
      </div>
      <Notice text={message} />
      <LeadFilters value={filters} onChange={setFilters} />
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !query.data?.rows.length ? (
        <Empty />
      ) : (
        <>
          <div className="table-desktop card">
            <table>
              <thead>
                <tr>
                  <th>Empresa / contato</th>
                  <th>Etapa</th>
                  <th>Produto / valor</th>
                  <th>Próximo passo</th>
                  <th aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link className="company-link" href={`/leads/${l.id}`}>
                        {l.company}
                      </Link>
                      <small>
                        {l.contact_name || "Contato a identificar"}{" "}
                        {l.is_demo ? "· Demonstração" : ""}
                      </small>
                    </td>
                    <td>
                      <StageControl lead={l} />
                    </td>
                    <td>
                      <strong>{money(l.potential_value)}</strong>
                      <small>
                        {refs.data?.products.find((p) => p.id === l.product_id)
                          ?.name || "Não definido"}
                      </small>
                    </td>
                    <td>
                      <span>{l.next_action || "Defina o próximo passo"}</span>
                      <small
                        className={
                          actionStatus(l) === "Ação atrasada" ? "error" : ""
                        }
                      >
                        {l.next_action_at
                          ? dateLabel(l.next_action_at, true)
                          : "Sem próxima ação"}
                      </small>
                    </td>
                    <td>
                      <MessageButton lead={l} compact />
                      <Link
                        className="icon-btn"
                        href={`/leads/${l.id}`}
                        aria-label={`Abrir ${l.company}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-leads">
            {query.data.rows.map((l) => (
              <LeadCard
                key={l.id}
                lead={l}
                product={
                  refs.data?.products.find((p) => p.id === l.product_id)?.name
                }
              />
            ))}
          </div>
          <Pagination page={page} count={query.data.count} onChange={setPage} />
        </>
      )}
    </>
  );
}
