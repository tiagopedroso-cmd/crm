"use client";
import { useState } from "react";
import { useReference, useProfile, useRefresh } from "@/hooks/use-crm";
import {
  saveGoals,
  saveProduct,
  addObjection,
  backup,
  seedDemo,
  clearDemo,
} from "@/services/crm";
import { download } from "@/lib/utils";
import type { Goals, Product } from "@/types/crm";
import { Loading, ErrorState, Notice, Modal } from "@/components/ui";
const GOAL_LABELS: Record<keyof Omit<Goals, "owner_id">, string> = {
  daily_leads: "Leads por dia",
  weekly_leads: "Leads por semana",
  weekly_revenue: "Faturamento semanal (R$)",
  monthly_revenue: "Meta mensal principal (R$)",
  monthly_system_revenue: "Meta mensal de sistemas (R$)",
  weekly_contacts: "Abordagens por semana",
  weekly_responses: "Respostas por semana",
  weekly_discoveries: "Sondagens por semana",
  weekly_opportunities: "Oportunidades por semana",
  weekly_proposals: "Propostas por semana",
  weekly_negotiations: "Negociações por semana",
  weekly_closings: "Fechamentos por semana",
};
function ProductRow({
  product,
  onSave,
  busy,
}: {
  product: Product;
  onSave: (p: Partial<Product>) => void;
  busy: boolean;
}) {
  return (
    <form
      className="product-row"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          id: product.id,
          name: String(f.get("name")),
          suggested_value: Number(f.get("value")),
          pricing: String(f.get("pricing")) as Product["pricing"],
          active: f.get("active") === "on",
        });
      }}
    >
      <label>
        Produto
        <input
          name="name"
          defaultValue={product.name}
          maxLength={100}
          required
        />
      </label>
      <label>
        Valor sugerido (R$)
        <input
          name="value"
          type="number"
          min="0"
          step="0.01"
          defaultValue={product.suggested_value}
          required
        />
      </label>
      <label>
        Precificação
        <select name="pricing" defaultValue={product.pricing}>
          <option value="fixed">Fixo</option>
          <option value="from">A partir de</option>
          <option value="variable">Variável</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input name="active" type="checkbox" defaultChecked={product.active} />
        Ativo
      </label>
      <button className="btn" disabled={busy}>
        Salvar
      </button>
    </form>
  );
}
export default function Settings() {
  const refs = useReference();
  const profile = useProfile();
  const refresh = useRefresh();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function run(
    fn: () => Promise<unknown>,
    success = "Configuração salva.",
  ) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(success);
    } catch {
      setMessage(
        "Não foi possível concluir. Confira os dados e suas permissões.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (refs.isLoading) return <Loading />;
  if (refs.isError || !refs.data)
    return <ErrorState retry={() => refs.refetch()} />;
  const data = refs.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DO SEU JEITO</p>
          <h1>Configurações</h1>
          <p>Metas claras e uma operação organizada para crescer.</p>
        </div>
      </div>
      <Notice text={message} />
      <div className="settings-stack">
        <section className="card panel">
          <h2>Minhas metas comerciais</h2>
          <p className="muted">
            A meta mensal total é a soma da meta principal com a meta de
            sistemas.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const goals = { ...data.goals };
              for (const key of Object.keys(
                GOAL_LABELS,
              ) as (keyof typeof GOAL_LABELS)[])
                goals[key] = Number(f.get(key));
              void run(() => saveGoals(goals));
            }}
          >
            <div className="form-grid three">
              {Object.entries(GOAL_LABELS).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    min={key === "monthly_system_revenue" ? 0 : 1}
                    step={key.includes("revenue") ? "0.01" : "1"}
                    required
                    defaultValue={data.goals[key as keyof typeof GOAL_LABELS]}
                  />
                </label>
              ))}
            </div>
            <button className="btn primary" disabled={busy}>
              Salvar metas
            </button>
          </form>
        </section>
        <section className="card panel">
          <h2>Produtos e valores sugeridos</h2>
          <p className="muted">
            Alterar o preço sugerido não modifica os valores de leads
            existentes.
          </p>
          {profile.role === "ADMIN" ? (
            <>
              {data.products.map((p) => (
                <ProductRow
                  key={p.id + JSON.stringify(p)}
                  product={p}
                  busy={busy}
                  onSave={(p) => void run(() => saveProduct(p))}
                />
              ))}
              <form
                className="product-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  void run(async () => {
                    await saveProduct({
                      name: String(f.get("name")),
                      suggested_value: Number(f.get("value")),
                      pricing: "variable",
                      active: true,
                    });
                    form.reset();
                  });
                }}
              >
                <label>
                  Novo produto
                  <input name="name" maxLength={100} required />
                </label>
                <label>
                  Valor inicial (R$)
                  <input
                    name="value"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={0}
                    required
                  />
                </label>
                <button className="btn" disabled={busy}>
                  Adicionar produto
                </button>
              </form>
            </>
          ) : (
            <p>Somente administradores podem editar o catálogo de produtos.</p>
          )}
        </section>
        <section className="card panel">
          <h2>Objeções</h2>
          <div className="tags">
            {data.objections.map((o) => (
              <span key={o.id} className="badge">
                {o.name}
              </span>
            ))}
          </div>
          {profile.role === "ADMIN" && (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                void run(async () => {
                  await addObjection(String(f.get("name")).trim());
                  form.reset();
                });
              }}
            >
              <label>
                Nova objeção
                <input name="name" maxLength={150} required />
              </label>
              <button className="btn" disabled={busy}>
                Adicionar
              </button>
            </form>
          )}
        </section>
        <section className="card panel">
          <h2>Portabilidade dos dados</h2>
          <p className="muted">
            Exporte os dados acessíveis ao seu usuário. O arquivo inclui leads,
            interações, histórico, propostas, pós-venda, metas e catálogo.
            Guarde-o em local seguro.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                download(
                  JSON.stringify(await backup(), null, 2),
                  `inovalogix-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  "application/json",
                );
              }, "Backup exportado.")
            }
          >
            Exportar backup JSON
          </button>
        </section>
        <section className="card panel">
          <h2>Dados de demonstração</h2>
          <p className="muted">
            Adicione cinco empresas fictícias, identificadas como demonstração.
            Você pode removê-las junto com seus históricos a qualquer momento.
          </p>
          <div className="actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                void run(seedDemo, "Cinco leads de demonstração adicionados.")
              }
            >
              Adicionar demonstração
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Remover demonstração
            </button>
          </div>
        </section>
        <section className="card panel">
          <h2>Acesso e equipe</h2>
          <p>
            Sua função:{" "}
            <strong>
              {profile.role === "ADMIN" ? "Administrador" : "Vendedor"}
            </strong>
            .
          </p>
          <p className="muted">
            Novos usuários são criados pelo administrador no Supabase Auth.
            Vendedores acessam seus próprios leads; administradores têm acesso à
            operação. A gestão de equipe dentro do CRM fica para uma próxima
            versão.
          </p>
        </section>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Remover dados de demonstração?"
        description="Todos os leads marcados como demonstração acessíveis a você e seus registros relacionados serão removidos."
      >
        <div className="form-body">
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await clearDemo();
                  setConfirm(false);
                }, "Demonstração removida.")
              }
            >
              Confirmar remoção
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
