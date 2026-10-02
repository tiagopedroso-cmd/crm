"use client";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  ArrowUpRight,
  Wallet,
  Target,
  CalendarDays,
} from "lucide-react";
import { useMetrics } from "@/hooks/use-metrics";
import { useProfile, useReference } from "@/hooks/use-crm";
import { money, dayKey } from "@/lib/utils";
import { PeriodFilter } from "@/components/analytics/period-filter";
import { AgendaList } from "@/components/analytics/agenda-list";
import { Funnel } from "@/components/analytics/funnel";
import { PipelineValues } from "@/components/analytics/pipeline-values";
import { DailyProspectingTarget } from "@/components/analytics/daily-prospecting-target";
import { Loading, ErrorState, Progress } from "@/components/ui";
export default function Dashboard() {
  const profile = useProfile();
  const { query, filterProps, valid } = useMetrics("month", profile.id);
  const refs = useReference();
  if (query.isLoading || refs.isLoading) return <Loading />;
  if (query.isError || refs.isError)
    return (
      <ErrorState
        retry={() => {
          query.refetch();
          refs.refetch();
        }}
      />
    );
  const m = query.data;
  const goals = refs.data?.goals;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU DIA, COM DIREÃ‡ÃƒO</p>
          <h1>
            Vamos fazer acontecer
            {profile.display_name
              ? `, ${profile.display_name.split(" ")[0]}`
              : ""}
            .
          </h1>
          <p>
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "full",
              timeZone: "America/Sao_Paulo",
            }).format(new Date(`${dayKey()}T12:00:00-03:00`))}
          </p>
        </div>
        <PeriodFilter {...filterProps} />
      </div>
      {!valid && (
        <p role="alert" className="error">
          O fim do perÃ­odo deve ser igual ou posterior ao inÃ­cio.
        </p>
      )}
      {m && goals && (
        <>
          <DailyProspectingTarget owner={profile.id} />
          <PipelineValues owner={profile.id} />
          <div className="kpi-grid">
            {[
              [
                "Leads no perÃ­odo",
                m.leads,
                `${m.new_today} hoje Â· ${m.new_month} no mÃªs`,
                Users,
              ],
              [
                "Oportunidades abertas",
                m.opportunities,
                `${m.negotiations} em negociaÃ§Ã£o`,
                TrendingUp,
              ],
              [
                "Faturamento",
                money(m.revenue),
                `${m.closings} negÃ³cios fechados`,
                Wallet,
              ],
              [
                "ConversÃ£o",
                `${m.conversion}%`,
                "Leads do perÃ­odo â†’ clientes",
                Target,
              ],
            ].map(([label, value, hint, Icon]) => {
              const I = Icon as typeof Users;
              return (
                <section className="card kpi" key={String(label)}>
                  <div>
                    <span>{String(label)}</span>
                    <I size={19} />
                  </div>
                  <strong>{String(value)}</strong>
                  <small>{String(hint)}</small>
                </section>
              );
            })}
          </div>
          <section className="today-strip">
            <div>
              <CalendarDays size={20} />
              <strong>Agenda de hoje</strong>
            </div>
            <Link href="/agenda">
              {m.due_today}
              <span>AÃ§Ãµes para hoje Â· {m.followups_today} follow-ups</span>
            </Link>
            <Link
              className={m.overdue ? "overdue" : ""}
              href="/agenda?f=overdue"
            >
              {m.overdue}
              <span>AÃ§Ãµes atrasadas Â· {m.followups_overdue} follow-ups</span>
            </Link>
            <div>
              <strong>{m.awaiting_proposals}</strong>
              <span>Propostas sem retorno</span>
            </div>
            <div>
              <strong>{m.meetings}</strong>
              <span>ReuniÃµes agendadas</span>
            </div>
            <Link href="/agenda?f=missing">
              {m.missing_action}
              <span>Sem prÃ³xima aÃ§Ã£o</span>
            </Link>
          </section>
          <div className="dashboard-columns">
            <AgendaList compact owner={profile.id} />
            <section className="card panel weekly-goal">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CONSISTÃŠNCIA TRAZ RESULTADO</p>
                  <h2>Seu ritmo da semana</h2>
                </div>
                <Target size={21} />
              </div>
              <div className="weekly-value">{money(m.weekly_revenue)}</div>
              <p className="muted">
                de {money(goals.weekly_revenue)} em negÃ³cios fechados
              </p>
              <Progress value={m.weekly_revenue} max={goals.weekly_revenue} />
              <div className="remaining">
                <span>Faltam para a meta</span>
                <strong>
                  {money(Math.max(0, goals.weekly_revenue - m.weekly_revenue))}
                </strong>
              </div>
              <div className="mini-metrics">
                <div>
                  <strong>{m.proposals}</strong>
                  <span>Propostas no perÃ­odo</span>
                </div>
                <div>
                  <strong>{money(m.ticket)}</strong>
                  <span>Ticket mÃ©dio</span>
                </div>
              </div>
              <Link className="text-button" href="/placar">
                Acompanhar placar <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
          <div className="dashboard-columns">
            <Funnel metrics={m} />
            <section className="card panel">
              <p className="eyebrow">OLHANDO PARA FRENTE</p>
              <h2>Potencial em movimento</h2>
              <p className="pipeline-value">{money(m.pipeline)}</p>
              <p className="muted">
                Valor potencial de todos os negÃ³cios ativos.
              </p>
              <hr />
              <h3>Meta mensal total</h3>
              <div className="goal-row">
                <strong>{money(m.monthly_revenue)}</strong>
                <span>
                  /{" "}
                  {money(goals.monthly_revenue + goals.monthly_system_revenue)}
                </span>
              </div>
              <Progress
                value={m.monthly_revenue}
                max={goals.monthly_revenue + goals.monthly_system_revenue}
              />
              <p className="small muted">
                Principal: {money(goals.monthly_revenue)} Â· Sistemas:{" "}
                {money(goals.monthly_system_revenue)}
              </p>
              <Link className="btn" href="/pipeline">
                Abrir pipeline <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
        </>
      )}
    </>
  );
}

