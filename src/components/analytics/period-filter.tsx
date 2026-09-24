"use client";
export function PeriodFilter({
  period,
  onPeriod,
  start,
  end,
  onStart,
  onEnd,
}: {
  period: string;
  onPeriod: (v: string) => void;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div className="period-filter">
      <select
        aria-label="Período"
        value={period}
        onChange={(e) => {
          onPeriod(e.target.value);
          if (e.target.value !== "custom") {
            onStart("");
            onEnd("");
          }
        }}
      >
        <option value="today">Hoje</option>
        <option value="week">Esta semana</option>
        <option value="month">Este mês</option>
        <option value="custom">Personalizado</option>
      </select>
      {period === "custom" && (
        <>
          <input
            aria-label="Início do período"
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => onStart(e.target.value)}
          />
          <input
            aria-label="Fim do período"
            type="date"
            value={end}
            min={start}
            onChange={(e) => onEnd(e.target.value)}
          />
        </>
      )}
    </div>
  );
}
