import type { Approach } from "@/lib/outreach";
import { browserClient } from "@/lib/supabase/client";
import { dayKey } from "@/lib/utils";
import { leadSchema } from "@/schemas/lead";
import type {
  Filters,
  Goals,
  Lead,
  Metrics,
  Product,
  Objection,
  Profile,
  Stage,
  Interaction,
  History,
  Proposal,
} from "@/types/crm";
export const PAGE_SIZE = 25;
export async function referenceData(userId: string) {
  const db = browserClient();
  const results = await Promise.all([
    db.from("products").select("*").order("name"),
    db.from("objections").select("*").order("name"),
    db.from("sales_goals").select("*").eq("owner_id", userId).single(),
    db.from("profiles").select("id,display_name,role"),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return {
    products: results[0].data as Product[],
    objections: results[1].data as Objection[],
    goals: Object.fromEntries(
      Object.entries(results[2].data as unknown as Goals).map(
        ([key, value]) => [key, key === "owner_id" ? value : Number(value)],
      ),
    ) as unknown as Goals,
    profiles: results[3].data as Profile[],
  };
}
export async function listLeads(
  filters: Partial<Filters> = {},
  page = 0,
  limit = PAGE_SIZE,
) {
  let q = browserClient().from("leads").select("*", { count: "exact" });
  if (filters.search) {
    const safe = filters.search.replace(/[,().%_\\"]/g, " ").trim();
    if (safe)
      q = q.or(
        ["company", "contact_name", "whatsapp", "niche"]
          .map((k) => `${k}.ilike.%${safe}%`)
          .join(","),
      );
  }
  for (const field of [
    "stage",
    "product_id",
    "source",
    "channel",
    "owner_id",
    "state",
  ] as const)
    if (filters[field]) q = q.eq(field, filters[field]);
  for (const field of ["niche", "city"] as const)
    if (filters[field])
      q = q.ilike(field, `%${filters[field]!.replace(/[%_]/g, "")}%`);
  if (filters.from) q = q.gte("inserted_on", filters.from);
  if (filters.to) q = q.lte("inserted_on", filters.to);
  if (filters.action === "missing")
    q = q
      .is("next_action_at", null)
      .not("stage", "in", '("FECHADO","PÓS-VENDA","PERDIDO")');
  if (filters.action === "scheduled") q = q.not("next_action_at", "is", null);
  if (["overdue", "today", "agenda"].includes(filters.action || "")) {
    q = q.not("stage", "in", '("FECHADO","PÓS-VENDA","PERDIDO")');
    if (filters.action === "overdue")
      q = q.lt("next_action_at", new Date().toISOString());
    if (filters.action === "today")
      q = q
        .gte("next_action_at", `${dayKey()}T00:00:00-03:00`)
        .lte("next_action_at", `${dayKey()}T23:59:59.999-03:00`);
    if (filters.action === "agenda") q = q.not("next_action_at", "is", null);
  }
  const { data, error, count } = await q
    .order(filters.action ? "next_action_at" : "inserted_on", {
      ascending: Boolean(filters.action),
      nullsFirst: false,
    })
    .order("id")
    .range(page * limit, (page + 1) * limit - 1);
  if (error) throw error;
  return { rows: data as Lead[], count: count || 0 };
}
export async function getLead(id: string) {
  const { data, error } = await browserClient()
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Lead;
}
export async function saveLead(input: unknown, id?: string) {
  const payload = leadSchema.parse(input);
  const db = browserClient();
  const q = id
    ? db.from("leads").update(payload).eq("id", id)
    : db.from("leads").insert(payload);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data as Lead;
}
export async function changeStage(
  id: string,
  stage: Stage,
  extra: Partial<Lead> = {},
) {
  const allowed = {
    closed_value: extra.closed_value,
    closed_on: extra.closed_on,
    payment_method: extra.payment_method,
    closing_notes: extra.closing_notes,
    loss_reason: extra.loss_reason,
  };
  const { data, error } = await browserClient()
    .from("leads")
    .update({ stage, ...allowed })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}
export async function deleteLead(id: string) {
  const { error } = await browserClient().from("leads").delete().eq("id", id);
  if (error) throw error;
}
export async function metrics(start: string, end: string, owner?: string) {
  const { data, error } = await browserClient().rpc("crm_metrics", {
    p_start: start,
    p_end: end,
    p_owner: owner || null,
  });
  if (error) throw error;
  return data as Metrics;
}
export async function leadDetails(id: string, page = 0) {
  const db = browserClient();
  const results = await Promise.all([
    db
      .from("lead_interactions")
      .select("*", { count: "exact" })
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .range(page * 25, page * 25 + 24),
    db
      .from("pipeline_history")
      .select("*", { count: "exact" })
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .range(page * 25, page * 25 + 24),
    db
      .from("proposals")
      .select("*")
      .eq("lead_id", id)
      .order("sent_on", { ascending: false })
      .range(page * 25, page * 25 + 24),
    db.from("after_sales").select("*").eq("lead_id", id).maybeSingle(),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const ids = (results[0].data as Interaction[]).map((i) => i.id);
  const approaches = ids.length
    ? await db.from("lead_approaches").select("*").in("interaction_id", ids)
    : { data: [], error: null };
  if (approaches.error) throw approaches.error;
  return {
    interactions: results[0].data as Interaction[],
    approaches: approaches.data as Approach[],
    history: results[1].data as History[],
    proposals: results[2].data as Proposal[],
    afterSales: results[3].data as Record<string, boolean> | null,
    hasMore:
      (results[0].count || 0) > (page + 1) * 25 ||
      (results[1].count || 0) > (page + 1) * 25 ||
      (results[2].data?.length || 0) === 25,
  };
}
export async function addInteraction(
  lead_id: string,
  type: string,
  description: string,
  occurred_at: string,
) {
  if (!description.trim()) throw new Error("Descreva a interação.");
  const { error } = await browserClient()
    .from("lead_interactions")
    .insert({ lead_id, type, description, occurred_at });
  if (error) throw error;
}
export async function scheduleAction(
  id: string,
  next_action: string,
  next_action_at: string,
) {
  const { error } = await browserClient()
    .from("leads")
    .update({ next_action, next_action_at })
    .eq("id", id);
  if (error) throw error;
}
export async function saveGoals(goals: Goals) {
  const { error } = await browserClient()
    .from("sales_goals")
    .update(goals)
    .eq("owner_id", goals.owner_id);
  if (error) throw error;
}
export async function saveProduct(product: Partial<Product>) {
  const db = browserClient();
  const q = product.id
    ? db.from("products").update(product).eq("id", product.id)
    : db.from("products").insert(product);
  const { error } = await q;
  if (error) throw error;
}
export async function addObjection(name: string) {
  const { error } = await browserClient().from("objections").insert({ name });
  if (error) throw error;
}
export async function saveProposal(proposal: Partial<Proposal>) {
  const db = browserClient();
  const q = proposal.id
    ? db.from("proposals").update(proposal).eq("id", proposal.id)
    : db.from("proposals").insert(proposal);
  const { error } = await q;
  if (error) throw error;
}
export async function afterSale(
  lead_id: string,
  field: string,
  value: boolean,
) {
  const { error } = await browserClient()
    .from("after_sales")
    .upsert({ lead_id, [field]: value });
  if (error) throw error;
}
export async function exportLeads(filters: Partial<Filters>) {
  const rows: Lead[] = [];
  for (let page = 0; ; page++) {
    const result = await listLeads(filters, page, 500);
    rows.push(...result.rows);
    if (result.rows.length < 500) break;
  }
  return rows;
}
export async function backup() {
  const db = browserClient();
  const output: Record<string, unknown> = {
    version: 1,
    exported_at: new Date().toISOString(),
  };
  for (const table of [
    "profiles",
    "products",
    "objections",
    "sales_goals",
    "leads",
    "lead_interactions",
    "pipeline_history",
    "proposals",
    "after_sales",
    "message_templates",
    "lead_approaches",
  ]) {
    const rows: unknown[] = [];
    for (let page = 0; ; page++) {
      const key =
        table === "sales_goals"
          ? "owner_id"
          : table === "after_sales"
            ? "lead_id"
            : "id";
      const { data, error } = await db
        .from(table)
        .select("*")
        .order(key)
        .range(page * 500, page * 500 + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    output[table] = rows;
  }
  return output;
}
export async function seedDemo() {
  const { data: products, error: readError } = await browserClient()
    .from("products")
    .select("id,name,suggested_value");
  if (readError) throw readError;
  const names = [
    "Clínica Sorriso",
    "Topografia Horizonte",
    "Transportadora Atlas",
    "Espaço Bella",
    "Engenharia Norte",
  ];
  const { error } = await browserClient()
    .from("leads")
    .insert(
      names.map((company, i) => ({
        company,
        contact_name: [
          "Ana Oliveira",
          "Pedro Lima",
          "Carlos Santos",
          "Beatriz Costa",
          "Marcos Souza",
        ][i],
        niche: ["Saúde", "Topografia", "Logística", "Beleza", "Engenharia"][i],
        product_id: products?.[i % products.length]?.id,
        potential_value:
          products?.[i % products.length]?.suggested_value || 540,
        next_action: [
          "Fazer abordagem",
          "Primeiro follow-up",
          "Reunião de diagnóstico",
          "Retornar proposta",
          "Fazer sondagem",
        ][i],
        next_action_at: `${dayKey()}T${String([9, 10, 14, 15, 16][i]).padStart(2, "0")}:30:00-03:00`,
        is_demo: true,
      })),
    );
  if (error) throw error;
}
export async function clearDemo() {
  const { error } = await browserClient()
    .from("leads")
    .delete()
    .eq("is_demo", true);
  if (error) throw error;
}
