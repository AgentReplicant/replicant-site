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
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) return NextResponse.redirect("/success?google=err");
    if (!code) return NextResponse.redirect("/success?google=missing_code");

    // 1) Exchange code -> tokens
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID || "",
      client_secret: GOOGLE_CLIENT_SECRET || "",
      redirect_uri:
        GOOGLE_REDIRECT_URI ||
        "https://replicant-site.vercel.app/api/google/oauth/callback",
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error("Google token exchange failed:", t);
      return NextResponse.redirect("/success?google=token_fail");
    }

    const tokens = await tokenRes.json() as any;
    // tokens = { access_token, expires_in, scope, token_type, refresh_token?, id_token? }

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
        // Continue anyway — user is connected
      }
    }

    // 3) Send user back to the app
    return NextResponse.redirect("/success?google=ok");
  } catch (e) {
    console.error("OAuth callback error:", e);
    return NextResponse.redirect("/success?google=err");
  }
}
