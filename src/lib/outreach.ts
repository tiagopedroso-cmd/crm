import type { Lead } from "@/types/crm";
import { dayKey } from "@/lib/utils";
import { addBusinessDays } from "@/lib/business-days";
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
export type FollowupApproach = Pick<
  Approach,
  | "id"
  | "lead_id"
  | "message"
  | "template_group"
  | "confirmed_at"
  | "responded_at"
>;
export interface FollowupContext {
  previous: FollowupApproach | null;
  responded: boolean;
}

export function followupContext(
  approaches: FollowupApproach[],
): FollowupContext {
  return {
    previous: approaches.reduce<FollowupApproach | null>(
      (latest, item) =>
        !latest ||
        item.confirmed_at > latest.confirmed_at ||
        (item.confirmed_at === latest.confirmed_at && item.id > latest.id)
          ? item
          : latest,
      null,
    ),
    responded: approaches.some((item) => Boolean(item.responded_at)),
  };
}

export function canFollowup(
  lead: Pick<Lead, "stage">,
  context?: FollowupContext,
) {
  return lead.stage === "CONTATADO" && Boolean(context) && !context!.responded;
}

export function renderFollowup(lead: Lead, previous: FollowupApproach | null) {
  const company = lead.company.trim() || "sua empresa";
  const contact = lead.contact_name.trim();
  const greeting = /^oi\b/i.test(previous?.message.trim() || "") ? "Oi" : "Olá";
  const opening = `${greeting}, ${contact || `equipe da ${company}`}! Tudo bem?`;
  // The sent text takes precedence over the current product or an edited template.
  const sent = normalize(previous?.message || "");
  const group = previous?.template_group || suggestGroup(lead);
  let subject = "as soluções digitais";
  if (/retrabalho|mesma informa/.test(sent))
    subject = "como reduzir o retrabalho na operação";
  else if (/planilh|excel|lancamento manual/.test(sent))
    subject = "a organização dos processos e controles da operação";
  else if (/sistema|automa|processos operacionais/.test(sent))
    subject = "sistemas e automações para os processos internos";
  else if (/agendamento|procedimento/.test(sent))
    subject = "como facilitar o contato e os agendamentos pela internet";
  else if (/orcamento/.test(sent))
    subject = "a apresentação dos serviços e os pedidos de orçamento pelo site";
  else if (/site|pagina|presenca digital/.test(sent))
    subject = "a apresentação dos serviços na internet";
  else if (!previous) {
    if (group === "Saúde / Estética")
      subject = "a apresentação dos serviços e os agendamentos pela internet";
    if (group === "Serviços Técnicos")
      subject = "a apresentação dos serviços e os pedidos de orçamento";
    if (group === "Transporte / Logística")
      subject = "a organização dos processos operacionais";
  }
  const questions: Record<string, string> = {
    "Saúde / Estética":
      "Hoje, como as pessoas conhecem os serviços de vocês e entram em contato para agendar?",
    "Serviços Técnicos": `Como vocês costumam apresentar os serviços${lead.niche.trim() ? ` de ${lead.niche.trim()}` : ""} para quem pede um orçamento?`,
    "Transporte / Logística":
      "Existe algum processo da operação que vocês gostariam de simplificar hoje?",
    Indicação:
      "Faz sentido conversarmos sobre alguma melhoria no site, no atendimento ou nos processos internos?",
    Geral:
      "Faz sentido conversarmos sobre o que vocês gostariam de melhorar no negócio hoje?",
  };
  // Reuse the actual last question, including manually personalized approaches.
  const priorQuestion = previous?.message
    .match(/[^.!?\n]+\?/g)
    ?.at(-1)
    ?.trim();
  const question =
    priorQuestion &&
    priorQuestion.length <= 350 &&
    !/^(tudo bem|como vai)\?$/i.test(priorQuestion)
      ? priorQuestion
      : previous
        ? "Faz sentido retomarmos esse assunto por aqui?"
        : questions[group] || questions.Geral;
  return `${opening}\n\nPassando para retomar minha mensagem sobre ${subject} para a ${company}.\n\n${question}\n\nQuando puder, me conta por aqui.`;
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
  const normalizedProduct = normalize(product);
  if (!lead.contact_name.trim() && /\bsistema(s)?\b/.test(normalizedProduct)) {
    const decisionMaker = active.find((t) =>
      /sistemas.*identificar decisor/.test(normalize(t.name)),
    );
    if (decisionMaker) return decisionMaker;
  }
  const group = active.filter((t) => t.niche_group === suggestGroup(lead));
  const context = normalize([product, lead.pain, lead.objective, lead.discovery_notes].filter(Boolean).join(" "));
  if (suggestGroup(lead) === "Transporte / Logística") {
    if (/planilh|excel/.test(context)) { const t=group.find(x=>/planilh/.test(normalize(x.name))); if(t) return t; }
    if (/retrabalho|duplic|repet|mesma informa/.test(context)) { const t=group.find(x=>/retrabalho/.test(normalize(x.name))); if(t) return t; }
    if (/sistema|automa|process/.test(context)) { const t=group.find(x=>/process/.test(normalize(x.name))); if(t) return t; }
  }
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
      "Oi! Tudo bem?",
    );
    text = text.replace(/^\s*\{\{\s*responsavel\s*\}\}\s*[,!:.—-]*\s*/gim, "");
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
  return `${addBusinessDays(dayKey(now), 3)}T09:00`;
}
