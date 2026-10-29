import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { describeMedia, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const fmt = (v: string) => new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** One generation request: who asked, the chain that ran, every LLM response, and the AI media it produced. */
export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) notFound();
  const { supabase } = await requireAdmin();

  const { data: request } = await supabase.from("spot_requests").select("id, mood, author_id, created_at").eq("id", requestId).maybeSingle();
  if (!request) notFound();

  const [{ data: person }, { data: runs }, { data: responses }, { data: media }, { data: chains }, { data: votes }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, email, current_area").eq("id", request.author_id).maybeSingle(),
    supabase.from("llm_prompt_chains").select("id, prompt_chain_id, created_datetime_utc").eq("spot_request_id", requestId),
    supabase
      .from("llm_responses")
      .select("id, created_datetime_utc, provider_model_id, prompt_chain_id, llm_prompt_chain_id, temperature, system_prompt, user_prompt, response, processing_time_seconds, succeeded, llm_models(name)")
      .eq("spot_request_id", requestId)
      .order("created_datetime_utc"),
    supabase.from("captions").select("id, content, model, created_at").eq("request_id", requestId).order("created_at"),
    supabase.from("prompt_chains").select("id, slug"),
    supabase.from("caption_votes").select("caption_id, value"),
  ]);

  const slug = (cid: number | null) => chains?.find((c) => c.id === cid)?.slug ?? "—";
  const score = new Map<number, number>();
  (votes ?? []).forEach((v) => score.set(v.caption_id, (score.get(v.caption_id) ?? 0) + v.value));
  const allResponses = (responses ?? []) as unknown as {
    id: string;
    created_datetime_utc: string;
    provider_model_id: string | null;
    prompt_chain_id: number | null;
    llm_prompt_chain_id: number | null;
    temperature: number | null;
    system_prompt: string | null;
    user_prompt: string | null;
    response: string | null;
    processing_time_seconds: number | null;
    succeeded: boolean;
    llm_models: { name: string } | null;
  }[];

  return (
    <AdminShell active="/requests" title={`Generation Request #${request.id}`} subtitle={`“${request.mood}”`}>
      <p><Link href="/requests" className="link">← All requests</Link></p>

      <div className="detail-grid">
        <section className="card">
          <h2>Request details</h2>
          <dl className="kv">
            <dt>Request ID</dt><dd>{request.id}</dd>
            <dt>Mood</dt><dd>“{request.mood}”</dd>
            <dt>User</dt><dd>{[person?.first_name, person?.last_name].filter(Boolean).join(" ") || "—"}</dd>
            <dt>Email</dt><dd>{person?.email ?? "—"}</dd>
            <dt>Area</dt><dd>{person?.current_area ?? "—"}</dd>
            <dt>Profile ID</dt><dd className="mono">{request.author_id}</dd>
            <dt>Created</dt><dd>{fmt(request.created_at)}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Generated output</h2>
          <div className="mini-kpis">
            <div><span>AI picks</span><strong>{media?.length ?? 0}</strong></div>
            <div><span>LLM responses</span><strong>{allResponses.length}</strong></div>
            <div><span>Chain runs</span><strong>{runs?.length ?? 0}</strong></div>
          </div>
          {(runs ?? []).map((r) => (
            <p key={r.id} className="muted small">Prompt chain run #{r.id} · {slug(r.prompt_chain_id)} · {fmt(r.created_datetime_utc)}</p>
          ))}
        </section>
      </div>

      <section className="card">
        <h2>AI media from this request</h2>
        <ul className="media-mini">
          {(media ?? []).map((m) => {
            const d = describeMedia(m.content);
            return (
              <li key={m.id}>
                <strong>{d.title}</strong> <span className="score">♥ {score.get(m.id) ?? 0}</span>
                {d.detail && <p className="muted small">{d.detail}</p>}
              </li>
            );
          })}
        </ul>
        {(media ?? []).length === 0 && <p className="muted">No AI media.</p>}
      </section>

      <section>
        <h2 className="section-h">LLM responses</h2>
        <div className="response-list">
          {allResponses.map((r) => (
            <article key={r.id} className="card response-card">
              <div className="response-head">
                <strong>{r.llm_models?.name ?? r.provider_model_id ?? "Unknown model"}</strong>
                <span className={`pill ${r.succeeded ? "pill-up" : "pill-down"}`}>{r.succeeded ? "ok" : "failed"}</span>
              </div>
              <p className="muted small">
                Response ID {r.id.slice(0, 8)}… · {fmt(r.created_datetime_utc)} · Chain: {slug(r.prompt_chain_id)} · Temp: {r.temperature ?? "—"} · {r.processing_time_seconds ?? "—"}s
              </p>
              {r.system_prompt && (<><h4>System prompt</h4><p className="prompt">{r.system_prompt}</p></>)}
              {r.user_prompt && (<><h4>User prompt</h4><p className="prompt">{r.user_prompt}</p></>)}
              <h4>Model response</h4>
              <p className="prompt mono">{r.response ?? "—"}</p>
            </article>
          ))}
        </div>
        {allResponses.length === 0 && <p className="muted">No LLM responses recorded for this request.</p>}
      </section>
    </AdminShell>
  );
}
