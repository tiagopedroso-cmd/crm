"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PIPELINE_EVOLUTION_STAGES,
  prospectingEvolution,
  type PipelineEvolutionFilter,
  type PipelineEvolutionStage,
  type ProspectingEvolutionPreset,
} from "@/services/daily-prospecting";
import { ErrorState, Loading } from "@/components/ui";

const W = 1200;
const H = 360;
const PAD_LEFT = 48;
const PAD_RIGHT = 28;
const PAD_TOP = 34;
const PAD_BOTTOM = 42;

const SERIES = [
  { key: "TOTAL", label: "Total de Leads", stroke: "#0f172a" },
  { key: "NOVO LEAD", label: "Leads Novos", stroke: "#2563eb" },
  { key: "CONTATADO", label: "Leads Contatados", stroke: "#0891b2" },
  { key: "RESPONDEU", label: "Leads Responderam", stroke: "#7c3aed" },
  { key: "SONDAGEM", label: "Leads Sondagem", stroke: "#9333ea" },
  { key: "OPORTUNIDADE", label: "Leads Oportunidades", stroke: "#0d9488" },
  { key: "PROPOSTA", label: "Leads Propostas", stroke: "#ca8a04" },
  { key: "NEGOCIAÇÃO", label: "Leads Negociação", stroke: "#ea580c" },
  { key: "FECHADO", label: "Leads Fechados", stroke: "#16a34a" },
  { key: "PÓS-VENDA", label: "Leads Pós-Venda", stroke: "#059669" },
  { key: "PERDIDO", label: "Leads Perdidos", stroke: "#dc2626" },
  {
    key: "RETOMAR FUTURAMENTE",
    label: "Leads Retomar Futuramente",
    stroke: "#64748b",
  },
] as const;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function niceMax(value: number) {
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function buildPath(values: number[], maxY: number) {
  if (!values.length) return "";
  const usableW = W - PAD_LEFT - PAD_RIGHT;
  const usableH = H - PAD_TOP - PAD_BOTTOM;

  return values
    .map((value, index) => {
      const x =
        PAD_LEFT +
        (values.length === 1
          ? usableW / 2
          : (index / (values.length - 1)) * usableW);

      const safeValue = Math.max(0, Math.min(value, maxY));
      const y =
        PAD_TOP + usableH - (safeValue / maxY) * usableH;

      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function metricFor(
  data: Awaited<ReturnType<typeof prospectingEvolution>>,
  key: string,
) {
  if (key === "TOTAL") return data.totals.total;
  return data.totals.stages[key as PipelineEvolutionStage];
}

export function ProspectingEvolutionChart({ owner }: { owner?: string }) {
  const [preset, setPreset] =
    useState<ProspectingEvolutionPreset>("30");
  const [status, setStatus] =
    useState<PipelineEvolutionFilter>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const customReady =
    preset !== "CUSTOM" ||
    Boolean(customStart && customEnd && customStart <= customEnd);

  const q = useQuery({
    queryKey: [
      "pipeline-evolution",
      owner,
      preset,
      customStart,
      customEnd,
    ],
    queryFn: () =>
      prospectingEvolution(owner, preset, customStart, customEnd),
    enabled: customReady,
  });

  const visibleSeries = useMemo(() => {
    if (status === "ALL") return SERIES;
    return SERIES.filter(
      (series) =>
        series.key === "TOTAL" || series.key === status,
    );
  }, [status]);

  const maxY = useMemo(() => {
    if (!q.data) return 5;

    const values: number[] = [];

    for (const point of q.data.points) {
      for (const series of visibleSeries) {
        values.push(
          series.key === "TOTAL"
            ? point.total.quantity
            : point.stages[
                series.key as PipelineEvolutionStage
              ].quantity,
        );
      }
    }

    return niceMax(Math.max(1, ...values));
  }, [q.data, visibleSeries]);

  const yTicks = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) =>
      Math.round((maxY / 5) * index),
    );
  }, [maxY]);

  const labelIndexes = useMemo(() => {
    const length = q.data?.points.length || 0;
    if (!length) return new Set<number>();
    if (length <= 10) {
      return new Set(Array.from({ length }, (_, i) => i));
    }

    const step = Math.ceil(length / 7);
    const indexes = new Set<number>([0, length - 1]);
    for (let i = step; i < length - 1; i += step) {
      indexes.add(i);
    }
    return indexes;
  }, [q.data]);

  return (
    <section className="card" style={{ marginTop: 20, padding: 22 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 20,
          alignItems: "start",
          minHeight: 78,
        }}
      >
        <div>
          <p className="eyebrow">EVOLUÇÃO DO PIPELINE</p>
          <h2 style={{ margin: "3px 0 6px" }}>
            Leads por período e etapa
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Quantidade e valor dos leads cadastrados no período,
            classificados pela etapa atual.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "170px 190px",
            gap: 8,
            alignItems: "start",
            minWidth: 368,
          }}
        >
          <select
            value={preset}
            onChange={(e) =>
              setPreset(
                e.target.value as ProspectingEvolutionPreset,
              )
            }
            aria-label="Período do gráfico"
            style={{ width: "100%" }}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="CUSTOM">Personalizado</option>
          </select>

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as PipelineEvolutionFilter)
            }
            aria-label="Filtrar por status"
            style={{ width: "100%" }}
          >
            <option value="ALL">Todos os status</option>
            {PIPELINE_EVOLUTION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              minHeight: 38,
              visibility:
                preset === "CUSTOM" ? "visible" : "hidden",
            }}
          >
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              aria-label="Data final"
            />
          </div>
        </div>
      </div>

      {!customReady && (
        <p className="muted" style={{ marginTop: 14 }}>
          Selecione a data inicial e final para visualizar o período.
        </p>
      )}

      {customReady && q.isLoading && <Loading />}
      {customReady && q.isError && (
        <ErrorState retry={() => q.refetch()} />
      )}

      {q.data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 8,
              marginTop: 18,
              marginBottom: 18,
            }}
          >
            {SERIES.map((series) => {
              const metric = metricFor(q.data!, series.key);
              const selected =
                status === "ALL" ||
                series.key === "TOTAL" ||
                series.key === status;

              return (
                <div
                  key={series.key}
                  style={{
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    minWidth: 0,
                    opacity: selected ? 1 : 0.42,
                    background: "var(--surface, #fff)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      marginBottom: 5,
                      minWidth: 0,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        flex: "0 0 auto",
                        background: series.stroke,
                      }}
                    />
                    <strong
                      style={{
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={series.label}
                    >
                      {series.label}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>
                      {metric.quantity}
                    </span>
                    <span
                      className="muted"
                      style={{
                        textAlign: "right",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={money(metric.value)}
                    >
                      {money(metric.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border, #e2e8f0)",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                overflowX: "auto",
                width: "100%",
                paddingTop: 4,
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="Gráfico de evolução dos leads por etapa"
                style={{
                  width: "100%",
                  minWidth: 760,
                  height: "auto",
                  display: "block",
                }}
              >
                <defs>
                  <clipPath id="pipeline-plot-clip">
                    <rect
                      x={PAD_LEFT}
                      y={PAD_TOP}
                      width={W - PAD_LEFT - PAD_RIGHT}
                      height={H - PAD_TOP - PAD_BOTTOM}
                    />
                  </clipPath>
                </defs>

                {yTicks.map((tick) => {
                  const usableH = H - PAD_TOP - PAD_BOTTOM;
                  const y =
                    PAD_TOP +
                    usableH -
                    (tick / maxY) * usableH;

                  return (
                    <g key={tick}>
                      <line
                        x1={PAD_LEFT}
                        y1={y}
                        x2={W - PAD_RIGHT}
                        y2={y}
                        stroke="currentColor"
                        opacity="0.08"
                      />
                      <text
                        x={PAD_LEFT - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="currentColor"
                        opacity="0.55"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                <g clipPath="url(#pipeline-plot-clip)">
                  {visibleSeries.map((series) => {
                    const values = q.data!.points.map((point) =>
                      series.key === "TOTAL"
                        ? point.total.quantity
                        : point.stages[
                            series.key as PipelineEvolutionStage
                          ].quantity,
                    );

                    const usableW = W - PAD_LEFT - PAD_RIGHT;
                    const usableH = H - PAD_TOP - PAD_BOTTOM;

                    return (
                      <g key={series.key}>
                        <path
                          d={buildPath(values, maxY)}
                          fill="none"
                          stroke={series.stroke}
                          strokeWidth={
                            series.key === "TOTAL" ? 3 : 2
                          }
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={
                            series.key === "TOTAL" ? 0.95 : 0.78
                          }
                        />

                        {values.map((value, index) => {
                          if (value <= 0) return null;

                          const x =
                            PAD_LEFT +
                            (values.length === 1
                              ? usableW / 2
                              : (index / (values.length - 1)) * usableW);

                          const safeValue = Math.max(
                            0,
                            Math.min(value, maxY),
                          );
                          const y =
                            PAD_TOP +
                            usableH -
                            (safeValue / maxY) * usableH;

                          return (
                            <circle
                              key={`point-${series.key}-${index}`}
                              cx={x}
                              cy={y}
                              r={series.key === "TOTAL" ? 3.5 : 2.75}
                              fill={series.stroke}
                              opacity={
                                series.key === "TOTAL" ? 1 : 0.86
                              }
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </g>


                {/* Rótulos externos aos paths: quantidade nos pontos > 0.
                    Em "Todos os status", distribui verticalmente as séries
                    que caem no mesmo ponto para reduzir sobreposição. */}
                {q.data.points.flatMap((point, pointIndex) => {
                  const usableW = W - PAD_LEFT - PAD_RIGHT;
                  const usableH = H - PAD_TOP - PAD_BOTTOM;
                  const x =
                    PAD_LEFT +
                    (q.data!.points.length === 1
                      ? usableW / 2
                      : (pointIndex /
                          (q.data!.points.length - 1)) *
                        usableW);

                  const candidates = visibleSeries
                    .map((series, seriesIndex) => {
                      const value =
                        series.key === "TOTAL"
                          ? point.total.quantity
                          : point.stages[
                              series.key as PipelineEvolutionStage
                            ].quantity;

                      return {
                        series,
                        seriesIndex,
                        value,
                      };
                    })
                    .filter((item) => item.value > 0);

                  return candidates.map((item, candidateIndex) => {
                    const safeValue = Math.max(
                      0,
                      Math.min(item.value, maxY),
                    );

                    const pointY =
                      PAD_TOP +
                      usableH -
                      (safeValue / maxY) * usableH;

                    // Alterna rótulos para cima/baixo e em níveis diferentes
                    // quando várias séries ocupam a mesma região.
                    const level = Math.floor(candidateIndex / 2);
                    const direction =
                      candidateIndex % 2 === 0 ? -1 : 1;
                    const verticalOffset =
                      direction * (12 + level * 11);

                    const labelY = Math.max(
                      12,
                      Math.min(
                        H - PAD_BOTTOM - 6,
                        pointY + verticalOffset,
                      ),
                    );

                    const edgeShift =
                      pointIndex === 0
                        ? 8
                        : pointIndex === q.data!.points.length - 1
                          ? -8
                          : 0;

                    const textAnchor =
                      pointIndex === 0
                        ? "start"
                        : pointIndex === q.data!.points.length - 1
                          ? "end"
                          : "middle";

                    return (
                      <g
                        key={`label-${item.series.key}-${point.day}`}
                        pointerEvents="none"
                      >
                        <rect
                          x={
                            x +
                            edgeShift -
                            Math.max(
                              10,
                              String(item.value).length * 3.8 + 5,
                            )
                          }
                          y={labelY - 10}
                          width={Math.max(
                            20,
                            String(item.value).length * 7.6 + 10,
                          )}
                          height={16}
                          rx={5}
                          fill="white"
                          opacity="0.88"
                        />
                        <text
                          x={x + edgeShift}
                          y={labelY + 2}
                          textAnchor={textAnchor}
                          fontSize="10"
                          fontWeight="700"
                          fill={item.series.stroke}
                        >
                          {item.value}
                        </text>
                      </g>
                    );
                  });
                })}

                {q.data.points.map((point, index) => {
                  if (!labelIndexes.has(index)) return null;

                  const usableW = W - PAD_LEFT - PAD_RIGHT;
                  const x =
                    PAD_LEFT +
                    (q.data!.points.length === 1
                      ? usableW / 2
                      : (index /
                          (q.data!.points.length - 1)) *
                        usableW);

                  return (
                    <text
                      key={point.day}
                      x={x}
                      y={H - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="currentColor"
                      opacity="0.55"
                    >
                      {point.label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <p
            className="muted"
            style={{ margin: "10px 0 0", fontSize: 12 }}
          >
            {q.data.methodology}
          </p>
        </>
      )}
    </section>
  );
}
