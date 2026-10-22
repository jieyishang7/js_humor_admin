import { AdminShell } from "@/components/AdminShell";
import { describeMedia, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** READ upvotes/downvotes (read-only by design). */
export default async function VotesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "all" } = await searchParams;
  const { supabase } = await requireAdmin();

  const [{ data: votes }, { data: media }, { data: people }] = await Promise.all([
    supabase.from("caption_votes").select("caption_id, user_id, value"),
    supabase.from("captions").select("id, content"),
    supabase.from("profiles").select("id, email, first_name"),
  ]);

  const mediaById = new Map((media ?? []).map((m) => [m.id as number, m.content as string]));
  const personById = new Map((people ?? []).map((p) => [p.id as string, p]));

  const all = votes ?? [];
  const rows = all.filter((v) => (kind === "up" ? v.value > 0 : kind === "down" ? v.value < 0 : true));
  const up = all.filter((v) => v.value > 0).length;

  return (
    <AdminShell active="/votes" title="Votes" subtitle={`${all.length} total · ♥ ${up} up · ▼ ${all.length - up} down · read-only`}>
      <nav className="tabs" aria-label="Filter votes">
        {[
          ["all", "All"],
          ["up", "♥ Upvotes"],
          ["down", "▼ Downvotes"],
        ].map(([key, label]) => (
          <a key={key} href={`/votes?kind=${key}`} className="tab" data-active={kind === key}>
            {label}
          </a>
        ))}
      </nav>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vote</th>
              <th>AI media</th>
              <th>Voter</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const item = describeMedia(mediaById.get(v.caption_id) ?? `#${v.caption_id} (deleted)`);
              const who = personById.get(v.user_id);
              return (
                <tr key={`${v.caption_id}-${v.user_id}`}>
                  <td>{v.value > 0 ? <span className="pill pill-up">♥ Up</span> : <span className="pill pill-down">▼ Down</span>}</td>
                  <td>
                    <strong>{item.title}</strong>
                    {item.detail && <span className="sub">{item.detail}</span>}
                  </td>
                  <td>{who?.first_name ? `${who.first_name} · ${who.email}` : who?.email ?? v.user_id.slice(0, 8)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted pad">No votes here yet.</p>}
      </div>
    </AdminShell>
  );
}
