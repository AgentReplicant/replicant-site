import { NextResponse } from "next/server";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
} = process.env;

const AIRTABLE_TABLE = process.env.AIRTABLE_GOOGLE_TABLE || "GoogleTokens";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`; // use absolute redirects

  try {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) return NextResponse.redirect(`${origin}/success?google=err`);
    if (!code) return NextResponse.redirect(`${origin}/success?google=missing_code`);

    // 1) Exchange code -> tokens
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID || "",
      client_secret: GOOGLE_CLIENT_SECRET || "",
      redirect_uri:
        GOOGLE_REDIRECT_URI ||
        `${origin}/api/google/oauth/callback`,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", tokenRes.status, tokenText);
      return NextResponse.redirect(`${origin}/success?google=token_fail`);
    }

    const tokens = JSON.parse(tokenText) as any;
    // tokens: { access_token, expires_in, scope, token_type, refresh_token?, id_token? }

    // 2) Store to Airtable (optional)
    if (AIRTABLE_TOKEN && AIRTABLE_BASE_ID) {
      try {
        await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
            AIRTABLE_TABLE
          )}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              records: [
                {
                  fields: {
                    AccessToken: tokens.access_token || "",
                    RefreshToken: tokens.refresh_token || "",
                    Scope: tokens.scope || "",
                    TokenType: tokens.token_type || "",
                    ExpiresIn: tokens.expires_in || "",
                    CreatedAt: new Date().toISOString(),
                  },
                },
              ],
            }),
          }
        );
      } catch (e) {
        console.error("Airtable save error:", e);
        // continue anyway
      }
    }

    // 3) Done → back to app
    return NextResponse.redirect(`${origin}/success?google=ok`);
  } catch (e: any) {
    console.error("OAuth callback error:", e?.stack || e);
    return NextResponse.redirect(`${origin}/success?google=err`);
  }
}
