import { AdminShell } from "@/components/AdminShell";
import { describeMedia, requireAdmin } from "@/lib/admin";
import { createMedia, deleteMedia, updateMedia } from "./actions";

export const dynamic = "force-dynamic";

type Media = {
  id: number;
  content: string;
  model: string | null;
  created_at: string;
  request_id: number | null;
  joke_id: number | null;
  upload_id: number | null;
};

function parse(content: string) {
  try {
    const s = JSON.parse(content);
    if (s && typeof s.name === "string") return s as { name: string; area?: string; why: string; price?: string };
  } catch {}
  return null;
}

function PlaceFields({ spot }: { spot?: { name?: string; area?: string; why?: string; price?: string } | null }) {
  return (
    <div className="form-grid">
      <label>
        Place name
        <input name="name" defaultValue={spot?.name ?? ""} maxLength={80} placeholder="Hungarian Pastry Shop" />
      </label>
      <label>
        Neighborhood
        <input name="area" defaultValue={spot?.area ?? ""} maxLength={60} placeholder="Morningside Heights" />
      </label>
      <label>
        Price
        <select name="price" defaultValue={spot?.price ?? ""}>
          <option value="">—</option>
          <option>Free</option>
          <option>$</option>
          <option>$$</option>
          <option>$$$</option>
        </select>
      </label>
      <label className="span-2">
        Why it fits
        <input name="why" defaultValue={spot?.why ?? ""} maxLength={220} placeholder="One sentence on why this matches the mood." />
      </label>
    </div>
  );
}

/** CREATE / READ / UPDATE / DELETE AI generated media. */
export default async function MediaPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const { ok, error, q = "" } = await searchParams;
  const { supabase } = await requireAdmin();

  const [{ data: media }, { data: requests }, { data: votes }] = await Promise.all([
    supabase.from("captions").select("id, content, model, created_at, request_id, joke_id, upload_id").order("created_at", { ascending: false }),
    supabase.from("spot_requests").select("id, mood").order("created_at", { ascending: false }),
    supabase.from("caption_votes").select("caption_id, value"),
  ]);

  const moodById = new Map((requests ?? []).map((r) => [r.id as number, r.mood as string]));
  const score = new Map<number, number>();
  (votes ?? []).forEach((v) => score.set(v.caption_id, (score.get(v.caption_id) ?? 0) + v.value));

  const term = q.trim().toLowerCase();
  const items = ((media ?? []) as Media[]).filter((m) => !term || m.content.toLowerCase().includes(term));

  return (
    <AdminShell active="/media" title="AI media" subtitle={`${items.length} item${items.length === 1 ? "" : "s"} · create, edit and delete`}>
      {ok && <p className="flash flash-ok">{ok}</p>}
      {error && <p className="flash flash-error">{error}</p>}

      <details className="card create">
        <summary>＋ Create new AI media item</summary>
        <form action={createMedia} className="stack">
          <label>
            For which mood?
            <select name="request_id" required defaultValue="">
              <option value="" disabled>
                Choose a mood…
              </option>
              {(requests ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  “{r.mood}”
                </option>
              ))}
            </select>
          </label>
          <PlaceFields />
          <button className="btn btn-dark" type="submit">Create item</button>
        </form>
      </details>

      <form className="toolbar" role="search">
        <input name="q" defaultValue={q} placeholder="Search AI media…" aria-label="Search AI media" />
        <button className="btn btn-dark" type="submit">Search</button>
      </form>

      <ul className="media-list">
        {items.map((m) => {
          const spot = parse(m.content);
          const shown = describeMedia(m.content);
          const kind = m.request_id ? "Place pick" : m.joke_id ? "Meme caption" : "Photo caption";
          return (
            <li key={m.id} className="card media-item">
              <div className="media-top">
                <div>
                  <p className="eyebrow">
                    {kind} · #{m.id} · {m.model ?? "unknown model"} · {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <h3>{shown.title}</h3>
                  {shown.detail && <p className="muted">{shown.detail}</p>}
                  {m.request_id && <p className="sub">Mood: “{moodById.get(m.request_id) ?? "—"}”</p>}
                </div>
                <span className="score" title="Vote score">♥ {score.get(m.id) ?? 0}</span>
              </div>

              <div className="media-actions">
                <details>
                  <summary className="btn btn-ghost">Edit</summary>
                  <form action={updateMedia} className="stack">
                    <input type="hidden" name="id" value={m.id} />
                    {spot ? (
                      <PlaceFields spot={spot} />
                    ) : (
                      <label>
                        Caption text
                        <textarea name="plain" defaultValue={m.content} maxLength={300} rows={2} />
                      </label>
                    )}
                    <button className="btn btn-dark" type="submit">Save changes</button>
                  </form>
                </details>
                <details>
                  <summary className="btn btn-ghost btn-danger-text">Delete</summary>
                  <form action={deleteMedia} className="confirm">
                    <input type="hidden" name="id" value={m.id} />
                    <span>Delete this item and its votes?</span>
                    <button className="btn btn-danger" type="submit">Yes, delete</button>
                  </form>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && <p className="muted">No AI media found.</p>}
    </AdminShell>
  );
}
