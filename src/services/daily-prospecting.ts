import { browserClient } from "@/lib/supabase/client";
import { businessDaysLate, dateOnly, nextBusinessDays } from "@/lib/business-days";
import type { Lead } from "@/types/crm";

export const DAILY_MESSAGE_CAPACITY = 30;
export const STRUCTURAL_NEW_LEADS = 6;
export const RECOVERY_NEW_LEADS = 5;
export const RECOVERY_FOLLOWUP_REFERENCE = 25;

export interface ProspectingQueueItem {
  kind: "FOLLOWUP" | "NEW";
  lead: Lead;
  dueAt: string | null;
  overdueBusinessDays: number;
  attempt: number;
}

export interface ProspectingDayForecast {
  day: string;
  followups: number;
}

export interface DailyProspectingPlan {
  capacity: number;
  performed: number;
  performedFollowups: number;
  performedNew: number;
  remaining: number;
  eligibleFollowups: number;
  overdueFollowups: number;
  queuedFollowups: number;
  queuedNew: number;
  backlogRemaining: number;
  recoveryMode: boolean;
  referenceNewLeads: number;
  status: "AVAILABLE" | "ATTENTION" | "ALMOST_FULL" | "BACKLOG";
  queue: ProspectingQueueItem[];
  forecast: ProspectingDayForecast[];
}

async function allRows<T>(build: (from: number, to: number) => any) {
  const rows: T[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await build(offset, offset + size - 1);
    if (error) throw error;
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}


export interface DailyProspectingFilters {
  responsibleId?: string;
  campaign?: string;
  niche?: string;
}

export interface DailyProspectingFilterOptions {
  responsibles: { id: string; name: string }[];
  campaigns: string[];
  niches: string[];
}

function applyLeadFilters(
  query: any,
  filters: DailyProspectingFilters,
): any {
  let q = query;

  if (filters.responsibleId) {
    q = q.eq("owner_id", filters.responsibleId);
  }

  if (filters.campaign) {
    q = q.eq("cadence_campaign", filters.campaign);
  }

  if (filters.niche) {
    q = q.eq("niche", filters.niche);
  }

  return q;
}

export async function dailyProspectingFilterOptions(
  defaultOwnerId: string,
): Promise<DailyProspectingFilterOptions> {
  const db = browserClient();

  const [{ data: profiles, error: profilesError }, leads] = await Promise.all([
    db.from("profiles").select("id,display_name").order("display_name"),
    allRows<{
      owner_id: string;
      niche: string | null;
      cadence_campaign: string | null;
    }>((from, to) =>
      db
        .from("lead_listing")
        .select("owner_id,niche,cadence_campaign")
        .range(from, to),
    ),
  ]);

  if (profilesError) throw profilesError;

  const visibleOwnerIds = new Set(leads.map((lead) => lead.owner_id));
  const responsibles = (profiles || [])
    .filter((profile) =>
      visibleOwnerIds.size ? visibleOwnerIds.has(profile.id) : profile.id === defaultOwnerId,
    )
    .map((profile) => ({
      id: profile.id,
      name: profile.display_name || "Sem nome",
    }));

  if (!responsibles.some((item) => item.id === defaultOwnerId)) {
    const ownProfile = (profiles || []).find((profile) => profile.id === defaultOwnerId);
    if (ownProfile) {
      responsibles.unshift({
        id: ownProfile.id,
        name: ownProfile.display_name || "Meu usuário",
      });
    }
  }

  return {
    responsibles,
    campaigns: Array.from(
      new Set(
        leads
          .map((lead) => (lead.cadence_campaign || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    niches: Array.from(
      new Set(
        leads.map((lead) => (lead.niche || "").trim()).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export async function dailyProspectingPlan(
  ownerId: string,
  filters: DailyProspectingFilters = {},
): Promise<DailyProspectingPlan> {

  const db = browserClient();
  const today = dateOnly(new Date());
  const start = `${today}T00:00:00-03:00`;
  const end = `${today}T23:59:59.999-03:00`;

  const [followups, newLeads, approaches] = await Promise.all([
    allRows<Lead>((from, to) => {
      let q = db
        .from("lead_listing")
        .select("*")
        .eq("stage", "CONTATADO")
        .eq("cadence_status", "IN_PROGRESS")
        .not("cadence_next_at", "is", null)
        .lte("cadence_next_at", end);
      q = applyLeadFilters(q, filters);
      if (!filters.responsibleId) q = q.eq("owner_id", ownerId);
      return q.order("cadence_next_at", { ascending: true }).range(from, to);
    }),
    allRows<Lead>((from, to) => {
      let q = db.from("lead_listing").select("*").eq("stage", "NOVO LEAD");
      if (filters.responsibleId) q = q.eq("owner_id", filters.responsibleId);
      else q = q.eq("owner_id", ownerId);
      if (filters.niche) q = q.eq("niche", filters.niche);
      // Lead novo ainda não possui campanha iniciada; ao filtrar campanha,
      // ele não entra na capacidade recomendada.
      if (filters.campaign) q = q.eq("id", "00000000-0000-0000-0000-000000000000");
      return q
        .order("inserted_on", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, to);
    }),
    allRows<{ interaction_id: string; lead_id: string }>((from, to) => {
      let q = db
        .from("lead_approaches")
        .select("interaction_id,lead_id")
        .gte("confirmed_at", start)
        .lte("confirmed_at", end);
      if (filters.responsibleId) q = q.eq("user_id", filters.responsibleId);
      else q = q.eq("user_id", ownerId);
      if (filters.niche) q = q.eq("niche", filters.niche);
      return q.order("confirmed_at").range(from, to);
    }),
  ]);

  let filteredApproaches = approaches;
  if (filters.campaign && approaches.length) {
    const approachLeadIds = Array.from(new Set(approaches.map((a) => a.lead_id).filter(Boolean)));
    const campaignLeadIds = new Set<string>();
    for (let i = 0; i < approachLeadIds.length; i += 100) {
      const { data, error } = await db
        .from("lead_listing")
        .select("id,cadence_campaign")
        .in("id", approachLeadIds.slice(i, i + 100))
        .eq("cadence_campaign", filters.campaign);
      if (error) throw error;
      for (const lead of data || []) campaignLeadIds.add(lead.id);
    }
    filteredApproaches = approaches.filter((a) => campaignLeadIds.has(a.lead_id));
  }

  let performedFollowups = 0;
  let performedNew = 0;
  const interactionIds = filteredApproaches.map((a) => a.interaction_id).filter(Boolean);
  for (let i = 0; i < interactionIds.length; i += 100) {
    const { data, error } = await db.from("lead_interactions").select("id,type").in("id", interactionIds.slice(i, i + 100));
    if (error) throw error;
    for (const item of data || []) {
      if (item.type === "Follow-up") performedFollowups += 1;
      else performedNew += 1;
    }
  }

  const performed = performedFollowups + performedNew;
  const remaining = Math.max(0, DAILY_MESSAGE_CAPACITY - performed);
  const overdueFollowups = followups.filter((l) => (l.cadence_next_at || "").slice(0, 10) < today).length;
  const recoveryMode = overdueFollowups > 0 || followups.length > RECOVERY_FOLLOWUP_REFERENCE;
  const queuedFollowups = Math.min(followups.length, remaining);
  const capacityForNew = Math.max(0, remaining - queuedFollowups);
  const queuedNew = Math.min(newLeads.length, capacityForNew);
  const queue: ProspectingQueueItem[] = [
    ...followups.slice(0, queuedFollowups).map((lead) => ({
      kind: "FOLLOWUP" as const,
      lead,
      dueAt: lead.cadence_next_at || null,
      overdueBusinessDays: lead.cadence_next_at ? businessDaysLate(lead.cadence_next_at, today) : 0,
      attempt: Math.min(5, (lead.cadence_step || 0) + 2),
    })),
    ...newLeads.slice(0, queuedNew).map((lead) => ({ kind: "NEW" as const, lead, dueAt: null, overdueBusinessDays: 0, attempt: 1 })),
  ];

  const programmed = performed + followups.length + Math.min(newLeads.length, recoveryMode ? RECOVERY_NEW_LEADS : STRUCTURAL_NEW_LEADS);
  const status = programmed > 30 ? "BACKLOG" : programmed >= 28 ? "ALMOST_FULL" : programmed >= 21 ? "ATTENTION" : "AVAILABLE";

  const futureDays = nextBusinessDays(today, 4);
  const futureEnd = `${futureDays.at(-1)}T23:59:59.999-03:00`;
  let futureQuery = db
    .from("lead_listing")
    .select("cadence_next_at")
    .eq("stage", "CONTATADO")
    .eq("cadence_status", "IN_PROGRESS")
    .gt("cadence_next_at", end)
    .lte("cadence_next_at", futureEnd);
  futureQuery = applyLeadFilters(futureQuery, filters);
  if (!filters.responsibleId) futureQuery = futureQuery.eq("owner_id", ownerId);
  const { data: future, error: futureError } = await futureQuery;
  if (futureError) throw futureError;
  const forecast = futureDays.map((day) => ({ day, followups: (future || []).filter((x) => String(x.cadence_next_at).slice(0, 10) === day).length }));

  return {
    capacity: DAILY_MESSAGE_CAPACITY,
    performed,
    performedFollowups,
    performedNew,
    remaining,
    eligibleFollowups: followups.length,
    overdueFollowups,
    queuedFollowups,
    queuedNew,
    backlogRemaining: Math.max(0, followups.length - queuedFollowups),
    recoveryMode,
    referenceNewLeads: recoveryMode ? RECOVERY_NEW_LEADS : STRUCTURAL_NEW_LEADS,
    status,
    queue,
    forecast,
  };
}

export type ProspectingEvolutionPreset = "7" | "30" | "90" | "CUSTOM";

export const PIPELINE_EVOLUTION_STAGES = [
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

export type PipelineEvolutionStage =
  (typeof PIPELINE_EVOLUTION_STAGES)[number];

export type PipelineEvolutionFilter = "ALL" | PipelineEvolutionStage;

export interface PipelineEvolutionMetric {
  quantity: number;
  value: number;
}

export interface PipelineEvolutionPoint {
  day: string;
  label: string;
  total: PipelineEvolutionMetric;
  stages: Record<PipelineEvolutionStage, PipelineEvolutionMetric>;
}

export interface PipelineEvolution {
  points: PipelineEvolutionPoint[];
  totals: {
    total: PipelineEvolutionMetric;
    stages: Record<PipelineEvolutionStage, PipelineEvolutionMetric>;
  };
  startDay: string;
  endDay: string;
  methodology: string;
}

function pipelineIsoDay(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function pipelineSubtractCalendarDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00-03:00`);
  date.setDate(date.getDate() - amount);
  return pipelineIsoDay(date);
}

function pipelineEnumerateDays(startDay: string, endDay: string) {
  const days: string[] = [];
  let cursor = new Date(`${startDay}T12:00:00-03:00`);
  const end = new Date(`${endDay}T12:00:00-03:00`);

  while (cursor <= end) {
    days.push(pipelineIsoDay(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return days;
}

function emptyStageMetrics(): Record<
  PipelineEvolutionStage,
  PipelineEvolutionMetric
> {
  return Object.fromEntries(
    PIPELINE_EVOLUTION_STAGES.map((stage) => [
      stage,
      { quantity: 0, value: 0 },
    ]),
  ) as Record<PipelineEvolutionStage, PipelineEvolutionMetric>;
}

function effectiveLeadValue(lead: {
  stage: string;
  potential_value: number | string | null;
  closed_value: number | string | null;
}) {
  if (lead.stage === "FECHADO" || lead.stage === "PÓS-VENDA") {
    return Number(lead.closed_value || 0);
  }
  return Number(lead.potential_value || 0);
}

export async function prospectingEvolution(
  ownerId: string,
  preset: ProspectingEvolutionPreset = "30",
  customStart?: string,
  customEnd?: string,
): Promise<PipelineEvolution> {
  const db = browserClient();
  const today = dateOnly(new Date());

  const requestedEnd =
    preset === "CUSTOM" && customEnd ? customEnd : today;

  const requestedStart =
    preset === "CUSTOM" && customStart
      ? customStart
      : pipelineSubtractCalendarDays(
          requestedEnd,
          Math.max(1, Number(preset)) - 1,
        );

  const startDay =
    requestedStart <= requestedEnd ? requestedStart : requestedEnd;
  const endDay =
    requestedEnd >= requestedStart ? requestedEnd : requestedStart;

  const start = `${startDay}T00:00:00-03:00`;
  const end = `${endDay}T23:59:59.999-03:00`;

  const leads = await allRows<{
    id: string;
    stage: PipelineEvolutionStage;
    inserted_on: string | null;
    created_at: string;
    potential_value: number | string | null;
    closed_value: number | string | null;
  }>((from, to) =>
    db
      .from("leads")
      .select(
        "id,stage,inserted_on,created_at,potential_value,closed_value",
      )
      .eq("owner_id", ownerId)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  const days = pipelineEnumerateDays(startDay, endDay);

  const points = days.map((day) => ({
    day,
    label: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(`${day}T12:00:00-03:00`)),
    total: { quantity: 0, value: 0 },
    stages: emptyStageMetrics(),
  }));

  const pointByDay = new Map(points.map((point) => [point.day, point]));

  for (const lead of leads) {
    const rawDay = lead.inserted_on || lead.created_at;
    const day =
      typeof rawDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDay)
        ? rawDay
        : pipelineIsoDay(rawDay);

    const point = pointByDay.get(day);
    if (!point) continue;
    if (!PIPELINE_EVOLUTION_STAGES.includes(lead.stage)) continue;

    const value = effectiveLeadValue(lead);

    point.total.quantity += 1;
    point.total.value += value;
    point.stages[lead.stage].quantity += 1;
    point.stages[lead.stage].value += value;
  }

  const totals = {
    total: { quantity: 0, value: 0 },
    stages: emptyStageMetrics(),
  };

  for (const point of points) {
    totals.total.quantity += point.total.quantity;
    totals.total.value += point.total.value;

    for (const stage of PIPELINE_EVOLUTION_STAGES) {
      totals.stages[stage].quantity += point.stages[stage].quantity;
      totals.stages[stage].value += point.stages[stage].value;
    }
  }

  return {
    points,
    totals,
    startDay,
    endDay,
    methodology:
      "Distribuição dos leads cadastrados no período pela etapa atual do pipeline. O CRM ainda não reconstrói retroativamente a etapa histórica de cada lead.",
  };
}
