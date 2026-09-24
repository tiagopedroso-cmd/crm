export const STAGES = [
  "NOVO LEAD",
  "CONTATADO",
  "RESPONDEU",
  "SONDAGEM",
  "OPORTUNIDADE",
  "PROPOSTA",
  "NEGOCIAÇÃO",
  "FECHADO",
  "PÓS-VENDA",
  "PERDIDO",
  "RETOMAR FUTURAMENTE",
] as const;
export type Stage = (typeof STAGES)[number];
export const SOURCES = [
  "Google Maps",
  "Instagram",
  "Indicação",
  "WhatsApp",
  "LinkedIn",
  "Prospecção manual",
  "Outro",
];
export const CHANNELS = [
  "WhatsApp",
  "Instagram",
  "Ligação",
  "E-mail",
  "Presencial",
  "Indicação",
  "Outro",
];
export const INTERACTIONS = [
  "WhatsApp",
  "Ligação",
  "Instagram",
  "E-mail",
  "Reunião",
  "Proposta",
  "Follow-up",
  "Observação",
  "Outro",
];
export const LOSSES = [
  "Preço",
  "Sem orçamento",
  "Sem prioridade",
  "Já possui fornecedor",
  "Não respondeu",
  "Sócio não aprovou",
  "Desistiu",
  "Outro",
];
export const AFTER_SALES = {
  project_started: "Projeto iniciado",
  project_delivered: "Projeto entregue",
  satisfied: "Cliente satisfeito",
  testimonial_requested: "Depoimento solicitado",
  testimonial_received: "Depoimento recebido",
  portfolio_authorized: "Autorização para portfólio",
  referral_requested: "Indicação solicitada",
  referral_received: "Indicação recebida",
  maintenance_offered: "Manutenção oferecida",
  upsell_identified: "Upsell identificado",
};
export interface Profile {
  id: string;
  display_name: string;
  role: "ADMIN" | "VENDEDOR";
}
export interface Product {
  id: string;
  name: string;
  suggested_value: number;
  pricing: "fixed" | "from" | "variable";
  active: boolean;
}
export interface Objection {
  id: string;
  name: string;
}
export interface Lead {
  id: string;
  owner_id: string;
  company: string;
  contact_name: string;
  whatsapp: string;
  email: string;
  instagram: string;
  website: string;
  niche: string;
  city: string;
  state: string;
  source: string;
  channel: string;
  product_id: string | null;
  potential_value: number;
  stage: Stage;
  inserted_on: string;
  first_contact_at: string | null;
  last_interaction_at: string | null;
  next_action: string;
  next_action_at: string | null;
  pain: string;
  objective: string;
  discovery_notes: string;
  urgency: string;
  decision_maker: string;
  budget: number | null;
  objection_id: string | null;
  loss_reason: string;
  closed_on: string | null;
  closed_value: number | null;
  payment_method: string;
  closing_notes: string;
  notes: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}
export interface Interaction {
  id: string;
  lead_id: string;
  actor_id: string;
  occurred_at: string;
  type: string;
  description: string;
}
export interface History {
  id: string;
  lead_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  actor_id: string | null;
  created_at: string;
}
export interface Proposal {
  id: string;
  lead_id: string;
  title: string;
  amount: number;
  sent_on: string;
  status: "Aguardando" | "Aceita" | "Recusada";
  url: string;
  notes: string;
}
export interface Goals {
  owner_id: string;
  daily_leads: number;
  weekly_leads: number;
  weekly_revenue: number;
  monthly_revenue: number;
  monthly_system_revenue: number;
  weekly_contacts: number;
  weekly_responses: number;
  weekly_discoveries: number;
  weekly_opportunities: number;
  weekly_proposals: number;
  weekly_negotiations: number;
  weekly_closings: number;
}
export interface MetricGroup {
  label: string;
  total: number;
}
export interface Metrics {
  leads: number;
  new_today: number;
  new_week: number;
  new_month: number;
  opportunities: number;
  negotiations: number;
  proposals: number;
  closings: number;
  revenue: number;
  pipeline: number;
  ticket: number;
  conversion: number;
  weekly_revenue: number;
  monthly_revenue: number;
  due_today: number;
  overdue: number;
  followups_today: number;
  followups_overdue: number;
  missing_action: number;
  meetings: number;
  awaiting_proposals: number;
  funnel: { stage: Stage; total: number }[];
  events: { stage: Stage; total: number }[];
  sources: MetricGroup[];
  products: MetricGroup[];
  niches: MetricGroup[];
  objections: MetricGroup[];
  losses: number;
  loss_reasons: MetricGroup[];
  loss_products: MetricGroup[];
  loss_niches: MetricGroup[];
}
export interface Filters {
  search: string;
  stage: string;
  product_id: string;
  niche: string;
  source: string;
  channel: string;
  owner_id: string;
  city: string;
  state: string;
  from: string;
  to: string;
  action: string;
}
export const EMPTY_FILTERS: Filters = {
  search: "",
  stage: "",
  product_id: "",
  niche: "",
  source: "",
  channel: "",
  owner_id: "",
  city: "",
  state: "",
  from: "",
  to: "",
  action: "",
};
