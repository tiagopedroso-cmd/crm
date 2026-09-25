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
  for (const file of [
    "202609230001_crm.sql",
    "202609230002_analytics.sql",
    "202609240001_outreach.sql",
    "202609240002_user_names.sql",
    "202609250001_completed_actions.sql",
  ])
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

describe.sequential("Templates privados e confirmação de abordagem", () => {
  let template: string, approachLead: string, first: unknown;
  const request = "10000000-0000-4000-8000-000000000001";
  it("distribui onze modelos privados e isola até administradores", async () => {
    await asUser(A);
    const templates = await db.query<{ id: string; message: string }>(
      "select * from message_templates order by name",
    );
    expect(templates.rows).toHaveLength(11);
    template = templates.rows[0].id;
    await asUser(B);
    expect(
      (
        await db.query("select * from message_templates where id=$1", [
          template,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "update message_templates set message='invasão' where id=$1",
      [template],
    );
    await expect(
      db.query(
        "insert into message_templates(user_id,name,niche_group,message) values($1,'Forjado','Geral','Oi')",
        [A],
      ),
    ).rejects.toThrow();
    await asUser(ADMIN);
    expect(
      (
        await db.query("select * from message_templates where id=$1", [
          template,
        ])
      ).rows,
    ).toHaveLength(0);
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from message_templates")).rejects.toThrow();
    await expect(
      db.query("select confirm_approach($1,$1,$1,'Oi','5511999999999')", [
        request,
      ]),
    ).rejects.toThrow();
    await asUser(A);
    expect(
      (
        await db.query<{ message: string }>(
          "select message from message_templates where id=$1",
          [template],
        )
      ).rows[0].message,
    ).toBe(templates.rows[0].message);
  });
  it("salva padrão sem expor templates alheios", async () => {
    await asUser(A);
    await db.query("select set_template_default($1)", [template]);
    expect(
      (
        await db.query<{ is_default: boolean }>(
          "select is_default from message_templates where id=$1",
          [template],
        )
      ).rows[0].is_default,
    ).toBe(true);
    await asUser(B);
    await expect(
      db.query("select set_template_default($1)", [template]),
    ).rejects.toThrow();
  });
  it("confirma interação, primeiro contato e etapa atomicamente; retry não duplica", async () => {
    await asUser(A);
    approachLead = (
      await db.query<{ id: string }>(
        "insert into leads(company,whatsapp) values('Topografia Horizonte','11999999999') returning id",
      )
    ).rows[0].id;
    await db.query("select confirm_approach($1,$2,$3,$4,$5)", [
      request,
      approachLead,
      template,
      "Texto realmente enviado",
      "5511999999999",
    ]);
    await db.query("select confirm_approach($1,$2,$3,$4,$5)", [
      request,
      approachLead,
      template,
      "Tentativa repetida",
      "5511999999999",
    ]);
    const l = (
      await db.query<{
        stage: string;
        first_contact_at: unknown;
        last_interaction_at: unknown;
      }>("select * from leads where id=$1", [approachLead])
    ).rows[0];
    expect(l.stage).toBe("CONTATADO");
    expect(l.first_contact_at).toBeTruthy();
    expect(l.last_interaction_at).toBeTruthy();
    first = l.first_contact_at;
    expect(
      (
        await db.query("select * from lead_interactions where lead_id=$1", [
          approachLead,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ message: string }>(
          "select * from lead_approaches where lead_id=$1",
          [approachLead],
        )
      ).rows[0].message,
    ).toBe("Texto realmente enviado");
    expect(
      (
        await db.query<{ reason: string }>(
          "select reason from pipeline_history where lead_id=$1 and from_stage='NOVO LEAD'",
          [approachLead],
        )
      ).rows[0].reason,
    ).toBe("Primeira abordagem enviada via WhatsApp.");
  });
  it("nega lead ou modelo de outro usuário e impede alteração da auditoria", async () => {
    await asUser(B);
    const mine = (
      await db.query<{ id: string }>("select id from message_templates limit 1")
    ).rows[0].id;
    await expect(
      db.query(
        "select confirm_approach(gen_random_uuid(),$1,$2,'Oi','5511999999999')",
        [approachLead, mine],
      ),
    ).rejects.toThrow();
    expect((await db.query("select * from lead_approaches")).rows).toHaveLength(
      0,
    );
    await asUser(A);
    await expect(
      db.query(
        "select confirm_approach(gen_random_uuid(),$1,$2,'Oi','5511999999999')",
        [approachLead, mine],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("update lead_approaches set message='forjado'"),
    ).rejects.toThrow();
  });
  it("preserva primeiro contato e outras etapas; não sobrescreve ação concorrente", async () => {
    await asUser(A);
    await db.query(
      "update leads set stage='RESPONDEU',next_action='Reunião',next_action_at=now()+interval '1 day' where id=$1",
      [approachLead],
    );
    await db.query(
      "select confirm_approach(gen_random_uuid(),$1,$2,'Nova conversa','5511999999999')",
      [approachLead, template],
    );
    const l = (
      await db.query<{
        stage: string;
        first_contact_at: unknown;
        next_action_at: string;
      }>("select * from leads where id=$1", [approachLead])
    ).rows[0];
    expect(l.stage).toBe("RESPONDEU");
    expect(l.first_contact_at).toEqual(first);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select schedule_approach_followup($1,now()+interval '2 days','',null) ok",
          [approachLead],
        )
      ).rows[0].ok,
    ).toBe(false);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select schedule_approach_followup($1,now()+interval '2 days','Reunião',$2) ok",
          [approachLead, l.next_action_at],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (
        await db.query<{ next_action: string }>(
          "select next_action from leads where id=$1",
          [approachLead],
        )
      ).rows[0].next_action,
    ).toBe("1º follow-up WhatsApp");
  });
  it("excluir modelo preserva texto e nome no histórico da abordagem", async () => {
    await asUser(A);
    await db.query("delete from message_templates where id=$1", [template]);
    const a = (
      await db.query<{
        template_id: string | null;
        template_name: string;
        message: string;
      }>("select * from lead_approaches where id=$1", [request])
    ).rows[0];
    expect(a.template_id).toBeNull();
    expect(a.template_name).toBeTruthy();
    expect(a.message).toBe("Texto realmente enviado");
  });
});

describe.sequential("Nomes dos usuários", () => {
  it("permite editar nome próprio e impede editar outros usuários ou papel", async () => {
    await asUser(A);
    await db.query("update profiles set display_name='Tiago' where id=$1", [A]);
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from profiles where id=$1",
          [A],
        )
      ).rows[0].display_name,
    ).toBe("Tiago");
    await expect(
      db.query("update profiles set role='ADMIN' where id=$1", [A]),
    ).rejects.toThrow();
    await asUser(B);
    await db.query("update profiles set display_name='Outro' where id=$1", [A]);
    await asUser(A);
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from profiles where id=$1",
          [A],
        )
      ).rows[0].display_name,
    ).toBe("Tiago");
    await asUser(ADMIN);
    await db.query(
      "update profiles set display_name='Tiago Pedroso' where id=$1",
      [A],
    );
    expect(
      (
        await db.query<{ display_name: string }>(
          "select display_name from profiles where id=$1",
          [A],
        )
      ).rows[0].display_name,
    ).toBe("Tiago Pedroso");
  });
  it("novas contas recebem nome, metas e modelos com variável do remetente", async () => {
    await db.exec("reset role");
    const newId = "00000000-0000-4000-8000-000000000004";
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [newId, { display_name: "Joana" }],
    );
    await asUser(newId);
    expect(
      (
        await db.query<{ display_name: string; role: string }>(
          "select display_name,role from profiles",
        )
      ).rows,
    ).toEqual([{ display_name: "Joana", role: "VENDEDOR" }]);
    expect((await db.query("select * from sales_goals")).rows).toHaveLength(1);
    const templates = (
      await db.query<{ message: string }>(
        "select message from message_templates",
      )
    ).rows;
    expect(templates).toHaveLength(11);
    expect(
      templates.every((t) =>
        t.message.includes("Me chamo {{usuario}}, da InovaLogix."),
      ),
    ).toBe(true);
    await expect(
      db.query("select add_sender_to_seed_templates($1)", [A]),
    ).rejects.toThrow();
  });
});

describe.sequential("Conclusão de ações", () => {
  let id: string;
  const first = "10000000-0000-4000-8000-000000000001";
  const second = "10000000-0000-4000-8000-000000000002";
  const call = (
    request = first,
    action = "Telefonar",
    at = "2026-09-20T12:00:00Z",
    date = "2026-09-20",
    next = "Enviar proposta",
    nextAt: string | null = "2026-09-28T12:00:00Z",
  ) =>
    db.query("select complete_pending_action($1,$2,$3,$4,$5,$6,$7)", [
      request,
      id,
      action,
      at,
      date,
      next,
      nextAt,
    ]);
  it("nega outro vendedor, valida datas e não grava parcialmente", async () => {
    await asUser(A);
    id = (
      await db.query<{ id: string }>(
        "insert into leads(company,next_action,next_action_at) values('Conclusão QA','Telefonar','2026-09-20T12:00:00Z') returning id",
      )
    ).rows[0].id;
    await asUser(B);
    await expect(call()).rejects.toThrow("Lead unavailable");
    await asUser(A);
    await expect(
      call(first, "Telefonar", "2026-09-20T12:00:00Z", "2999-01-01"),
    ).rejects.toThrow("Invalid completion date");
    await expect(
      call(
        first,
        "Telefonar",
        "2026-09-20T12:00:00Z",
        "2026-09-20",
        "Enviar",
        null,
      ),
    ).rejects.toThrow("Invalid next action");
    expect(
      (await db.query("select * from completed_actions where lead_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  });
  it("conclui, preserva histórico e agenda sucessora atomicamente", async () => {
    await call();
    const audit = (
      await db.query(
        "select action,completed_on::text,next_action from completed_actions where id=$1",
        [first],
      )
    ).rows[0];
    expect(audit).toEqual({
      action: "Telefonar",
      completed_on: "2026-09-20",
      next_action: "Enviar proposta",
    });
    const lead = (
      await db.query(
        "select next_action,first_contact_at,stage from leads where id=$1",
        [id],
      )
    ).rows[0];
    expect(lead).toMatchObject({
      next_action: "Enviar proposta",
      first_contact_at: null,
      stage: "NOVO LEAD",
    });
    await call();
    expect(
      (await db.query("select * from lead_interactions where lead_id=$1", [id]))
        .rows,
    ).toHaveLength(1);
    await expect(call(second)).rejects.toThrow("ACTION_CHANGED");
  });
  it("auditoria é imutável e isolada; administrador pode concluir sem sucessora", async () => {
    await expect(
      db.query("delete from completed_actions where id=$1", [first]),
    ).rejects.toThrow();
    await asUser(B);
    expect(
      (await db.query("select * from completed_actions where lead_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
    await asUser(ADMIN);
    await call(
      second,
      "Enviar proposta",
      "2026-09-28T12:00:00Z",
      "2026-09-20",
      "",
      null,
    );
    expect(
      (
        await db.query(
          "select next_action,next_action_at from leads where id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ next_action: "", next_action_at: null });
    expect(
      (await db.query("select * from completed_actions where lead_id=$1", [id]))
        .rows,
    ).toHaveLength(2);
  });
});
