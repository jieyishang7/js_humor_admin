import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  current_area: string | null;
  favorite_spot: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
};

/** READ users/profiles (read-only by design). */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { supabase } = await requireAdmin();

  const [{ data }, { data: votes }, { data: media }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name, current_area, favorite_spot, avatar_url, is_superadmin, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("caption_votes").select("user_id"),
    supabase.from("captions").select("author_id"),
  ]);

  const voteCount = new Map<string, number>();
  (votes ?? []).forEach((v) => voteCount.set(v.user_id, (voteCount.get(v.user_id) ?? 0) + 1));
  const mediaCount = new Map<string, number>();
  (media ?? []).forEach((m) => mediaCount.set(m.author_id, (mediaCount.get(m.author_id) ?? 0) + 1));

  const term = q.trim().toLowerCase();
  const rows = ((data ?? []) as Row[]).filter(
    (r) => !term || [r.email, r.first_name, r.last_name, r.current_area].some((v) => v?.toLowerCase().includes(term)),
  );

  return (
    <AdminShell active="/users" title="Users" subtitle={`${rows.length} profile${rows.length === 1 ? "" : "s"} · read-only`}>
      <form className="toolbar" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, email or area…" aria-label="Search users" />
        <button className="btn btn-dark" type="submit">Search</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Area</th>
              <th>Favorite spot</th>
              <th className="num">AI items</th>
              <th className="num">Votes</th>
              <th>Joined</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="user-cell">
                    <span className="avatar">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.avatar_url} alt="" />
                      ) : (
                        (r.first_name?.[0] ?? r.email?.[0] ?? "?").toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</strong>
                      <span>{r.email}</span>
                    </div>
                  </div>
                </td>
                <td>{r.current_area ?? <span className="muted">—</span>}</td>
                <td>{r.favorite_spot ?? <span className="muted">—</span>}</td>
                <td className="num">{mediaCount.get(r.id) ?? 0}</td>
                <td className="num">{voteCount.get(r.id) ?? 0}</td>
                <td>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td>{r.is_superadmin ? <span className="pill pill-dark">Superadmin</span> : <span className="pill">Member</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted pad">No users match.</p>}
      </div>
    </AdminShell>
  );
}
