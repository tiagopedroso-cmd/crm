import { describe, it, expect } from "vitest";
import {
  dayKey,
  periodRange,
  inputToInstant,
  localInput,
  csvCell,
  whatsappUrl,
  leadMessage,
} from "../src/lib/utils";
describe("Regras de datas e exportação", () => {
  it("personaliza e codifica a mensagem sem perder acentos ou símbolos", () => {
    const message = leadMessage("Clínica A & B", "Ana", "Tiago");
    const url = new URL(whatsappUrl("011999998888", message)!);
    expect(url.pathname).toBe("/5511999998888");
    expect(url.searchParams.get("text")).toBe(message);
    expect(message).toContain("Olá, Ana!");
    expect(message).toContain("Sou Tiago, da InovaLogix");
    expect(message).toContain("Clínica A & B");
    expect(leadMessage("Empresa", "", "")).toContain("Olá, equipe da Empresa!");
  });
  it("mantém datas comerciais no fuso de São Paulo", () => {
    expect(dayKey(new Date("2026-09-24T01:00:00Z"))).toBe("2026-09-23");
    expect(inputToInstant("2026-09-23T09:30")).toBe("2026-09-23T12:30:00.000Z");
    expect(localInput("2026-09-23T12:30:00Z")).toBe("2026-09-23T09:30");
  });
  it("preserva períodos personalizados", () =>
    expect(periodRange("custom", "2026-09-01", "2026-09-30")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    }));
  it("neutraliza fórmulas em CSV e escapa aspas", () => {
    expect(csvCell('=HYPERLINK("url")')).toBe('"\'=HYPERLINK(""url"")"');
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("  +1")).toBe('"\'  +1"');
  });
  it("abre WhatsApp sem mensagem e valida telefone", () => {
    expect(whatsappUrl("(11) 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(whatsappUrl("123")).toBeNull();
  });
});
