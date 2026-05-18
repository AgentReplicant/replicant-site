// scripts/dump-airtable-schema.mjs
const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!token || !baseId) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env vars");
  process.exit(1);
}

const res = await fetch(
  `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await res.json();

if (!res.ok) {
  console.error("Airtable error:", JSON.stringify(data, null, 2));
  process.exit(1);
}

for (const table of data.tables) {
  console.log(`\n=== TABLE: ${table.name} ===`);
  for (const field of table.fields) {
    const opts = field.options?.choices
      ? ` [${field.options.choices.map((c) => c.name).join(" | ")}]`
      : "";
    console.log(`  ${field.name} (${field.type})${opts}`);
  }
}