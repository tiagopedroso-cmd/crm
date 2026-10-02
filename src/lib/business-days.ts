const DAY_MS = 86_400_000;

export function dateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function noonUtc(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function isBusinessDay(value: Date | string) {
  const weekday = noonUtc(dateOnly(value)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

export function addBusinessDays(value: Date | string, amount: number) {
  let cursor = noonUtc(dateOnly(value));
  let remaining = Math.max(0, Math.trunc(amount));
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isBusinessDay(cursor)) remaining -= 1;
  }
  return dateOnly(cursor);
}

export function nextBusinessDays(value: Date | string, amount: number) {
  const days: string[] = [];
  let cursor = dateOnly(value);
  while (days.length < amount) {
    cursor = addBusinessDays(cursor, 1);
    days.push(cursor);
  }
  return days;
}

export function businessDaysLate(due: Date | string, today: Date | string) {
  const dueDay = dateOnly(due);
  const todayDay = dateOnly(today);
  if (dueDay >= todayDay) return 0;
  let cursor = dueDay;
  let count = 0;
  while (cursor < todayDay) {
    cursor = addBusinessDays(cursor, 1);
    if (cursor <= todayDay) count += 1;
  }
  return count;
}

export function eligibleFollowupInput(value: Date | string, hour = "09:00") {
  return `${addBusinessDays(value, 3)}T${hour}`;
}
