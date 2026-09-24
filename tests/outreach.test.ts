import { describe, it, expect } from "vitest";
import {
  followupDate,
  renderTemplate,
  suggestGroup,
  suggestTemplate,
  type MessageTemplate,
} from "../src/lib/outreach";
import { whatsappUrl } from "../src/lib/utils";
import type { Lead } from "../src/types/crm";
describe("Abordagem individual", () => {
  const lead = {
    company: "Topografia Horizonte",
    contact_name: "Carlos",
    niche: "Topografia",
    source: "Google Maps",
    website: "",
    referred_by: "Ana",
  } as Lead;
  it("renderiza responsável, empresa e indicação; usa fallback natural", () => {
    expect(
      renderTemplate(
        "Oi, {{responsavel}}. Tudo bem?\n{{empresa}} / {{nicho}} / {{produto}} / {{cidade}} / {{indicado_por}}",
        lead,
        "Site",
      ).text,
    ).toBe(
      "Oi, Carlos. Tudo bem?\nTopografia Horizonte / Topografia / Site / sua região / Ana",
    );
    expect(
      renderTemplate("Oi, {{responsavel}}. Tudo bem?", {
        ...lead,
        contact_name: "",
      }).text,
    ).toBe("Olá! Tudo bem?");
    const fallback = renderTemplate(
      "O {{indicado_por}} comentou comigo sobre a {{empresa}} e me passou seu contato.",
      { ...lead, referred_by: "" },
    );
    expect(fallback.text).toBe(
      "Recebi uma indicação da Topografia Horizonte e estou entrando em contato.",
    );
    expect(renderTemplate("{{empresa}} {{nicho}} {{cidade}}", {}).text).toBe(
      "sua empresa serviços especializados sua região",
    );
  });
  it("sinaliza variável desconhecida sem deixar chaves na mensagem", () => {
    expect(renderTemplate("Olá {{inexistente}}", lead)).toEqual({
      text: "Olá [informação a revisar]",
      unknown: ["inexistente"],
    });
  });
  it.each([
    ["Clínica odontológica", "Saúde / Estética"],
    ["Psicologia", "Saúde / Estética"],
    ["Topografia", "Serviços Técnicos"],
    ["Seg. Trabalho", "Serviços Técnicos"],
    ["Transportadora", "Transporte / Logística"],
    ["Logística", "Transporte / Logística"],
    ["Outro", "Geral"],
  ])("sugere grupo para %s", (niche, expected) =>
    expect(suggestGroup({ ...lead, niche })).toBe(expected),
  );
  it("prioriza indicação, site e padrão pessoal, exclui modelos inativos", () => {
    expect(suggestGroup({ ...lead, source: "Indicação" })).toBe("Indicação");
    const templates = [
      {
        id: "1",
        name: "TÉCNICO — SEM SITE",
        niche_group: "Serviços Técnicos",
        is_active: true,
      },
      {
        id: "2",
        name: "TÉCNICO — SITE EXISTENTE",
        niche_group: "Serviços Técnicos",
        is_active: true,
      },
    ] as MessageTemplate[];
    expect(suggestTemplate(templates, lead)?.id).toBe("1");
    expect(
      suggestTemplate(templates, { ...lead, website: "https://empresa.test" })
        ?.id,
    ).toBe("2");
    expect(
      suggestTemplate([{ ...templates[0], is_default: true }, templates[1]], {
        ...lead,
        website: "https://empresa.test",
      })?.id,
    ).toBe("1");
    expect(
      suggestTemplate(
        templates.map((t) => ({ ...t, is_active: false })),
        lead,
      ),
    ).toBeUndefined();
  });
  it.each([
    "(11) 99999-9999",
    "11999999999",
    "+55 (11) 99999-9999",
    "011999999999",
  ])("normaliza %s e codifica texto", (phone) => {
    const url = new URL(whatsappUrl(phone, "Olá Carlos & equipe?")!);
    expect(url.pathname).toBe("/5511999999999");
    expect(url.searchParams.get("text")).toBe("Olá Carlos & equipe?");
  });
  it("calcula D+2 em Brasília na virada do mês", () => {
    expect(followupDate(new Date("2026-10-01T01:00:00Z"))).toBe(
      "2026-10-02T09:00",
    );
  });
});
