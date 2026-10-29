import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { updateMix } from "./actions";

export const dynamic = "force-dynamic";

type Step = {
  id: number;
  prompt_chain_id: number;
  step_order: number;
  step_type: string;
  input_type: string;
  output_type: string;
  temperature: number | null;
  system_prompt: string;
  user_prompt: string;
  llm_models: { name: string; provider_model_id: string } | null;
};

/** READ prompt chains + their steps, READ/UPDATE the prompt chain mix. */
export default async function PromptChainsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { supabase } = await requireAdmin();

  const [{ data: chains }, { data: steps }, { data: mix }, { data: runs }] = await Promise.all([
    supabase.from("prompt_chains").select("id, slug, description, created_datetime_utc").order("id"),
    supabase
      .from("prompt_chain_steps")
      .select("id, prompt_chain_id, step_order, step_type, input_type, output_type, temperature, system_prompt, user_prompt, llm_models(name, provider_model_id)")
      .order("step_order"),
    supabase.from("prompt_chain_mix").select("id, prompt_chain_id, weight, modified_datetime_utc"),
    supabase.from("llm_prompt_chains").select("prompt_chain_id"),
  ]);

  const allSteps = (steps ?? []) as unknown as Step[];
  const mixRows = mix ?? [];
  const totalWeight = mixRows.reduce((sum, m) => sum + m.weight, 0);
  const runCount = new Map<number, number>();
  (runs ?? []).forEach((r) => r.prompt_chain_id && runCount.set(r.prompt_chain_id, (runCount.get(r.prompt_chain_id) ?? 0) + 1));
  const slugOf = (id: number) => chains?.find((c) => c.id === id)?.slug ?? `#${id}`;

  return (
    <AdminShell active="/prompt-chains" title="Prompt Chains" subtitle="Each AI recommendation runs one of these chains, step by step. The mix decides how often each chain is used.">
      {ok && <p className="flash flash-ok">{ok}</p>}
      {error && <p className="flash flash-error">{error}</p>}

      <section className="card">
        <h2>Prompt chain mix</h2>
        <p className="muted small">New mood requests pick a chain at random, weighted by these numbers. &ldquo;Suggest another spot&rdquo; always uses suggest-another.</p>
        <form action={updateMix} className="mix-form">
          {mixRows.map((m) => (
            <label key={m.id} className="mix-row">
              <span className="mix-name">{slugOf(m.prompt_chain_id)}</span>
              <input type="number" name={`weight_${m.id}`} min={0} max={100} defaultValue={m.weight} aria-label={`Weight for ${slugOf(m.prompt_chain_id)}`} />
              <span className="mix-share">{totalWeight ? Math.round((m.weight / totalWeight) * 100) : 0}% of requests</span>
            </label>
          ))}
          <button className="btn btn-dark" type="submit">Save mix</button>
        </form>
      </section>

      {(chains ?? []).map((chain) => {
        const chainSteps = allSteps.filter((s) => s.prompt_chain_id === chain.id);
        return (
          <section key={chain.id} className="chain">
            <div className="chain-head">
              <div>
                <p className="eyebrow">Prompt chain #{chain.id} · {chainSteps.length} step{chainSteps.length === 1 ? "" : "s"} · ran {runCount.get(chain.id) ?? 0} times</p>
                <h2>{chain.slug}</h2>
                <p className="muted">{chain.description}</p>
              </div>
            </div>
            <div className="step-grid">
              {chainSteps.map((step) => (
                <article key={step.id} className="card step-card">
                  <h3>Step Number: {step.step_order}</h3>
                  <dl>
                    <dt>Step ID</dt><dd>#{step.id}</dd>
                    <dt>LLM Model</dt><dd>{step.llm_models?.name ?? "—"}</dd>
                    <dt>LLM Model ID</dt><dd className="mono">{step.llm_models?.provider_model_id ?? "—"}</dd>
                    <dt>Step type</dt><dd>{step.step_type}</dd>
                    <dt>Input type</dt><dd>{step.input_type}</dd>
                    <dt>Output type</dt><dd>{step.output_type}</dd>
                    <dt>Temperature</dt><dd>{step.temperature ?? "N/A"}</dd>
                  </dl>
                  <details>
                    <summary>System prompt</summary>
                    <p className="prompt">{step.system_prompt}</p>
                  </details>
                  <details>
                    <summary>User prompt</summary>
                    <p className="prompt">{step.user_prompt}</p>
                  </details>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </AdminShell>
  );
}
