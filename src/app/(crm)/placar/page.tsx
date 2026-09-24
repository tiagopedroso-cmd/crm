"use client";
import { useMetrics } from "@/hooks/use-metrics";
import { useProfile, useReference } from "@/hooks/use-crm";
import { money } from "@/lib/utils";
import { Funnel } from "@/components/analytics/funnel";
import { Loading, ErrorState, Progress } from "@/components/ui";
export default function Score() {
  const profile = useProfile();
  const { query } = useMetrics("week", profile.id);
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
  const m = query.data,
    g = refs.data?.goals;
  if (!m || !g) return null;
  const count = (stage: string) =>
    m.events.find((e) => e.stage === stage)?.total || 0;
  const rows: [string, number, number][] = [
    ["Novos leads", m.leads, g.weekly_leads],
    ["Abordagens", count("CONTATADO"), g.weekly_contacts],
    ["Respostas", count("RESPONDEU"), g.weekly_responses],
    ["Sondagens", count("SONDAGEM"), g.weekly_discoveries],
    ["Oportunidades", count("OPORTUNIDADE"), g.weekly_opportunities],
    ["Propostas", count("PROPOSTA"), g.weekly_proposals],
    ["Negociações", count("NEGOCIAÇÃO"), g.weekly_negotiations],
    ["Fechamentos", m.closings, g.weekly_closings],
    ["Faturamento", m.revenue, g.weekly_revenue],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">REALIZADO × META</p>
          <h1>Placar comercial</h1>
          <p>Seu desempenho nesta semana, de segunda-feira até hoje.</p>
        </div>
        <span className="badge">Metas pessoais</span>
      </div>
      <div className="score-grid">
        {rows.map(([name, value, max], i) => (
          <section
            className={`card score-card ${i === 8 ? "score-financial" : ""}`}
            key={name}
          >
            <p>{name}</p>
            <div>
              <strong>{i === 8 ? money(value) : value}</strong>
              <span>/ {i === 8 ? money(max) : max}</span>
            </div>
            <Progress value={value} max={max} />
            <small>
              {Math.round((value / max) * 100)}% da meta{" "}
              {value >= max ? "· Meta alcançada" : ""}
            </small>
          </section>
        ))}
      </div>
      <Funnel metrics={m} />
      <p className="muted small">
        Atividades contam leads distintos que visitaram a etapa na semana. O
        funil acompanha a coorte de leads inseridos na semana. Faturamento
        utiliza o valor fechado e a data de fechamento.
      </p>
    </>
  );
}
