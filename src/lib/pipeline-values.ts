import { STAGES, type Lead, type Stage } from "@/types/crm";

export const NEGOTIATING_STAGES: readonly Stage[] = [
  "OPORTUNIDADE",
  "PROPOSTA",
  "NEGOCIAÇÃO",
];
export type ValuedLead = Pick<
  Lead,
  "stage" | "potential_value" | "closed_value"
>;

export function summarizePipeline(leads: ValuedLead[]) {
  const stages = STAGES.map((stage) => ({ stage, count: 0, value: 0 }));
  const byStage = new Map(stages.map((row) => [row.stage, row]));
  for (const lead of leads) {
    const row = byStage.get(lead.stage);
    if (!row) continue;
    row.count++;
    const value = ["FECHADO", "PÓS-VENDA"].includes(lead.stage)
      ? (lead.closed_value ?? 0)
      : lead.potential_value;
    row.value += Math.round(Number(value) * 100);
  }
  // Sum in cents to avoid floating-point accumulation in monetary totals.
  const negotiating =
    stages
      .filter((row) => NEGOTIATING_STAGES.includes(row.stage))
      .reduce((sum, row) => sum + row.value, 0) / 100;
  return {
    negotiating,
    stages: stages.map((row) => ({ ...row, value: row.value / 100 })),
  };
}
