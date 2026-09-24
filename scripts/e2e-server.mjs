// Test-only HTTP adapter. Not imported by the application or production build.
// Auth is intentionally simulated; PostgreSQL rules are the real migrations.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const id = "00000000-0000-4000-8000-000000000001";
const user = {
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "demo@inovalogix.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Tiago" },
  created_at: new Date().toISOString(),
};
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 86400, iat: Math.floor(Date.now() / 1000) })}.${Buffer.from("test-signature").toString("base64url")}`;
const session = {
  access_token: token,
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  user,
};
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;`,
);
for (const file of [
  "202609230001_crm.sql",
  "202609230002_analytics.sql",
  "202609240001_outreach.sql",
  "202609240002_user_names.sql",
])
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
await db.exec(
  `insert into auth.users(id) values('${id}');update profiles set role='ADMIN',display_name='Tiago' where id='${id}';select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
);
const products = (await db.query("select * from products order by name")).rows;
for (const [i, company] of [
  "Clínica Sorriso",
  "Topografia Horizonte",
  "Transportadora Atlas",
  "Espaço Bella",
  "Engenharia Norte",
  "Studio Forma",
  "Café Aurora",
  "Odonto Prime",
  "Solar Energia",
].entries()) {
  const l = (
    await db.query(
      `insert into leads(company,contact_name,niche,whatsapp,product_id,potential_value,next_action,next_action_at,is_demo) values($1,$2,$3,'11999998888',$4,$5,$6,now()+($7||' hours')::interval,true) returning id`,
      [
        company,
        ["Ana Oliveira", "Pedro Lima", "Carlos Santos"][i % 3],
        ["Saúde", "Serviços", "Logística"][i % 3],
        products[i % products.length].id,
        products[i % products.length].suggested_value || 540,
        ["Fazer follow-up", "Reunião de diagnóstico", "Retornar proposta"][
          i % 3
        ],
        String(i - 3),
      ],
    )
  ).rows[0];
  const stages = [
    "CONTATADO",
    "RESPONDEU",
    "SONDAGEM",
    "OPORTUNIDADE",
    "PROPOSTA",
    "NEGOCIAÇÃO",
    "FECHADO",
  ];
  for (let s = 0; s < Math.min(i, 7); s++)
    await db.query(
      `update leads set stage=$1,closed_value=1200,closed_on=current_date,payment_method='Pix' where id=$2`,
      [stages[s], l.id],
    );
}
const tables = [
  "profiles",
  "products",
  "objections",
  "sales_goals",
  "leads",
  "pipeline_history",
  "lead_interactions",
  "proposals",
  "after_sales",
  "message_templates",
  "lead_approaches",
];
const columns = {};
for (const table of tables)
  columns[table] = (
    await db.query(
      "select column_name from information_schema.columns where table_schema=$1 and table_name=$2",
      ["public", table],
    )
  ).rows.map((r) => r.column_name);
function column(table, key) {
  if (!columns[table].includes(key)) throw new Error("Invalid column");
  return '"' + key + '"';
}
async function rest(url, req, body) {
  const table = url.pathname.split("/").pop();
  if (url.pathname.includes("/rpc/")) {
    const rpc = {
      confirm_approach: [
        "p_id",
        "p_lead",
        "p_template",
        "p_message",
        "p_phone",
      ],
      schedule_approach_followup: [
        "p_lead",
        "p_at",
        "p_expected_action",
        "p_expected_at",
      ],
      set_template_default: ["p_id"],
    };
    if (rpc[table]) {
      const keys = rpc[table];
      return {
        data: (
          await db.query(
            "select " +
              table +
              "(" +
              keys.map((_, i) => "$" + (i + 1)).join(",") +
              ") data",
            keys.map((key) => body[key] ?? null),
          )
        ).rows[0].data,
      };
    }
    if (table !== "crm_metrics") throw new Error("Unknown RPC");
    return {
      data: (
        await db.query("select crm_metrics($1,$2,$3) data", [
          body.p_start,
          body.p_end,
          body.p_owner || null,
        ])
      ).rows[0].data,
    };
  }
  if (!tables.includes(table)) throw new Error("Invalid table");
  const args = [];
  const param = (value) => {
    args.push(value);
    return "$" + args.length;
  };
  const where = [];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "offset", "limit", "on_conflict"].includes(key))
      continue;
    if (key === "or") {
      const terms = value
        .slice(1, -1)
        .split(",")
        .map((term) => {
          const [field, op, ...rest] = term.split(".");
          if (op !== "ilike") throw new Error("Invalid OR");
          return `${column(table, field)} ilike ${param(rest.join("."))}`;
        });
      where.push(`(${terms.join(" or ")})`);
      continue;
    }
    const c = column(table, key);
    const [op, ...parts] = value.split(".");
    const v = parts.join(".");
    if (op === "not") {
      if (v === "is.null") where.push(`${c} is not null`);
      else if (v.startsWith("in."))
        where.push(
          `${c}::text not in (${v
            .slice(4, -1)
            .split(",")
            .map((x) => param(x.replaceAll('"', "")))
            .join(",")})`,
        );
      else throw new Error("Unsupported not");
    } else if (op === "is" && v === "null") where.push(`${c} is null`);
    else if (op === "in") {
      const values = v
        .slice(1, -1)
        .split(",")
        .map((x) => param(x.replaceAll('"', "")));
      where.push(`${c}::text in (${values.join(",")})`);
    } else {
      const ops = { eq: "=", gte: ">=", lte: "<=", lt: "<", ilike: "ilike" };
      if (!ops[op]) throw new Error("Unsupported operator");
      where.push(`${c} ${ops[op]} ${param(v)}`);
    }
  }
  const condition = where.length ? " where " + where.join(" and ") : "";
  if (req.method === "GET") {
    const total = Number(
      (await db.query(`select count(*) total from ${table}${condition}`, args))
        .rows[0].total,
    );
    let selected = url.searchParams.get("select") || "*";
    if (selected !== "*")
      selected = selected
        .split(",")
        .map((k) => column(table, k))
        .join(",");
    const order = (url.searchParams.get("order") || "")
      .split(",")
      .filter(Boolean)
      .map((v) => {
        const [key, dir, nulls] = v.split(".");
        return `${column(table, key)} ${dir === "desc" ? "desc" : "asc"} ${nulls === "nullslast" ? "nulls last" : ""}`;
      })
      .join(",");
    const limit = Math.min(1000, Number(url.searchParams.get("limit") || 1000));
    const offset = Number(url.searchParams.get("offset") || 0);
    const result = await db.query(
      `select ${selected} from ${table}${condition}${order ? " order by " + order : ""} limit ${param(limit)} offset ${param(offset)}`,
      args,
    );
    const single = String(req.headers.accept).includes("vnd.pgrst.object");
    return { data: single ? result.rows[0] || null : result.rows, total };
  }
  if (req.method === "DELETE") {
    await db.query(`delete from ${table}${condition}`, args);
    return { data: null };
  }
  if (req.method === "PATCH") {
    const fields = Object.keys(body);
    const set = fields
      .map((key) => `${column(table, key)}=${param(body[key])}`)
      .join(",");
    return {
      data: (
        await db.query(
          `update ${table} set ${set}${condition} returning *`,
          args,
        )
      ).rows[0],
    };
  }
  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    const inserted = [];
    for (const row of rows) {
      const keys = Object.keys(row);
      const values = keys.map((k) => row[k]);
      const cols = keys.map((k) => column(table, k));
      let conflict = "";
      if (String(req.headers.prefer).includes("resolution=merge-duplicates")) {
        const pk = table === "after_sales" ? "lead_id" : "id";
        conflict = ` on conflict (${pk}) do update set ${keys
          .filter((k) => k !== pk)
          .map((k) => `${column(table, k)}=excluded.${column(table, k)}`)
          .join(",")}`;
      }
      inserted.push(
        ...(
          await db.query(
            `insert into ${table}(${cols}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})${conflict} returning *`,
            values,
          )
        ).rows,
      );
    }
    return {
      data: String(req.headers.accept).includes("vnd.pgrst.object")
        ? inserted[0]
        : inserted,
    };
  }
  throw new Error("Unsupported method");
}
function normalize(value, key = "") {
  if (value instanceof Date)
    return ["inserted_on", "closed_on", "sent_on"].includes(key)
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  if (Array.isArray(value)) return value.map((v) => normalize(v));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalize(v, k)]),
    );
  if (
    value !== null &&
    [
      "potential_value",
      "suggested_value",
      "closed_value",
      "budget",
      "amount",
      "weekly_revenue",
      "monthly_revenue",
      "monthly_system_revenue",
    ].includes(key)
  )
    return Number(value);
  return value;
}
let queue = Promise.resolve();
const server = http.createServer((req, res) => {
  queue = queue
    .then(async () => {
      res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS",
      );
      res.setHeader("Access-Control-Expose-Headers", "Content-Range");
      res.setHeader("Content-Type", "application/json");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url, "http://127.0.0.1:54329");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      try {
        if (url.pathname === "/health") {
          res.end("{}");
          return;
        }
        if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") {
          if (req.headers.authorization !== "Bearer test-only-service-key") {
            res.writeHead(403);
            res.end("{}");
            return;
          }
          const newId = crypto.randomUUID();
          await db.exec("reset role");
          try {
            await db.query(
              "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
              [newId, body.user_metadata],
            );
          } finally {
            await db.exec("set role authenticated");
          }
          res.end(
            JSON.stringify({
              id: newId,
              email: body.email,
              user_metadata: body.user_metadata,
              aud: "authenticated",
              role: "authenticated",
              created_at: new Date().toISOString(),
            }),
          );
          return;
        }
        if (url.pathname === "/auth/v1/token") {
          if (body.password && body.password !== "Demo123!") {
            res.writeHead(400);
            res.end(JSON.stringify({ msg: "Invalid login credentials" }));
            return;
          }
          res.end(JSON.stringify(session));
          return;
        }
        if (url.pathname === "/auth/v1/user") {
          if (req.headers.authorization !== `Bearer ${token}`) {
            res.writeHead(401);
            res.end("{}");
            return;
          }
          res.end(JSON.stringify(user));
          return;
        }
        if (url.pathname === "/auth/v1/logout") {
          res.writeHead(204);
          res.end();
          return;
        }
        if (url.pathname.includes("jwks")) {
          res.end('{"keys":[]}');
          return;
        }
        if (req.headers.authorization !== `Bearer ${token}`) {
          res.writeHead(401);
          res.end("{}");
          return;
        }
        const result = await rest(url, req, body);
        if (result.total !== undefined)
          res.setHeader(
            "Content-Range",
            `0-${Math.max(0, (Array.isArray(result.data) ? result.data.length : 1) - 1)}/${result.total}`,
          );
        res.end(JSON.stringify(normalize(result.data)));
      } catch (error) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            message: error.message,
            code: error.code || "TEST_ERROR",
          }),
        );
      }
    })
    .catch((error) => {
      console.error(error);
      if (!res.writableEnded) {
        res.writeHead(500);
        res.end("{}");
      }
    });
});
await new Promise((resolve) => server.listen(54329, "127.0.0.1", resolve));
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
      E2E_BUILD_DIR: ".next-e2e",
    },
  },
);
async function stop() {
  next.kill();
  server.close();
  await db.close();
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", () => process.exit());
