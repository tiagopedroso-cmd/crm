"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Filter,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import {
  dailyProspectingFilterOptions,
  dailyProspectingPlan,
  type DailyProspectingFilters,
} from "@/services/daily-prospecting";
import { ErrorState, Loading, Progress } from "@/components/ui";
import { ProspectingEvolutionChart } from "./prospecting-evolution-chart";

const statusText = {
  AVAILABLE: "Capacidade disponível",
  ATTENTION: "Atenção",
  ALMOST_FULL: "Capacidade praticamente esgotada",
  BACKLOG: "Fila acumulada",
} as const;

function dayLabel(day: string, index: number) {
  if (index === 0) return "Amanhã";
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${day}T12:00:00-03:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DailyProspectingTarget({ owner }: { owner: string }) {
  const [filters, setFilters] = useState<DailyProspectingFilters>({});

  const options = useQuery({
    queryKey: ["daily-prospecting-filter-options", owner],
    queryFn: () => dailyProspectingFilterOptions(owner),
    staleTime: 5 * 60_000,
  });

  const q = useQuery({
    queryKey: ["daily-prospecting", owner, filters],
    queryFn: () => dailyProspectingPlan(owner, filters),
    refetchInterval: 60_000,
  });

  const hasFilters = Boolean(
    filters.responsibleId || filters.campaign || filters.niche,
  );

  if (q.isLoading) {
    return <section className="card daily-target"><Loading /></section>;
  }

  if (q.isError || !q.data) {
    return (
      <section className="card daily-target">
        <ErrorState retry={() => q.refetch()} />
      </section>
    );
  }

  const p = q.data;
  const next = p.queue[0];

  return (
    <>
      <section className="card daily-target">
        <div className="daily-target-head">
          <div>
            <p className="eyebrow">META DE HOJE</p>
            <h2>{p.performed} / {p.capacity} contatos realizados</h2>
            <p className="muted">
              A capacidade restante é preenchida primeiro por follow-ups
              elegíveis e depois por novos leads.
            </p>
          </div>
          <span className={`capacity-status ${p.status.toLowerCase()}`}>
            {p.status === "BACKLOG" ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {statusText[p.status]}
          </span>
        </div>

        <div className="daily-target-filters">
          <div className="daily-filter-title">
            <Filter size={16} />
            <strong>Filtrar meta</strong>
          </div>

          <label>
            <span>Responsável</span>
            <select
              value={filters.responsibleId || ""}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  responsibleId: e.target.value || undefined,
                }))
              }
            >
              <option value="">Todos</option>
              {(options.data?.responsibles || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Campanha</span>
            <select
              value={filters.campaign || ""}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  campaign: e.target.value || undefined,
                }))
              }
            >
              <option value="">Todas as campanhas</option>
              {(options.data?.campaigns || []).map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Nicho</span>
            <select
              value={filters.niche || ""}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  niche: e.target.value || undefined,
                }))
              }
            >
              <option value="">Todos os nichos</option>
              {(options.data?.niches || []).map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn daily-filter-clear"
            disabled={!hasFilters}
            onClick={() => setFilters({})}
          >
            <X size={15} />
            Limpar
          </button>
        </div>

        <Progress value={p.performed} max={p.capacity} />

        <div className="daily-target-stats">
          <div><strong>{p.remaining}</strong><span>disponíveis hoje</span></div>
          <div><strong>{p.performedFollowups}</strong><span>follow-ups realizados</span></div>
          <div><strong>{p.performedNew}</strong><span>novos contatos realizados</span></div>
          <div><strong>{p.overdueFollowups}</strong><span>follow-ups atrasados</span></div>
        </div>

        <div className="smart-plan">
          <div>
            <Sparkles size={18} />
            <span>{p.recoveryMode ? "Recuperação de backlog" : "Ritmo sustentável"}</span>
            <strong>Referência: {p.referenceNewLeads} novos leads/dia</strong>
          </div>
          <p>
            Fila recomendada agora: <b>{p.queuedFollowups} follow-ups</b> +{" "}
            <b>{p.queuedNew} novos contatos</b>
            {p.backlogRemaining
              ? ` · ${p.backlogRemaining} follow-ups ficam pendentes para o próximo dia útil.`
              : "."}
          </p>
        </div>

        <div className="daily-target-grid">
          <div className="today-queue">
            <h3>Quem contatar agora</h3>
            {p.queue.slice(0, 5).map((item, index) => (
              <Link
                href={`/leads/${item.lead.id}`}
                key={item.lead.id}
                className="queue-row"
              >
                <span className="queue-order">{index + 1}</span>
                <div>
                  <strong>{item.lead.company}</strong>
                  <small>
                    {item.kind === "FOLLOWUP"
                      ? `Tentativa ${item.attempt}/5${
                          item.overdueBusinessDays
                            ? ` · atrasado ${item.overdueBusinessDays} dia(s) útil(eis)`
                            : " · disponível hoje"
                        }`
                      : "Novo lead · primeiro contato"}
                  </small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ))}

            {!p.queue.length && (
              <p className="muted">
                Nenhum contato pendente para os filtros selecionados.
              </p>
            )}

            {next && (
              <Link className="btn primary" href={`/leads/${next.lead.id}`}>
                Próximo lead <ArrowRight size={16} />
              </Link>
            )}
          </div>

          <div className="forecast-card">
            <h3><CalendarClock size={18} /> Próximas ações</h3>
            <div className="forecast-row">
              <span>Hoje</span>
              <b>{p.eligibleFollowups} follow-ups elegíveis</b>
            </div>
            {p.forecast.map((f, i) => (
              <div className="forecast-row" key={f.day}>
                <span>{dayLabel(f.day, i)}</span>
                <b>{f.followups} follow-ups previstos</b>
              </div>
            ))}
            <small>
              <RotateCcw size={14} />
              Somente dias úteis. Feriados poderão ser adicionados depois sem
              alterar a régua.
            </small>
          </div>
        </div>
      </section>

      <ProspectingEvolutionChart owner={filters.responsibleId || owner} />
    </>
  );
}
