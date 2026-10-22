import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google -> Supabase -> here with a short-lived code; swap it for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing sign-in code.")}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in failed. Please try again.")}`);

  // proxy.ts decides whether this user may see the dashboard.
  return NextResponse.redirect(`${origin}/`);
}
