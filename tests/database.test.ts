import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  ADMIN = "00000000-0000-4000-8000-000000000003";
let db: PGlite;
let leadId: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const file of ["202609230001_crm.sql", "202609230002_analytics.sql"])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(
    `insert into auth.users(id) values('${A}'),('${B}'),('${ADMIN}');update public.profiles set role='ADMIN' where id='${ADMIN}';`,
  );
});
afterAll(async () => {
  await db.close();
});
describe.sequential("PostgreSQL, RLS e regras comerciais", () => {
  it("cria perfil e metas sem permitir promoção de vendedor", async () => {
    await asUser(A);
    const goals = await db.query<{ daily_leads: number }>(
      "select daily_leads from sales_goals",
    );
    expect(goals.rows).toEqual([{ daily_leads: 20 }]);
    await expect(
      db.exec(`update profiles set role='ADMIN' where id='${A}'`),
    ).rejects.toThrow();
  });
  it("cadastro rápido, persistência e isolamento entre usuários", async () => {
    await asUser(A);
    const r = await db.query<{ id: string }>(
      `insert into leads(company,potential_value) values('Clínica teste',1500) returning id`,
    );
    leadId = r.rows[0].id;
    expect((await db.query("select * from leads")).rows).toHaveLength(1);
    await asUser(B);
    expect((await db.query("select * from leads")).rows).toHaveLength(0);
    await db.exec(`update leads set company='Invasão' where id='${leadId}'`);
    await expect(
      db.exec(`insert into leads(company,owner_id) values('Forjado','${A}')`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into lead_interactions(lead_id,type,description) values('${leadId}','WhatsApp','Invasão')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into proposals(lead_id,title,amount) values('${leadId}','Invasão',1)`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`insert into after_sales(lead_id) values('${leadId}')`),
    ).rejects.toThrow();
    await asUser(A);
    expect(
      (
        await db.query<{ company: string }>(
          `select company from leads where id='${leadId}'`,
        )
      ).rows[0].company,
    ).toBe("Clínica teste");
  });
  it("nega acesso anônimo e permite leitura administrativa", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from leads")).rejects.toThrow();
    await expect(
      db.query(`select crm_metrics(current_date,current_date)`),
    ).rejects.toThrow();
    await asUser(ADMIN);
    expect((await db.query("select * from leads")).rows).toHaveLength(1);
  });
  it("registra primeiro contato uma vez e preserva histórico", async () => {
    await asUser(A);
    await db.exec(`update leads set stage='CONTATADO' where id='${leadId}'`);
    const first = (
      await db.query<{ first_contact_at: string }>(
        `select first_contact_at from leads where id='${leadId}'`,
      )
    ).rows[0].first_contact_at;
    expect(first).toBeTruthy();
    await db.exec(
      `update leads set stage='RESPONDEU',first_contact_at='2000-01-01' where id='${leadId}'`,
    );
    expect(
      (
        await db.query<{ first_contact_at: string }>(
          `select first_contact_at from leads where id='${leadId}'`,
        )
      ).rows[0].first_contact_at,
    ).toEqual(first);
    expect(
      (await db.query("select * from pipeline_history")).rows,
    ).toHaveLength(3);
    await expect(
      db.exec(
        `insert into pipeline_history(lead_id,to_stage) values('${leadId}','FECHADO')`,
      ),
    ).rejects.toThrow();
    await expect(db.exec("delete from pipeline_history")).rejects.toThrow();
  });
  it("interação atualiza última interação e exige autoria verdadeira", async () => {
    await asUser(A);
    await db.exec(
      `insert into lead_interactions(lead_id,type,description,occurred_at) values('${leadId}','WhatsApp','Conversamos sobre o site','2026-09-23T12:30:00Z')`,
    );
    expect(
      (
        await db.query<{ last_interaction_at: string }>(
          `select last_interaction_at from leads where id='${leadId}'`,
        )
      ).rows[0].last_interaction_at,
    ).toBeTruthy();
    await expect(
      db.exec(
        `insert into lead_interactions(lead_id,type,description,actor_id) values('${leadId}','WhatsApp','Forjado','${B}')`,
      ),
    ).rejects.toThrow();
  });
  it("exige motivo de perda, fechamento completo e próxima ação consistente", async () => {
    await asUser(A);
    await expect(
      db.exec(`update leads set stage='PERDIDO' where id='${leadId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update leads set stage='FECHADO' where id='${leadId}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(`update leads set next_action='Ligar' where id='${leadId}'`),
    ).rejects.toThrow();
    await db.exec(
      `update leads set next_action='Ligar',next_action_at=now(),stage='PERDIDO',loss_reason='Preço' where id='${leadId}'`,
    );
  });
  it("fatura o valor fechado e preserva faturamento no pós-venda", async () => {
    await asUser(A);
    await db.exec(
      `update leads set stage='FECHADO',closed_value=1200,closed_on=(now() at time zone 'America/Sao_Paulo')::date,payment_method='Pix' where id='${leadId}'`,
    );
    let r = await db.query<{
      m: { revenue: number; closings: number; pipeline: number };
    }>(`select crm_metrics('2000-01-01','2100-01-01') m`);
    expect(r.rows[0].m.revenue).toBe(1200);
    expect(r.rows[0].m.closings).toBe(1);
    expect(r.rows[0].m.pipeline).toBe(0);
    await db.exec(`update leads set stage='PÓS-VENDA' where id='${leadId}'`);
    r = await db.query(`select crm_metrics('2000-01-01','2100-01-01') m`);
    expect(r.rows[0].m.revenue).toBe(1200);
    await asUser(B);
    r = await db.query(`select crm_metrics('2000-01-01','2100-01-01') m`);
    expect(r.rows[0].m.revenue).toBe(0);
  });
  it("restringe catálogo a admin e salva metas por usuário", async () => {
    await asUser(A);
    await expect(
      db.exec(`insert into products(name) values('Não permitido')`),
    ).rejects.toThrow();
    await db.exec("update sales_goals set daily_leads=25");
    expect(
      (
        await db.query<{ daily_leads: number }>(
          "select daily_leads from sales_goals",
        )
      ).rows[0].daily_leads,
    ).toBe(25);
    await asUser(ADMIN);
    await db.exec(
      `insert into products(name,suggested_value) values('Consultoria',800)`,
    );
  });
  it("exclusão em cascata respeita proprietário", async () => {
    await asUser(B);
    await db.exec(`delete from leads where id='${leadId}'`);
    await asUser(A);
    expect((await db.query("select * from leads")).rows).toHaveLength(1);
    await db.exec(`delete from leads where id='${leadId}'`);
    expect(
      (await db.query("select * from pipeline_history")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from lead_interactions")).rows,
    ).toHaveLength(0);
  });
});
