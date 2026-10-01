import { describe, it, expect } from "vitest";
import {
  canFollowup,
  followupContext,
  renderFollowup,
  type FollowupApproach,
} from "../src/lib/outreach";
import type { Lead } from "../src/types/crm";
const lead = {
  stage: "CONTATADO",
  company: "Atlas",
  contact_name: "Carlos",
  niche: "Logística",
  source: "Google Maps",
} as Lead;
const previous: FollowupApproach = {
  id: "a",
  lead_id: "lead",
  message:
    "Oi, Carlos. Tudo bem?\nVocês ainda usam planilhas para controlar as entregas?",
  template_group: "Transporte / Logística",
  confirmed_at: "2026-09-25T10:00:00Z",
  responded_at: null,
};

describe("Follow-up sem resposta", () => {
  it("escolhe a mensagem mais recente e bloqueia se houver resposta registrada", () => {
    const latest = {
      ...previous,
      id: "b",
      confirmed_at: "2026-09-26T10:00:00Z",
    };
    expect(followupContext([latest, previous]).previous).toEqual(latest);
    expect(canFollowup(lead, followupContext([previous]))).toBe(true);
    expect(
      canFollowup(
        lead,
        followupContext([
          { ...previous, responded_at: "2026-09-25T11:00:00Z" },
          latest,
        ]),
      ),
    ).toBe(false);
    expect(
      canFollowup({ stage: "RESPONDEU" }, followupContext([previous])),
    ).toBe(false);
    expect(canFollowup(lead)).toBe(false);
  });
  it("retoma a pergunta real e o assunto enviado, mesmo com segmento atual diferente", () => {
    const text = renderFollowup({ ...lead, niche: "Saúde" }, previous);
    expect(text).toContain("Oi, Carlos!");
    expect(text).toContain("para a Atlas");
    expect(text).toContain("organização dos processos");
    expect(text).toContain(
      "Vocês ainda usam planilhas para controlar as entregas?",
    );
    expect(text).not.toContain("agendamentos");
  });
  it.each([
    ["Clínica", "agendar"],
    ["Topografia", "orçamento"],
    ["Transporte", "operação"],
    ["Comércio", "negócio"],
  ])("personaliza %s mesmo sem abordagem registrada", (niche, expected) => {
    const text = renderFollowup({ ...lead, niche, contact_name: "" }, null);
    expect(text).toContain("equipe da Atlas");
    expect(text).toContain(expected);
    expect(text).not.toMatch(/undefined|null|\{\{/);
  });
  it("não trata uma saudação como a pergunta comercial anterior", () => {
    const text = renderFollowup(lead, {
      ...previous,
      message: "Olá! Tudo bem?",
    });
    expect(text).toContain("Faz sentido retomarmos esse assunto");
  });
});
