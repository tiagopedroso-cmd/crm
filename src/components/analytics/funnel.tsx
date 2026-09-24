import type { Metrics } from "@/types/crm";
export function Funnel({ metrics }: { metrics: Metrics }) {
  const all = metrics.leads;
  const rows = metrics.funnel;
  return (
    <section className="card panel">
      <div className="section-heading">
        <div>
          <h2>Conversão do funil</h2>
          <p>Etapas efetivamente visitadas pelos leads do período.</p>
        </div>
      </div>
      <div className="funnel">
        {rows.map((row, i) => {
          const count = i === 0 ? all : row.total;
          const previous = i === 1 ? all : rows[i - 1]?.total || 0;
          return (
            <div key={row.stage} className="funnel-row">
              <div>
                <span>{row.stage.toLocaleLowerCase("pt-BR")}</span>
                <small>
                  {i === 0
                    ? "Base do período"
                    : `${previous ? Math.round((count / previous) * 100) : 0}% da etapa anterior`}
                </small>
              </div>
              <div className="funnel-bar">
                <span
                  style={{
                    width: `${all ? Math.min(100, (count / all) * 100) : 0}%`,
                    opacity: 1 - i * 0.07,
                  }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
      <p className="small muted">
        Etapas puladas não são presumidas. Uma conversão entre etapas pode
        superar 100% quando há saltos.
      </p>
    </section>
  );
}
