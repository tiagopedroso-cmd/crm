"use client";
import { useState } from "react";
import { useMetrics } from "@/hooks/use-metrics";
import { useProfile, useReference } from "@/hooks/use-crm";
import { PeriodFilter } from "@/components/analytics/period-filter";
import { Funnel } from "@/components/analytics/funnel";
import { Loading, ErrorState, Empty, Progress } from "@/components/ui";
import { money } from "@/lib/utils";
export default function Reports() {
  const profile = useProfile();
  const refs = useReference();
  const [owner, setOwner] = useState("");
  const { query, filterProps, valid } = useMetrics(
    "month",
    profile.role === "ADMIN" ? owner : profile.id,
  );
  const m = query.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DADOS PARA DECIDIR</p>
          <h1>Relatórios comerciais</h1>
          <p>Entenda o que entrou, o que avançou e o que virou negócio.</p>
        </div>
        <PeriodFilter {...filterProps} />
      </div>
      {profile.role === "ADMIN" && (
        <label className="owner-filter">
          Responsável
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Toda a operação</option>
            {refs.data?.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || p.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {!valid ? (
        <p role="alert" className="error">
          Período inválido.
        </p>
      ) : query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        m && (
          <>
            <div className="report-metrics">
              {[
                ["Leads adicionados", m.leads],
                [
                  "Contatos realizados",
                  m.events.find((e) => e.stage === "CONTATADO")?.total || 0,
                ],
                [
                  "Respostas",
                  m.events.find((e) => e.stage === "RESPONDEU")?.total || 0,
                ],
                ["Propostas", m.proposals],
                ["Fechamentos", m.closings],
                ["Receita", money(m.revenue)],
                ["Pipeline atual", money(m.pipeline)],
                ["Conversão", `${m.conversion}%`],
                ["Ticket médio", money(m.ticket)],
              ].map(([label, value]) => (
                <div key={label} className="card">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <Funnel metrics={m} />
            <div className="report-grid">
              {[
                ["Origem dos leads", m.sources],
                ["Produtos de interesse", m.products],
                ["Nichos", m.niches],
                ["Objeções mais frequentes", m.objections],
                ["Motivos de perda", m.loss_reasons],
                ["Produtos com perdas", m.loss_products],
                ["Nichos com perdas", m.loss_niches],
              ].map(([title, raw]) => {
                const data = raw as typeof m.sources;
                const max = Math.max(1, ...data.map((d) => d.total));
                return (
                  <section className="card panel" key={String(title)}>
                    <h2>{String(title)}</h2>
                    {data.length ? (
                      data.map((d) => (
                        <div className="distribution" key={d.label}>
                          <div>
                            <span>{d.label}</span>
                            <strong>{d.total}</strong>
                          </div>
                          <Progress value={d.total} max={max} />
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="Sem registros"
                        text="Os dados aparecerão conforme sua operação avançar."
                      />
                    )}
                  </section>
                );
              })}
            </div>
            <p className="muted">
              {m.losses} perdas no período. Origem, produto, nicho e objeção
              consideram leads inseridos no período; perdas consideram a data do
              histórico de perda e o estado atual do lead.
            </p>
          </>
        )
      )}
    </>
  );
}
