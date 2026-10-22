import { AdminShell } from "@/components/AdminShell";
import { describeMedia, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type Caption = { id: number; content: string; created_at: string; model: string | null; request_id: number | null; joke_id: number | null; upload_id: number | null };
type Vote = { caption_id: number; value: number; user_id: string };

const PALETTE = ["#7c3aed", "#a855f7", "#c084fc", "#6366f1", "#ec4899", "#d8b4fe"];

function Donut({ rows, center, caption }: { rows: { label: string; value: number }[]; center: string; caption: string }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (total === 0) return <p className="muted">No data yet.</p>;
  const stops = rows
    .map((r, i) => {
      const before = rows.slice(0, i).reduce((sum, x) => sum + x.value, 0);
      const from = (before / total) * 360;
      const to = ((before + r.value) / total) * 360;
      return `${PALETTE[i % PALETTE.length]} ${from}deg ${to}deg`;
    })
    .join(", ");
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label={caption}>
        <div className="donut-hole">
          <strong>{center}</strong>
          <span>{caption}</span>
        </div>
      </div>
      <ul className="legend">
        {rows.map((r, i) => (
          <li key={r.label}>
            <span className="swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="legend-label">{r.label}</span>
            <strong>{Math.round((r.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({ rows, unit }: { rows: { label: string; value: number; hint?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted">No data yet.</p>;
  return (
    <ul className="bars">
      {rows.map((row, i) => (
        <li key={row.label}>
          <div className="bar-label">
            <span title={row.label}>{row.label}</span>
            <strong>
              {row.value} <small>{unit}</small>
            </strong>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(row.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
          </div>
          {row.hint && <p className="bar-hint">{row.hint}</p>}
        </li>
      ))}
    </ul>
  );
}

export default async function Overview() {
  const { supabase } = await requireAdmin();

  const [profiles, captions, votes, requests, saved] = await Promise.all([
    supabase.from("profiles").select("id, current_area, created_at, is_superadmin"),
    supabase.from("captions").select("id, content, created_at, model, request_id, joke_id, upload_id"),
    supabase.from("caption_votes").select("caption_id, value, user_id"),
    supabase.from("spot_requests").select("id, mood, created_at"),
    supabase.from("saved_spots").select("caption_id"),
  ]);

  const people = profiles.data ?? [];
  const media = (captions.data ?? []) as Caption[];
  const allVotes = (votes.data ?? []) as Vote[];
  const moods = requests.data ?? [];
  const plans = saved.data ?? [];

  const likes = allVotes.filter((v) => v.value > 0).length;
  const downs = allVotes.filter((v) => v.value < 0).length;
  const voters = new Set(allVotes.map((v) => v.user_id)).size;

  // Score per AI item
  const score = new Map<number, number>();
  allVotes.forEach((v) => score.set(v.caption_id, (score.get(v.caption_id) ?? 0) + v.value));
  const topLoved = [...media]
    .map((m) => ({ m, s: score.get(m.id) ?? 0 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(({ m, s }) => ({ label: describeMedia(m.content).title, value: s, hint: describeMedia(m.content).detail.slice(0, 90) }));

  // Most saved to plans
  const saves = new Map<number, number>();
  plans.forEach((p) => saves.set(p.caption_id, (saves.get(p.caption_id) ?? 0) + 1));
  const topSaved = [...saves.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ label: describeMedia(media.find((m) => m.id === id)?.content ?? `#${id}`).title, value: n }));

  // Where members are
  const areas = new Map<string, number>();
  people.forEach((p) => {
    const a = p.current_area || "Not set";
    areas.set(a, (areas.get(a) ?? 0) + 1);
  });
  const areaRows = [...areas.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  // AI output, last 14 days
  const days = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    return d;
  });
  const perDay = days.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const n = media.filter((m) => {
      const t = new Date(m.created_at);
      return t >= d && t < next;
    }).length;
    return { d, n };
  });
  const dayMax = Math.max(1, ...perDay.map((x) => x.n));

  // Kind of media + engagement rate
  const kinds = [
    { label: "Place picks", value: media.filter((m) => m.request_id).length },
    { label: "Meme captions", value: media.filter((m) => m.joke_id).length },
    { label: "Photo captions", value: media.filter((m) => m.upload_id).length },
  ].filter((k) => k.value > 0);
  const engaged = media.filter((m) => score.has(m.id)).length;
  const engagement = media.length ? Math.round((engaged / media.length) * 100) : 0;

  const latestMood = [...moods].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  return (
    <AdminShell active="/" title="Overview" subtitle="How students are using Spot Finder NYC, live from Supabase.">
      <section className="kpis">
        <div className="kpi">
          <span>Members</span>
          <strong>{people.length}</strong>
          <small>{people.filter((p) => p.is_superadmin).length} admin</small>
        </div>
        <div className="kpi">
          <span>AI media items</span>
          <strong>{media.length}</strong>
          <small>{moods.length} moods asked</small>
        </div>
        <div className="kpi">
          <span>Votes</span>
          <strong>{allVotes.length}</strong>
          <small>
            ♥ {likes} · ▼ {downs} · {voters} voters
          </small>
        </div>
        <div className="kpi kpi-accent">
          <span>Engagement</span>
          <strong>{engagement}%</strong>
          <small>of AI items got at least one vote</small>
        </div>
      </section>

      <section className="grid-2">
        <article className="card">
          <h2>AI output · last 14 days</h2>
          <div className="spark" role="img" aria-label="AI items generated per day over the last 14 days">
            {perDay.map(({ d, n }) => (
              <div key={d.toISOString()} className="spark-col" title={`${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${n}`}>
                <span className="spark-n">{n || ""}</span>
                <div className="spark-bar" style={{ height: `${(n / dayMax) * 100}%` }} />
                <span className="spark-d">{d.getDate()}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>Most-loved AI picks</h2>
          <Bars rows={topLoved} unit="score" />
        </article>
        <article className="card">
          <h2>Where members are based</h2>
          <Donut rows={areaRows} center={String(people.length)} caption="members" />
        </article>
        <article className="card">
          <h2>Most saved to plans</h2>
          <Bars rows={topSaved} unit="saves" />
        </article>
        <article className="card">
          <h2>What the AI has made</h2>
          <Donut rows={kinds} center={String(media.length)} caption="AI items" />
        </article>
        <article className="card">
          <h2>How people vote</h2>
          <Donut
            rows={[
              { label: "♥ Upvotes", value: likes },
              { label: "▼ Downvotes", value: downs },
            ].filter((r) => r.value > 0)}
            center={String(allVotes.length)}
            caption="votes"
          />
        </article>
        <article className="card card-quote">
          <h2>Latest mood</h2>
          {latestMood ? (
            <>
              <blockquote>“{latestMood.mood}”</blockquote>
              <p className="muted">{new Date(latestMood.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
            </>
          ) : (
            <p className="muted">No moods yet.</p>
          )}
        </article>
      </section>
    </AdminShell>
  );
}
