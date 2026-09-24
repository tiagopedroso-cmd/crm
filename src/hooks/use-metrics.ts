"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { metrics } from "@/services/crm";
import { periodRange } from "@/lib/utils";
export function useMetrics(initial = "month", owner?: string) {
  const [period, setPeriod] = useState(initial);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const range = periodRange(period, start, end);
  const valid = range.start <= range.end;
  const query = useQuery({
    queryKey: ["metrics", range.start, range.end, owner],
    queryFn: () => metrics(range.start, range.end, owner),
    enabled: valid,
  });
  return {
    query,
    range,
    valid,
    filterProps: {
      period,
      onPeriod: setPeriod,
      start,
      end,
      onStart: setStart,
      onEnd: setEnd,
    },
  };
}
