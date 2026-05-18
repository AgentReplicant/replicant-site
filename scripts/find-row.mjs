const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const name = process.argv[2] || "Test Lead Phase3A";

const url = `https://api.airtable.com/v0/${baseId}/Leads?filterByFormula=${encodeURIComponent(`{Name}="${name}"`)}`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const json = await res.json();

console.log(JSON.stringify(json.records?.map((r) => ({
  id: r.id,
  createdTime: r.createdTime,
  name: r.fields.Name,
  source: r.fields.Source,
  status: r.fields.Status,
  displayedCreatedTime: r.fields["Created Time"],
})), null, 2));