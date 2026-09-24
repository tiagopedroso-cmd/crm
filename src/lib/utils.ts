export const TIMEZONE = "America/Sao_Paulo";
export const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );
export const dayKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const dateLabel = (value: string | null, time = false) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(
        new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value),
      )
    : "Não informado";
export function periodRange(period: string, start = "", end = "") {
  const today = dayKey();
  const d = new Date(`${today}T12:00:00Z`);
  if (period === "custom") return { start: start || today, end: end || today };
  if (period === "week")
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (period === "month") d.setUTCDate(1);
  return { start: d.toISOString().slice(0, 10), end: today };
}
export const localInput = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(new Date(v))
        .replace(" ", "T")
    : "";
export const inputToInstant = (v: string) =>
  v ? new Date(`${v}:00-03:00`).toISOString() : null;
export function whatsappUrl(phone: string, message = "") {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && [11, 12].includes(digits.length))
    digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits.length >= 12 && digits.length <= 15
    ? `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;
}
export function leadMessage(
  company: string,
  contact: string | null,
  sender = "",
) {
  const greeting = contact?.trim()
    ? `Olá, ${contact.trim()}! Tudo bem?`
    : `Olá, equipe da ${company}! Tudo bem?`;
  const introduction = sender.trim()
    ? `Sou ${sender.trim()}, da InovaLogix.`
    : "Sou da InovaLogix.";
  return `${greeting}\n\n${introduction} Gostaria de conversar com o responsável pela ${company} sobre como podemos ajudar a empresa a atrair novos clientes pela internet.\n\nPodemos conversar?`;
}
export const activeStage = (stage: string) =>
  !["FECHADO", "PÓS-VENDA", "PERDIDO"].includes(stage);
export function actionStatus(l: {
  stage: string;
  next_action_at: string | null;
}) {
  if (!activeStage(l.stage)) return "";
  if (!l.next_action_at) return "Sem próxima ação";
  if (new Date(l.next_action_at) < new Date()) return "Ação atrasada";
  return dayKey(new Date(l.next_action_at)) === dayKey() ? "Ação hoje" : "";
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return (
    "\uFEFF" +
    [
      keys.map(csvCell).join(";"),
      ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(";")),
    ].join("\r\n")
  );
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
