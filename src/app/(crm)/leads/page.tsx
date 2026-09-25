"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Download, ArrowUpRight } from "lucide-react";
import { listLeads, exportLeads } from "@/services/crm";
import { useReference } from "@/hooks/use-crm";
import {
  EMPTY_FILTERS,
  LEAD_SORTS,
  type LeadSort,
  type Filters,
} from "@/types/crm";
import { actionStatus, dateLabel, download, money, toCsv } from "@/lib/utils";
import { LeadFilters } from "@/components/leads/filters";
import { LeadCard } from "@/components/leads/lead-card";
import { MessageButton } from "@/components/leads/message-button";
import { CompleteActionButton } from "@/components/leads/complete-action-button";
import { StageControl } from "@/components/leads/stage-control";
import {
  Loading,
  ErrorState,
  Empty,
  Pagination,
  Notice,
} from "@/components/ui";
export default function Leads() {
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    sort: "company_sort",
    direction: "asc",
  });
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
    queryFn: () =>
      listLeads({ ...debounced, sort: debounced.sort || "company_sort" }, page),
  });
  const sort = filters.sort || "company_sort";
  const changeSort = (key: LeadSort) => {
    setPage(0);
    setFilters((f) => ({
      ...f,
      sort: key,
      direction: sort === key && f.direction !== "desc" ? "desc" : "asc",
    }));
  };
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
              const rows = await exportLeads({
                ...debounced,
                sort: debounced.sort || "company_sort",
              });
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
      <div className="toolbar">
        <label>
          Ordenar por{" "}
          <select
            aria-label="Ordenar por"
            value={sort}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({
                ...f,
                sort: e.target.value as LeadSort,
                direction: "asc",
              }));
            }}
          >
            {Object.entries(LEAD_SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={() => changeSort(sort)}>
          {filters.direction === "desc" ? "Decrescente ↓" : "Crescente ↑"}
        </button>
      </div>
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
                  {(
                    [
                      "company_sort",
                      "stage",
                      "product_sort",
                      "potential_value",
                      "next_action_at",
                      "creator_sort",
                    ] as LeadSort[]
                  ).map((key) => (
                    <th
                      key={key}
                      aria-sort={
                        sort === key
                          ? filters.direction === "desc"
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button
                        className="text-button"
                        onClick={() => changeSort(key)}
                      >
                        {LEAD_SORTS[key]}{" "}
                        {sort === key
                          ? filters.direction === "desc"
                            ? "↓"
                            : "↑"
                          : "↕"}
                      </button>
                    </th>
                  ))}
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
                      <small>
                        {refs.data?.products.find((p) => p.id === l.product_id)
                          ?.name || "Não definido"}
                      </small>
                    </td>
                    <td>
                      <strong>{money(l.potential_value)}</strong>
                    </td>
                    <td>
                      <span>{l.next_action || "Defina o próximo passo"}</span>
                      <CompleteActionButton lead={l} compact />
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
                    <td>{l.creator_name}</td>
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
