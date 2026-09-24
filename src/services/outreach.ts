import { browserClient } from "@/lib/supabase/client";
import type { MessageTemplate } from "@/lib/outreach";
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
