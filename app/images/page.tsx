import { AdminShell } from "@/components/AdminShell";
import { ImageForm } from "@/components/ImageForm";
import { requireAdmin } from "@/lib/admin";
import { deleteImage } from "./actions";

export const dynamic = "force-dynamic";

/** CREATE / READ / UPDATE / DELETE images, plus a read-only view of profile photos. */
export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase, user } = await requireAdmin();

  const [{ data: uploads }, { data: people }, { data: spotPics }] = await Promise.all([
    supabase.from("uploads").select("id, image_url, description, owner_id, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, first_name, last_name, email, avatar_url"),
    supabase
      .from("spot_images")
      .select("id, image_url, model, prompt, profile_id, created_datetime_utc, captions(content, request_id)")
      .order("created_datetime_utc", { ascending: false })
      .limit(60),
  ]);
  const owner = new Map((people ?? []).map((p) => [p.id, p]));
  const avatars = (people ?? []).filter((p) => p.avatar_url);

  return (
    <AdminShell active="/images" title="Images" subtitle="Browse, upload, edit and delete user-uploaded images. Profile photos are shown below (read-only).">
      {ok && <p className="flash flash-ok">{ok}</p>}
      {error && <p className="flash flash-error">{error}</p>}

      <details className="card create" open={!uploads?.length}>
        <summary>＋ Upload image</summary>
        <ImageForm adminId={user.id} />
      </details>

      <ul className="image-grid">
        {(uploads ?? []).map((img) => {
          const p = owner.get(img.owner_id);
          return (
            <li key={img.id} className="card image-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt={img.description ?? `Upload #${img.id}`} />
              <p className="small"><strong>#{img.id}</strong> {img.description ?? <span className="muted">No description</span>}</p>
              <p className="muted small">
                {p?.first_name ?? p?.email ?? "Unknown"} · {new Date(img.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <div className="row-actions">
                <details>
                  <summary className="btn btn-ghost btn-sm">Edit</summary>
                  <ImageForm adminId={user.id} imageId={img.id} initialDescription={img.description ?? ""} />
                </details>
                <details>
                  <summary className="btn btn-ghost btn-sm btn-danger-text">Delete</summary>
                  <form action={deleteImage} className="confirm">
                    <input type="hidden" name="id" value={img.id} />
                    <span>Delete image?</span>
                    <button className="btn btn-danger" type="submit">Yes</button>
                  </form>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
      {(uploads ?? []).length === 0 && <p className="muted">No uploaded images yet.</p>}

      <h2 className="section-h">Food photos</h2>
      <p className="muted small">Photos of the signature dish the AI picked for each recommended place (from Wikipedia / Wikimedia Commons). Read-only.</p>
      <ul className="image-grid">
        {(spotPics ?? []).map((pic) => {
          const p = owner.get(pic.profile_id);
          const cap = (Array.isArray(pic.captions) ? pic.captions[0] : pic.captions) as { content: string; request_id: number | null } | null;
          let name = "Spot";
          try {
            name = (JSON.parse(cap?.content ?? "{}") as { name?: string }).name ?? "Spot";
          } catch {
            name = "Spot";
          }
          return (
            <li key={pic.id} className="card image-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic.image_url} alt={pic.prompt ?? `Photo of ${name}`} />
              <p className="small">
                <strong>{name}</strong>
                {cap?.request_id ? (
                  <>
                    {" "}
                    · <a className="link" href={`/requests/${cap.request_id}`}>request #{cap.request_id}</a>
                  </>
                ) : null}
              </p>
              <p className="muted small">
                {p?.first_name ?? p?.email ?? "Unknown"} · {pic.model ?? "unknown model"} ·{" "}
                {new Date(pic.created_datetime_utc).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              {pic.prompt && (
                <details className="small">
                  <summary>Label</summary>
                  <p>{pic.prompt}</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {(spotPics ?? []).length === 0 && <p className="muted">No food photos yet.</p>}

      <h2 className="section-h">Profile photos</h2>
      <ul className="avatar-grid">
        {avatars.map((p) => (
          <li key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatar_url!} alt={`${p.first_name ?? p.email}'s profile photo`} />
            <span className="small">{[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email}</span>
          </li>
        ))}
      </ul>
      {avatars.length === 0 && <p className="muted">No profile photos yet.</p>}
    </AdminShell>
  );
}
