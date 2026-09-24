"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useReference, useProfile } from "@/hooks/use-crm";
import {
  STAGES,
  SOURCES,
  CHANNELS,
  EMPTY_FILTERS,
  type Filters,
} from "@/types/crm";
export function LeadFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (v: Filters) => void;
}) {
  const refs = useReference();
  const profile = useProfile();
  const [expanded, setExpanded] = useState(false);
  const set = (key: keyof Filters, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="filter-wrap">
      <div className="toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Pesquisar leads"
            placeholder="Buscar empresa, contato, WhatsApp ou nicho…"
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar etapa"
          value={value.stage}
          onChange={(e) => set("stage", e.target.value)}
        >
          <option value="">Todas as etapas</option>
          {STAGES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar ações"
          value={value.action}
          onChange={(e) => set("action", e.target.value)}
        >
          <option value="">Todas as ações</option>
          <option value="today">Ação hoje</option>
          <option value="overdue">Atrasados</option>
          <option value="missing">Sem próxima ação</option>
          <option value="scheduled">Com próxima ação</option>
        </select>
        <button
          className="btn"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={17} />
          Filtros
        </button>
      </div>
      {expanded && (
        <div className="advanced-filters">
          <label>
            Produto
            <select
              value={value.product_id}
              onChange={(e) => set("product_id", e.target.value)}
            >
              <option value="">Todos</option>
              {refs.data?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {(["niche", "city", "state"] as const).map((key, i) => (
            <label key={key}>
              {["Nicho", "Cidade", "UF"][i]}
              <input
                value={value[key]}
                onChange={(e) =>
                  set(
                    key,
                    key === "state"
                      ? e.target.value.toUpperCase()
                      : e.target.value,
                  )
                }
              />
            </label>
          ))}
          {(["source", "channel"] as const).map((key, i) => (
            <label key={key}>
              {["Origem", "Canal"][i]}
              <select
                value={value[key]}
                onChange={(e) => set(key, e.target.value)}
              >
                <option value="">Todos</option>
                {[SOURCES, CHANNELS][i].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {profile.role === "ADMIN" && (
            <label>
              Responsável
              <select
                value={value.owner_id}
                onChange={(e) => set("owner_id", e.target.value)}
              >
                <option value="">Todos</option>
                {refs.data?.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Inserido de
            <input
              type="date"
              value={value.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              min={value.from}
              value={value.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </label>
          <button
            className="text-button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}
