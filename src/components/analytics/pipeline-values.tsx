"use client";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { pipelineValues } from "@/services/crm";
import { money } from "@/lib/utils";
import { NEGOTIATING_STAGES } from "@/lib/pipeline-values";
import { Loading, ErrorState } from "@/components/ui";

export function PipelineValues({ owner }: { owner: string }) {
  const query = useQuery({
    queryKey: ["pipeline-values", owner],
    queryFn: () => pipelineValues(owner),
  });
  return (
    <section
      className="card panel pipeline-values"
      aria-labelledby="pipeline-values-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">VALORES POR ETAPA</p>
          <h2 id="pipeline-values-title">Seu funil em valores</h2>
          <p>Carteira atual · todos os períodos</p>
        </div>
        <TrendingUp size={22} aria-hidden="true" />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="negotiating-total">
            <div>
              <span>Valor total em negociação</span>
              <p>Oportunidade + Proposta + Negociação</p>
            </div>
            <strong>{money(query.data.negotiating)}</strong>
          </div>
          <dl className="stage-values">
            {query.data.stages.map(({ stage, value, count }) => (
              <div
                key={stage}
                className={
                  NEGOTIATING_STAGES.includes(stage) ? "negotiating-stage" : ""
                }
              >
                <dt>{stage.toLocaleLowerCase("pt-BR")}</dt>
                <dd>{money(value)}</dd>
                <small>
                  {count} {count === 1 ? "negócio" : "negócios"}
                </small>
              </div>
            ))}
          </dl>
          <p className="small muted stage-values-note">
            Valores potenciais por etapa. Fechado e Pós-venda usam o valor de
            fechamento.
          </p>
        </>
      )}
    </section>
  );
}
