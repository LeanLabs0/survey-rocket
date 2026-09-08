import { readFileSync } from "node:fs";
import postgres from "postgres";
import { customAlphabet } from "nanoid";

function loadEnv() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      process.env[k] = t.slice(i + 1).trim();
    }
  } catch {
    /* no .env file */
  }
}
loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const parsed = new URL(url);
if (!parsed.hostname.includes("supabase.co")) {
  console.error("DATABASE_URL host is not Supabase:", parsed.hostname);
  process.exit(1);
}
console.log(`Seeding ${parsed.hostname}:${parsed.port || "5432"} …`);

const sql = postgres({
  host: parsed.hostname,
  port: Number(parsed.port || 5432),
  database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
  username: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  ssl: "require",
  prepare: false,
  max: 1,
});
const publicId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

const seeds = [
  {
    slug: "client-outcomes",
    name: "Client outcomes",
    cadence: "90 day",
    status: "Active",
    settings: {
      require_contact: false,
      show_results: true,
      review_ask: true,
      review_links: { google: "https://g.page/r/lean-labs/review" },
    },
    questions: [
      { id: "service", type: "choice", q: "Which Lean Labs program are you on?", options: ["AEO program", "Website Launchpad", "Growth retainer", "Other"] },
      { id: "leads", type: "number", q: "About how many qualified leads per month does your site produce now?", min: 0, max: 10000 },
      { id: "pipeline", type: "choice", q: "Compared with before working with us, how has qualified pipeline changed?", options: ["Down", "Flat", "Up to 25% up", "26 to 75% up", "More than 75% up"] },
      { id: "changed", type: "text", optional: true, q: "What changed most since we started? One sentence is plenty. Optional, type skip to move on." },
      { id: "nps", type: "choice", nps: true, q: "How likely are you to recommend Lean Labs to a peer?", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
    ],
    provenance: { source: "template", drafted_by: null, approved_by: "Ralph", approved_at: "2026-09-01" },
  },
  {
    slug: "project-onboarding",
    name: "Project onboarding",
    cadence: "Day 30",
    status: "Active",
    settings: { require_contact: false, show_results: false, review_ask: false, review_links: {} },
    questions: [
      { id: "clarity", type: "choice", q: "How clear was the kickoff process?", options: ["Very unclear", "Unclear", "Neutral", "Clear", "Very clear"] },
      { id: "speed", type: "choice", q: "How was the pace of the first 30 days?", options: ["Too slow", "About right", "Too fast"] },
      { id: "wish", type: "text", optional: true, q: "Anything you wish you had known on day one? Optional, type skip to move on." },
    ],
    provenance: { source: "template", drafted_by: null, approved_by: "Ralph", approved_at: "2026-09-01" },
  },
];

const existing = await sql`select * from clients where slug = 'lean-labs' limit 1`;
let clientRow = existing[0];
if (!clientRow) {
  const inserted = await sql`
    insert into clients (slug, name, brand)
    values ('lean-labs', 'Lean Labs', ${sql.json({ color: "#00D492" })})
    returning *
  `;
  clientRow = inserted[0];
}

for (const s of seeds) {
  const definition = {
    schema_version: 1,
    id: s.slug,
    name: s.name,
    cadence: s.cadence,
    status: s.status,
    intro: null,
    outro: null,
    settings: s.settings,
    questions: s.questions,
    provenance: s.provenance,
  };
  const found = await sql`select * from surveys where client_id = ${clientRow.id} and slug = ${s.slug} limit 1`;
  let survey = found[0];
  if (!survey) {
    const inserted = await sql`
      insert into surveys (client_id, public_id, slug, name, cadence, status, settings, provenance, definition)
      values (
        ${clientRow.id}, ${publicId()}, ${s.slug}, ${s.name}, ${s.cadence}, ${s.status},
        ${sql.json(s.settings)}, ${sql.json(s.provenance)}, ${sql.json(definition)}
      )
      returning *
    `;
    survey = inserted[0];
  }
  const pubs = await sql`select id from survey_publications where survey_id = ${survey.id}`;
  if (!pubs.length) {
    await sql`
      insert into survey_publications (survey_id, version, definition)
      values (${survey.id}, 1, ${sql.json(definition)})
    `;
  }
}

console.log("Seeded lean-labs with sample surveys.");
await sql.end();
