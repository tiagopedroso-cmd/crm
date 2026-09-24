import type { Lead } from "@/types/crm";
import { dayKey } from "@/lib/utils";
export const TEMPLATE_GROUPS = [
  "Saúde / Estética",
  "Serviços Técnicos",
  "Transporte / Logística",
  "Indicação",
  "Geral",
] as const;
export const TEMPLATE_VARIABLES = [
  "usuario",
  "responsavel",
  "empresa",
  "nicho",
  "produto",
  "cidade",
  "indicado_por",
  "site",
  "origem",
] as const;
export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  category: string;
  niche_group: string;
  channel: "WhatsApp";
  message: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
export interface Approach {
  id: string;
  lead_id: string;
  template_id: string | null;
  template_name: string;
  template_group: string;
  message: string;
  phone: string;
  confirmed_at: string;
  interaction_id: string;
  responded_at: string | null;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function suggestGroup(lead: Pick<Lead, "niche" | "source">) {
  if (normalize(lead.source).includes("indicacao")) return "Indicação";
  const niche = normalize(lead.niche);
  if (
    /saude|estet|clinic|odonto|nutri|fisio|psico|fono|quiro|beleza|medic/.test(
      niche,
    )
  )
    return "Saúde / Estética";
  if (
    /topograf|engenhar|ambiental|seguran|seg\.? trabalho|consult|tecnic/.test(
      niche,
    )
  )
    return "Serviços Técnicos";
  if (/transport|logistic|distribui|operador/.test(niche))
    return "Transporte / Logística";
  return "Geral";
}
export function suggestTemplate(
  templates: MessageTemplate[],
  lead: Lead,
  product = "",
) {
  const active = templates.filter((t) => t.is_active);
  const group = active.filter((t) => t.niche_group === suggestGroup(lead));
  const preferred = group.find((t) => t.is_default);
  if (preferred) return preferred;
  if (["Saúde / Estética", "Serviços Técnicos"].includes(suggestGroup(lead))) {
    const wanted = lead.website.trim() ? /tem site|site existente/ : /sem site/;
    const match = group.find((t) => wanted.test(normalize(t.name)));
    if (match) return match;
    if (/landing/i.test(product)) {
      const landing = group.find((t) => /landing/i.test(t.name));
      if (landing) return landing;
    }
  }
  return group[0] || active.find((t) => t.niche_group === "Geral") || active[0];
}
export function renderTemplate(
  template: string,
  lead: Partial<Lead>,
  product = "",
  sender = "",
) {
  let text = template;
  if (!sender.trim())
    text = text.replace(
      /Me chamo\s*\{\{\s*usuario\s*\}\}, da InovaLogix\./gi,
      "Sou da InovaLogix.",
    );
  if (!lead.contact_name?.trim()) {
    text = text.replace(
      /(?:Oi|Olá|Ola)[,!]?\s*\{\{\s*responsavel\s*\}\}[.!?,]?\s*(?:Tudo bem\?)?/gi,
      "Olá! Tudo bem?",
    );
  }
  if (!lead.referred_by?.trim()) {
    text = text.replace(
      /O\s*\{\{\s*indicado_por\s*\}\}\s*comentou comigo sobre a\s*\{\{\s*empresa\s*\}\}\s*e me passou seu contato\./gi,
      "Recebi uma indicação da {{empresa}} e estou entrando em contato.",
    );
  }
  const values: Record<string, string> = {
    usuario: sender.trim() || "equipe InovaLogix",
    responsavel: lead.contact_name?.trim() || "equipe",
    empresa: lead.company?.trim() || "sua empresa",
    nicho: lead.niche?.trim() || "serviços especializados",
    produto: product.trim() || "soluções digitais",
    cidade: lead.city?.trim() || "sua região",
    indicado_por:
      lead.referred_by?.trim() || "uma pessoa que conhece seu trabalho",
    site: lead.website?.trim() || "a presença digital da empresa",
    origem: lead.source?.trim() || "uma pesquisa de empresas",
  };
  const unknown: string[] = [];
  text = text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, variable: string) => {
    if (!Object.hasOwn(values, variable)) {
      unknown.push(variable);
      return "[informação a revisar]";
    }
    return values[variable];
  });
  return { text, unknown };
}
export function followupDate(now = new Date()) {
  const date = new Date(`${dayKey(now)}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + 2);
  return `${dayKey(date)}T09:00`;
}
