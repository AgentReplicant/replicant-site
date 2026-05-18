// scripts/migrate-airtable-schema.mjs
//
// One-time schema migration for Phase 3A.
// Reads current Leads table, clears conflicting row values, renames + recreates fields,
// adds new ones, deprecates fossils.
//
// Idempotent: safe to re-run. Skips operations that are already done.
//
// Usage:
//   $env:AIRTABLE_TOKEN = "pat..."
//   $env:AIRTABLE_BASE_ID = "app..."
//   node scripts/migrate-airtable-schema.mjs --dry-run    # preview
//   node scripts/migrate-airtable-schema.mjs              # execute

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const dryRun = process.argv.includes("--dry-run");

if (!token || !baseId) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env vars");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

// ---------- Helpers ----------

async function getTables() {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    { headers }
  );
  if (!res.ok) {
    console.error("Failed to read schema:", await res.text());
    process.exit(1);
  }
  return (await res.json()).tables;
}

async function patchField(tableId, fieldId, body, label) {
  if (dryRun) {
    console.log(`  [dry-run] PATCH ${label}: ${JSON.stringify(body)}`);
    return true;
  }
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
    { method: "PATCH", headers, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const errBody = await res.text();
    console.error(`  ERROR patching ${label}:`);
    console.error(`    status: ${res.status}`);
    console.error(`    request body: ${JSON.stringify(body)}`);
    console.error(`    response: ${errBody}`);
    return false;
  }
  console.log(`  ok patched ${label}`);
  return true;
}

async function createField(tableId, body, label) {
  if (dryRun) {
    console.log(`  [dry-run] CREATE ${label}: ${JSON.stringify(body)}`);
    return true;
  }
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
    { method: "POST", headers, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    console.error(`  ERROR creating ${label}:`, await res.text());
    return false;
  }
  console.log(`  ok created ${label}`);
  return true;
}

async function listAllRecords(tableId, fieldName) {
  // Paginate through all records, returning only the fields we care about.
  let offset;
  const out = [];
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    params.append("fields[]", fieldName);
    if (offset) params.set("offset", offset);
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`,
      { headers }
    );
    if (!res.ok) {
      console.error(`  ERROR listing records:`, await res.text());
      return out;
    }
    const json = await res.json();
    out.push(...(json.records || []));
    offset = json.offset;
  } while (offset);
  return out;
}

async function clearFieldValues(tableId, fieldName, recordIds) {
  // PATCH records in batches of 10 (Airtable's batch limit).
  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10).map((id) => ({
      id,
      fields: { [fieldName]: null },
    }));
    if (dryRun) {
      console.log(`  [dry-run] CLEAR ${batch.length} records on "${fieldName}"`);
      continue;
    }
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ records: batch }),
      }
    );
    if (!res.ok) {
      console.error(`  ERROR clearing batch on "${fieldName}":`, await res.text());
      return false;
    }
  }
  return true;
}

function findField(table, name) {
  return table.fields.find((f) => f.name === name);
}

// ---------- Migration plan ----------

const RENAMES = [
  { from: "Company", to: "Business Name" },
  { from: "Website", to: "Current Website URL" },
  { from: "Vertical", to: "Business Category" },
  { from: "BudgetBand", to: "Budget Range" },
  { from: "Timeline", to: "Desired Timeline" },
];

const DEPRECATE = [
  "UseCase",
  "ChannelsWanted",
  "MeetingType",
  "AIOpenness",
  "InterestLevel",
  "PersonaSeen",
  "VolumeWeekly",
  "OnboardingJSON",
];

// Single-select value replacements. The key is the field name AS IT WILL BE NAMED AFTER RENAMES.
// During cleanup, we look up the field by old name OR new name.
const SELECT_VALUE_REPLACEMENTS = {
  "Business Category": {
    aliases: ["Business Category", "Vertical"],
    values: [
      "Beauty & Grooming",
      "Wellness & Aesthetics",
      "Home & Trade Services",
      "Other",
    ],
  },
  "Status": {
    aliases: ["Status"],
    values: [
      "New Lead",
      "Qualified",
      "Needs Follow-Up",
      "Audit Requested",
      "Audit Sent",
      "Call Requested",
      "Proposal Sent",
      "Won",
      "Lost",
      "Beta Client",
      "Website In Progress",
      "Website Delivered",
      "Assistant Upsell Offered",
      "Disqualified",
    ],
  },
  "Budget Range": {
    aliases: ["Budget Range", "BudgetBand"],
    values: ["Under $500", "$500–$1,000", "$1,000–$2,500", "$2,500+"],
  },
  "Desired Timeline": {
    aliases: ["Desired Timeline", "Timeline"],
    values: ["ASAP", "1–2 weeks", "This month", "Just exploring"],
  },
};

const SOURCE_ADDITIONS = ["Website Audit", "Get Started"];

const NEW_FIELDS = [
  { name: "Social Link", type: "url" },
  {
    name: "Booking Platform",
    type: "singleSelect",
    options: {
      choices: ["Booksy", "Square", "Calendly", "Acuity", "Fresha", "Other", "None"].map((n) => ({ name: n })),
    },
  },
  {
    name: "Main Goal",
    type: "singleSelect",
    options: {
      choices: ["More bookings", "More calls", "More quote requests", "More consultations", "Better online presence"].map((n) => ({ name: n })),
    },
  },
  { name: "Main Problem", type: "singleLineText" },
  {
    name: "Interest Type",
    type: "singleSelect",
    options: {
      choices: ["Website", "Assistant", "Both", "General"].map((n) => ({ name: n })),
    },
  },
  {
    name: "Recommended Package",
    type: "singleSelect",
    options: {
      choices: ["Starter Website", "Booking / Quote Website", "Website + Replicant Assistant", "Not Sure Yet"].map((n) => ({ name: n })),
    },
  },
];

// ---------- Run ----------

const tables = await getTables();
const leads = tables.find((t) => t.name === "Leads");

if (!leads) {
  console.error("Could not find Leads table");
  process.exit(1);
}

console.log(`\n${dryRun ? "[DRY RUN] " : ""}Migrating Leads table (${leads.id})\n`);

// ===== STAGE 1: Clear conflicting row values =====
// Done BEFORE renames so we operate against the current schema's field names.
console.log("--- Stage 1: Clear conflicting row values ---");

for (const [_targetName, plan] of Object.entries(SELECT_VALUE_REPLACEMENTS)) {
  // Find the field under any of its known aliases (old or new name)
  let field;
  let resolvedName;
  for (const alias of plan.aliases) {
    field = findField(leads, alias);
    if (field) {
      resolvedName = alias;
      break;
    }
  }
  if (!field) {
    console.log(`  - skipped (no field found for aliases: ${plan.aliases.join(", ")})`);
    continue;
  }

  const allowed = new Set(plan.values);
  const records = await listAllRecords(leads.id, resolvedName);
  const toClean = records.filter((r) => {
    const v = r.fields?.[resolvedName];
    return v != null && v !== "" && !allowed.has(v);
  });

  if (toClean.length === 0) {
    console.log(`  ok no cleanup needed on "${resolvedName}" (${records.length} rows scanned)`);
    continue;
  }

  console.log(`  cleaning ${toClean.length} of ${records.length} rows on "${resolvedName}"`);
  if (dryRun) {
    const summary = {};
    for (const r of toClean) {
      const v = r.fields[resolvedName];
      summary[v] = (summary[v] || 0) + 1;
    }
    for (const [val, count] of Object.entries(summary)) {
      console.log(`    [dry-run] would clear value "${val}" on ${count} row(s)`);
    }
  } else {
    await clearFieldValues(leads.id, resolvedName, toClean.map((r) => r.id));
    console.log(`  ok cleared ${toClean.length} row(s) on "${resolvedName}"`);
  }
}

// ===== STAGE 2: Renames =====
console.log("\n--- Stage 2: Renames ---");
for (const { from, to } of RENAMES) {
  const field = findField(leads, from);
  if (!field) {
    if (findField(leads, to)) {
      console.log(`  ok already renamed: ${from} -> ${to}`);
    } else {
      console.log(`  warn field "${from}" not found, skipping`);
    }
    continue;
  }
  await patchField(leads.id, field.id, { name: to }, `${from} -> ${to}`);
}

// ===== STAGE 3: Deprecate fossils =====
// Airtable Meta API has no DELETE for fields. We rename to zz_deprecated_* so they sort
// to the bottom of the column list and are clearly out-of-use. Manual delete in Airtable
// UI when ready.
console.log("\n--- Stage 3: Deprecate fossils (renamed to zz_deprecated_*) ---");
for (const fossil of DEPRECATE) {
  const field = findField(leads, fossil);
  if (!field) {
    const alreadyMarked = findField(leads, `zz_deprecated_${fossil}`);
    console.log(`  ok already gone or deprecated: ${fossil}${alreadyMarked ? " (zz_deprecated_*)" : ""}`);
    continue;
  }
  await patchField(leads.id, field.id, { name: `zz_deprecated_${fossil}` }, `${fossil} -> zz_deprecated_${fossil}`);
}

// ===== STAGE 4: Replace single-select option values =====
// Re-read the table since field names changed in Stages 2-3.
console.log("\n--- Stage 4: Replace single-select option values ---");
const tablesAfterRename = dryRun ? tables : await getTables();
const leadsAfterRename = tablesAfterRename.find((t) => t.name === "Leads");

for (const [targetName, plan] of Object.entries(SELECT_VALUE_REPLACEMENTS)) {
  const field = findField(leadsAfterRename, targetName);
  if (!field) {
    console.log(`  warn "${targetName}" not found after renames, skipping`);
    continue;
  }
  await patchField(
    leads.id,
    field.id,
    { options: { choices: plan.values.map((n) => ({ name: n })) } },
    `${targetName} values`
  );
}

// ===== STAGE 5: Add new Source values (merge, do not replace) =====
console.log("\n--- Stage 5: Add new Source values ---");
const sourceField = findField(leadsAfterRename, "Source");
if (sourceField) {
  const existingNames = new Set(sourceField.options.choices.map((c) => c.name));
  const toAdd = SOURCE_ADDITIONS.filter((n) => !existingNames.has(n));
  if (toAdd.length === 0) {
    console.log(`  ok all Source values already present`);
  } else {
    const merged = [
      ...sourceField.options.choices.map((c) => ({ name: c.name })),
      ...toAdd.map((n) => ({ name: n })),
    ];
    await patchField(
      leads.id,
      sourceField.id,
      { options: { choices: merged } },
      `Source += [${toAdd.join(", ")}]`
    );
  }
} else {
  console.log(`  warn Source field not found`);
}

// ===== STAGE 6: Create new fields =====
console.log("\n--- Stage 6: Create new fields ---");
for (const fieldDef of NEW_FIELDS) {
  const existing = findField(leadsAfterRename, fieldDef.name);
  if (existing) {
    console.log(`  ok already exists: ${fieldDef.name}`);
    continue;
  }
  await createField(leads.id, fieldDef, fieldDef.name);
}

console.log(`\n${dryRun ? "[DRY RUN] " : ""}Migration complete.\n`);
console.log("Next steps:");
console.log("  1. Verify the schema with: node scripts/dump-airtable-schema.mjs");
console.log("  2. Manually delete the zz_deprecated_* columns in Airtable UI when ready");
console.log("     (Airtable's API doesn't support field deletion)");
console.log("  3. Apply the Phase 3A code patch for /api/lead and AuditForm");