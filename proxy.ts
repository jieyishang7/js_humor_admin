import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The only routes reachable without being a signed-in superadmin.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout", "/denied"];

/**
 * Runs before every route. Refreshes the Supabase session, then:
 * signed out -> /login, signed in but not profiles.is_superadmin -> /denied.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return new NextResponse("Admin area is not configured.", { status: 503 });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return response;

  const go = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) return go("/login");

  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle();
  if (!profile?.is_superadmin) return go("/denied");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
