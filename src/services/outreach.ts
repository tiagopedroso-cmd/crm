import { browserClient } from "@/lib/supabase/client";
import type { MessageTemplate } from "@/lib/outreach";
import {
  followupContext,
  type FollowupApproach,
  type FollowupContext,
} from "@/lib/outreach";

export async function listFollowupContexts(): Promise<
  Record<string, FollowupContext>
> {
  const db = browserClient();
  const ids: string[] = [];
  const size = 200;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await db
      .from("leads")
      .select("id")
      .eq("stage", "CONTATADO")
      .order("id")
      .range(offset, offset + size - 1);
    if (error) throw error;
    ids.push(...data.map((lead) => lead.id as string));
    if (data.length < size) break;
  }
  const result: Record<string, FollowupContext> = {};
  // Batch by lead to avoid one history request per card; paginate every batch.
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const histories = new Map(
      batch.map((id) => [id, [] as FollowupApproach[]]),
    );
    for (let offset = 0; ; offset += size) {
      const { data, error } = await db
        .from("lead_approaches")
        .select("id,lead_id,message,template_group,confirmed_at,responded_at")
        .in("lead_id", batch)
        .order("id")
        .range(offset, offset + size - 1);
      if (error) throw error;
      for (const item of data as FollowupApproach[])
        histories.get(item.lead_id)?.push(item);
      if (data.length < size) break;
    }
    for (const [id, history] of histories)
      result[id] = followupContext(history);
  }
  return result;
}
export async function listTemplates() {
  const { data, error } = await browserClient()
    .from("message_templates")
    .select("*")
    .order("name");
  if (error) throw error;
  return data as MessageTemplate[];
}
export async function saveTemplate(
  input: Pick<
    MessageTemplate,
    "name" | "niche_group" | "message" | "is_active"
  >,
  id?: string,
) {
  const payload = {
    ...input,
    ...(!input.is_active ? { is_default: false } : {}),
  };
  const db = browserClient();
  const { error } = id
    ? await db.from("message_templates").update(payload).eq("id", id)
    : await db.from("message_templates").insert(payload);
  if (error) throw error;
}
export async function deleteTemplate(id: string) {
  const { error } = await browserClient()
    .from("message_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
export async function defaultTemplate(id: string) {
  const { error } = await browserClient().rpc("set_template_default", {
    p_id: id,
  });
  if (error) throw error;
}
export async function confirmApproach(input: {
  id: string;
  lead: string;
  template: string;
  message: string;
  phone: string;
}) {
  const { data, error } = await browserClient().rpc("confirm_approach", {
    p_id: input.id,
    p_lead: input.lead,
    p_template: input.template,
    p_message: input.message,
    p_phone: input.phone,
  });
  if (error) throw error;
  return data as string;
}
export async function scheduleFollowup(
  lead: string,
  at: string,
  expectedAction: string,
  expectedAt: string | null,
) {
  const { data, error } = await browserClient().rpc(
    "schedule_approach_followup",
    {
      p_lead: lead,
      p_at: at,
      p_expected_action: expectedAction,
      p_expected_at: expectedAt,
    },
  );
  if (error) throw error;
  return data as boolean;
}

export interface CadenceContext {
  lead_id: string;
  template_id: string;
  campaign_name: string;
  status: "IN_PROGRESS" | "RESPONDED" | "COMPLETED" | "PAUSED";
  current_step: number;
  total_followups: number;
  next_followup_at: string | null;
  next_message: string | null;
}
export async function getCadenceContext(leadId: string): Promise<CadenceContext | null> {
  const db = browserClient();
  const { data: cadence, error } = await db.from("lead_cadences").select("lead_id,template_id,campaign_name,status,current_step,total_followups,next_followup_at").eq("lead_id", leadId).maybeSingle();
  if (error) throw error;
  if (!cadence) return null;
  const next = Number(cadence.current_step) + 1;
  const { data: message, error: messageError } = await db.from("campaign_messages").select("message").eq("template_id", cadence.template_id).eq("step", next).maybeSingle();
  if (messageError) throw messageError;
  return { ...(cadence as Omit<CadenceContext,"next_message">), next_message: message?.message || null };
}
export async function confirmCadenceFollowup(input: {id:string;lead:string;message:string;phone:string}) {
  const { data, error } = await browserClient().rpc("confirm_cadence_followup", {p_id:input.id,p_lead:input.lead,p_message:input.message,p_phone:input.phone});
  if (error) throw error;
  return Number(data);
}
export async function scheduleCadenceFollowup(lead:string, at:string) {
  const { data, error } = await browserClient().rpc("schedule_cadence_followup", {p_lead:lead,p_at:at});
  if (error) throw error;
  return Boolean(data);
}
