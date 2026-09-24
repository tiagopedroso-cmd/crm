"use client";
import { useEffect, useState } from "react";
import { AgendaList } from "@/components/analytics/agenda-list";
export default function Agenda() {
  const [action, setAction] = useState("agenda");
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("f");
    if (f && ["overdue", "missing", "today"].includes(f)) setAction(f);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">NENHUMA CONVERSA ESQUECIDA</p>
          <h1>Agenda de hoje</h1>
          <p>Atrasos primeiro. Depois, seu próximo movimento.</p>
        </div>
      </div>
      <div className="tabs">
        {[
          ["agenda", "Próximas ações"],
          ["today", "Hoje"],
          ["overdue", "Atrasadas"],
          ["missing", "Sem próxima ação"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={action === id ? "active" : ""}
            onClick={() => setAction(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <AgendaList key={action} action={action} />
    </>
  );
}
