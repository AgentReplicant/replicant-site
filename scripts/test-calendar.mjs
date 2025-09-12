import { google } from 'googleapis';

function getCreds() {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  const raw = process.env.GOOGLE_SA_JSON;
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  if (raw) return JSON.parse(raw);
  throw new Error('Missing GOOGLE_SA_JSON_B64 or GOOGLE_SA_JSON');
}

async function main() {
  const {
    GOOGLE_SA_IMPERSONATE: subject,
    GOOGLE_CALENDAR_ID = 'primary',
  } = process.env;

  const creds = getCreds();

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
    subject, // the Workspace user to impersonate, e.g. noreply@replicantapp.com
  });

  const calendar = google.calendar({ version: 'v3', auth });

  // 1) List next 5 events
  const list = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin: new Date().toISOString(),
    maxResults: 5,
    singleEvents: true,
    orderBy: 'startTime',
  });
  console.log('Next events:', list.data.items?.map(e => e.summary) ?? []);

  // 2) Optional: create a test event (add --create to CLI)
  if (process.argv.includes('--create')) {
    const start = new Date(Date.now() + 15 * 60 * 1000); // +15 min
    const end = new Date(Date.now() + 45 * 60 * 1000);   // +45 min
    const res = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: 'Service Account test — safe to delete',
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
      },
      sendUpdates: 'all',
    });
    console.log('Created event:', res.data.htmlLink);
  }
}

main().catch(err => {
  console.error(err?.response?.data || err);
  process.exit(1);
});
