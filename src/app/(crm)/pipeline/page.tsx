"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { STAGES, type Lead, type Stage } from "@/types/crm";
import { listLeads, changeStage } from "@/services/crm";
import { useReference, useRefresh } from "@/hooks/use-crm";
import { LeadCard } from "@/components/leads/lead-card";
import { StageDialog } from "@/components/leads/stage-control";
import { ErrorState, Loading, Notice } from "@/components/ui";
function DraggableCard({ lead, product }: { lead: Lead; product?: string }) {
  const d = useDraggable({ id: lead.id, data: { lead } });
  return (
    <div
      ref={d.setNodeRef}
      className={`draggable ${d.isDragging ? "dragging" : ""}`}
    >
      <button
        className="drag-handle"
        aria-label={`Arrastar ${lead.company}`}
        {...d.attributes}
        {...d.listeners}
      >
        <GripVertical size={16} />
      </button>
      <LeadCard lead={lead} product={product} />
    </div>
  );
}
function Column({ stage }: { stage: Stage }) {
  const [page, setPage] = useState(0);
  const refs = useReference();
  const q = useQuery({
    queryKey: ["pipeline", stage, page],
    queryFn: () => listLeads({ stage }, page, 20),
  });
  const drop = useDroppable({ id: stage });
  return (
    <section
      ref={drop.setNodeRef}
      className={`kanban-column ${drop.isOver ? "drop-over" : ""}`}
    >
      <header>
        <h2>{stage.toLocaleLowerCase("pt-BR")}</h2>
        <span>{q.data?.count || 0}</span>
      </header>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState retry={() => q.refetch()} />
      ) : (
        <>
          <div className="kanban-cards">
            {q.data?.rows.map((l) => (
              <DraggableCard
                key={l.id}
                lead={l}
                product={
                  refs.data?.products.find((p) => p.id === l.product_id)?.name
                }
              />
            ))}
            {!q.data?.rows.length && (
              <p className="column-empty">Nenhum lead nesta etapa</p>
            )}
          </div>
          {(page > 0 || (q.data?.count || 0) > 20) && (
            <div className="pagination">
              <button
                className="btn"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                ←
              </button>
              <span>{page + 1}</span>
              <button
                className="btn"
                disabled={(page + 1) * 20 >= (q.data?.count || 0)}
                onClick={() => setPage(page + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export default function Pipeline() {
  const cache = useQueryClient();
  const refresh = useRefresh();
  const [group, setGroup] = useState("prospeccao");
  const [active, setActive] = useState<Lead | null>(null);
  const [pending, setPending] = useState<{ lead: Lead; stage: Stage } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const stages =
    group === "prospeccao"
      ? STAGES.slice(0, 4)
      : group === "negocios"
        ? STAGES.slice(4, 8)
        : STAGES.slice(8);
  async function move(lead: Lead, stage: Stage, extra: Partial<Lead> = {}) {
    if (lead.stage === stage) return;
    setSaving(true);
    await cache.cancelQueries({ queryKey: ["pipeline"] });
    const previous = cache.getQueriesData<{ rows: Lead[]; count: number }>({
      queryKey: ["pipeline"],
    });
    cache.setQueriesData<{ rows: Lead[]; count: number }>(
      { queryKey: ["pipeline"] },
      (old) =>
        old
          ? {
              ...old,
              rows: old.rows.filter((l) => l.id !== lead.id),
              count: old.rows.some((l) => l.id === lead.id)
                ? old.count - 1
                : old.count,
            }
          : old,
    );
    for (const [key, data] of previous)
      if (key[1] === stage && key[2] === 0 && data)
        cache.setQueryData(key, {
          ...data,
          count: data.count + 1,
          rows: [{ ...lead, ...extra, stage }, ...data.rows].slice(0, 20),
        });
    try {
      await changeStage(lead.id, stage, extra);
      setMessage(`${lead.company}: etapa atualizada.`);
    } catch (e) {
      for (const [key, data] of previous) cache.setQueryData(key, data);
      setMessage("Não foi possível salvar. O movimento foi desfeito.");
      throw e;
    } finally {
      setSaving(false);
      await refresh();
    }
  }
  async function end(e: DragEndEvent) {
    setActive(null);
    if (!e.over || saving) return;
    const lead = e.active.data.current?.lead as Lead;
    const stage = e.over.id as Stage;
    if (!lead || lead.stage === stage) return;
    if (["FECHADO", "PERDIDO", "PÓS-VENDA"].includes(stage)) {
      setPending({ lead, stage });
      return;
    }
    try {
      await move(lead, stage);
    } catch {
      /* rollback message is displayed */
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DO CONTATO À CONQUISTA</p>
          <h1>Pipeline comercial</h1>
          <p>Um próximo passo para cada oportunidade.</p>
        </div>
        <span className="muted small">
          Arraste pelo ícone ou use o seletor de etapa.
        </span>
      </div>
      <div className="tabs pipeline-tabs">
        {[
          ["prospeccao", "01 · Prospecção"],
          ["negocios", "02 · Negócios"],
          ["relacionamento", "03 · Relacionamento"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={group === id ? "active" : ""}
            onClick={() => setGroup(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <Notice text={message} />
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActive(e.active.data.current?.lead as Lead)}
        onDragEnd={end}
        onDragCancel={() => setActive(null)}
      >
        <div className={`kanban ${saving ? "saving" : ""}`}>
          {stages.map((stage) => (
            <Column key={stage} stage={stage} />
          ))}
        </div>
        <DragOverlay>
          {active ? (
            <div className="drag-preview">
              <LeadCard lead={active} stageControl={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {pending && (
        <StageDialog
          lead={pending.lead}
          stage={pending.stage}
          onClose={() => setPending(null)}
          onSave={(extra) => move(pending.lead, pending.stage, extra)}
        />
      )}
    </>
  );
}
