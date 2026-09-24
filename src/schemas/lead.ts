import { z } from "zod";
import { STAGES } from "@/types/crm";
const text = z.string().max(10000);
const url = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^https?:\/\/[^\s]+$/i.test(v),
    "Informe uma URL http(s) válida",
  );
export const leadSchema = z
  .object({
    company: z.string().trim().min(1, "Informe a empresa").max(200),
    contact_name: text,
    referred_by: text.default(""),
    whatsapp: z.string().max(30),
    email: z.union([z.email(), z.literal("")]),
    instagram: url.refine(
      (v) => !v || v.startsWith("https://"),
      "Use https://",
    ),
    website: url,
    niche: text,
    city: text,
    state: z.string().regex(/^([A-Z]{2})?$/, "Use a UF com duas letras"),
    source: text,
    channel: text,
    product_id: z.uuid().nullable(),
    potential_value: z.number().min(0).max(999999999999),
    stage: z.enum(STAGES),
    inserted_on: z.iso.date(),
    first_contact_at: z.iso.datetime({ offset: true }).nullable(),
    next_action: text,
    next_action_at: z.iso.datetime({ offset: true }).nullable(),
    pain: text,
    objective: text,
    discovery_notes: text,
    urgency: text,
    decision_maker: text,
    budget: z.number().min(0).nullable(),
    objection_id: z.uuid().nullable(),
    loss_reason: text,
    closed_on: z.iso.date().nullable(),
    closed_value: z.number().min(0).nullable(),
    payment_method: text,
    closing_notes: text,
    notes: text,
  })
  .superRefine((l, ctx) => {
    if (l.stage === "PERDIDO" && !l.loss_reason.trim())
      ctx.addIssue({
        code: "custom",
        message: "Informe o motivo da perda",
        path: ["loss_reason"],
      });
    if (
      ["FECHADO", "PÓS-VENDA"].includes(l.stage) &&
      (!l.closed_on || l.closed_value === null || !l.payment_method.trim())
    )
      ctx.addIssue({
        code: "custom",
        message: "Informe valor fechado, data e forma de pagamento",
        path: ["closed_value"],
      });
    if (Boolean(l.next_action.trim()) !== Boolean(l.next_action_at))
      ctx.addIssue({
        code: "custom",
        message: "Preencha a próxima ação e sua data/horário juntos",
        path: ["next_action"],
      });
  });
