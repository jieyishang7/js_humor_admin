import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = { id: string; email: string | null; first_name: string | null; is_superadmin: boolean };

/**
 * Every admin page calls this first. Signed-out visitors go to /login;
 * signed-in users without profiles.is_superadmin = true go to /denied.
 * (proxy.ts runs the same check before any route renders.)
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, is_superadmin")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>();

  if (!profile?.is_superadmin) redirect("/denied");
  return { supabase, user: user as User, profile };
});

/** AI media rows store place recommendations as JSON; older ones are plain text. */
export function describeMedia(content: string): { title: string; detail: string } {
  try {
    const spot = JSON.parse(content);
    if (spot && typeof spot.name === "string") {
      return { title: spot.name, detail: [spot.area, spot.price, spot.why].filter(Boolean).join(" · ") };
    }
  } catch {
    // plain-text caption
  }
  return { title: content, detail: "" };
}
