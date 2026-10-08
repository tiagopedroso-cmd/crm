import { browserClient } from "@/lib/supabase/client";
import type { MarketingCampaign, MarketingContent, MarketingCreative, MarketingMetric } from "@/types/crm";

const db = () => browserClient();
export async function listMarketingCampaigns() {
  const { data, error } = await db().from("marketing_campaigns").select("*").order("start_date", { ascending: false });
  if (error) throw error; return data as MarketingCampaign[];
}
export async function saveMarketingCampaign(payload: Partial<MarketingCampaign>, id?: string) {
  const q = id ? db().from("marketing_campaigns").update(payload).eq("id", id) : db().from("marketing_campaigns").insert(payload);
  const { data, error } = await q.select().single(); if (error) throw error; return data as MarketingCampaign;
}
export async function deleteMarketingCampaign(id: string) { const { error } = await db().from("marketing_campaigns").delete().eq("id", id); if (error) throw error; }
export async function listMarketingContents() {
  const { data, error } = await db().from("marketing_contents").select("*").order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error; return data as MarketingContent[];
}
export async function saveMarketingContent(payload: Partial<MarketingContent>, id?: string) {
  const q = id ? db().from("marketing_contents").update(payload).eq("id", id) : db().from("marketing_contents").insert(payload);
  const { data, error } = await q.select().single(); if (error) throw error; return data as MarketingContent;
}
export async function deleteMarketingContent(id: string) { const { error } = await db().from("marketing_contents").delete().eq("id", id); if (error) throw error; }
export async function listMarketingCreatives() {
  const { data, error } = await db().from("marketing_creatives").select("*").order("created_at", { ascending: false });
  if (error) throw error; return data as MarketingCreative[];
}
export async function saveMarketingCreative(payload: Partial<MarketingCreative>) {
  const { data, error } = await db().from("marketing_creatives").insert(payload).select().single(); if (error) throw error; return data as MarketingCreative;
}
export async function deleteMarketingCreative(id: string) { const { error } = await db().from("marketing_creatives").delete().eq("id", id); if (error) throw error; }
export async function listMarketingMetrics() {
  const { data, error } = await db().from("marketing_metrics").select("*").order("measured_on", { ascending: false });
  if (error) throw error; return data as MarketingMetric[];
}
export async function saveMarketingMetric(payload: Partial<MarketingMetric>, id?: string) {
  const q = id ? db().from("marketing_metrics").update(payload).eq("id", id) : db().from("marketing_metrics").insert(payload);
  const { data, error } = await q.select().single(); if (error) throw error; return data as MarketingMetric;
}
