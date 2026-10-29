import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** READ generation requests (each mood a member asked the AI about). */
export default async function RequestsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: requests }, { data: people }, { data: media }, { data: responses }] = await Promise.all([
    supabase.from("spot_requests").select("id, mood, author_id, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, first_name, last_name, email"),
    supabase.from("captions").select("request_id").not("request_id", "is", null),
    supabase.from("llm_responses").select("spot_request_id, processing_time_seconds"),
  ]);

  const person = new Map((people ?? []).map((p) => [p.id, p]));
  const picks = new Map<number, number>();
  (media ?? []).forEach((m) => picks.set(m.request_id, (picks.get(m.request_id) ?? 0) + 1));
  const calls = new Map<number, { n: number; secs: number }>();
  (responses ?? []).forEach((r) => {
    if (!r.spot_request_id) return;
    const c = calls.get(r.spot_request_id) ?? { n: 0, secs: 0 };
    c.n += 1;
    c.secs += Number(r.processing_time_seconds ?? 0);
    calls.set(r.spot_request_id, c);
  });

  const rows = requests ?? [];

  return (
    <AdminShell active="/requests" title="Generation Requests" subtitle={`${rows.length} moods members asked the AI about · read-only`}>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Mood</th>
              <th>User</th>
              <th className="num">AI picks</th>
              <th className="num">LLM calls</th>
              <th className="num">Total secs</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = person.get(r.author_id);
              const c = calls.get(r.id);
              return (
                <tr key={r.id}>
                  <td><Link className="link" href={`/requests/${r.id}`}>#{r.id}</Link></td>
                  <td><Link className="link" href={`/requests/${r.id}`}>“{r.mood}”</Link></td>
                  <td>{[p?.first_name, p?.last_name].filter(Boolean).join(" ") || p?.email || "—"}</td>
                  <td className="num">{picks.get(r.id) ?? 0}</td>
                  <td className="num">{c?.n ?? 0}</td>
                  <td className="num">{c && c.secs ? c.secs.toFixed(1) : "—"}</td>
                  <td className="nowrap">{new Date(r.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted pad">No requests yet.</p>}
      </div>
    </AdminShell>
  );
}
