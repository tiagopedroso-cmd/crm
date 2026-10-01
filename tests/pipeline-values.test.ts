import { describe, it, expect } from "vitest";
import { summarizePipeline, type ValuedLead } from "../src/lib/pipeline-values";
import { STAGES } from "../src/types/crm";

describe("Valores da carteira atual", () => {
  it("soma somente oportunidade, proposta e negociação no destaque", () => {
    const leads = STAGES.map((stage) => ({
      stage,
      potential_value: 100,
      closed_value: 80,
    }));
    const result = summarizePipeline(leads);
    expect(result.negotiating).toBe(300);
    expect(result.stages).toHaveLength(STAGES.length);
    expect(result.stages.find((s) => s.stage === "FECHADO")?.value).toBe(80);
    expect(result.stages.find((s) => s.stage === "PÓS-VENDA")?.value).toBe(80);
    expect(result.stages.find((s) => s.stage === "PERDIDO")?.value).toBe(100);
  });
  it("inclui etapas vazias e não inventa valor fechado quando ausente", () => {
    expect(summarizePipeline([])).toEqual({
      negotiating: 0,
      stages: STAGES.map((stage) => ({ stage, count: 0, value: 0 })),
    });
    expect(
      summarizePipeline([
        { stage: "FECHADO", potential_value: 500, closed_value: null },
      ]).stages.find((s) => s.stage === "FECHADO")?.value,
    ).toBe(0);
  });
  it("acumula centavos sem erro de ponto flutuante", () => {
    const leads: ValuedLead[] = [0.1, 0.2].map((value) => ({
      stage: "PROPOSTA",
      potential_value: value,
      closed_value: null,
    }));
    expect(summarizePipeline(leads).negotiating).toBe(0.3);
  });
});
