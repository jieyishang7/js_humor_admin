"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

/** UPDATE the prompt chain mix: one weight (0–100) per chain. */
export async function updateMix(form: FormData) {
  const { supabase } = await requireAdmin();
  const updates: { id: number; weight: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("weight_")) continue;
    const id = Number(key.slice("weight_".length));
    const weight = Math.round(Number(value));
    if (!Number.isInteger(id) || !Number.isFinite(weight) || weight < 0 || weight > 100) {
      redirect(`/prompt-chains?error=${encodeURIComponent("Weights must be whole numbers from 0 to 100.")}`);
    }
    updates.push({ id, weight });
  }
  if (!updates.some((u) => u.weight > 0)) {
    redirect(`/prompt-chains?error=${encodeURIComponent("At least one chain needs a weight above 0.")}`);
  }
  for (const u of updates) {
    const { error } = await supabase
      .from("prompt_chain_mix")
      .update({ weight: u.weight, modified_datetime_utc: new Date().toISOString() })
      .eq("id", u.id);
    if (error) redirect(`/prompt-chains?error=${encodeURIComponent(`Couldn't save: ${error.message}`)}`);
  }
  revalidatePath("/prompt-chains");
  redirect(`/prompt-chains?ok=${encodeURIComponent("Mix saved. New requests use these weights.")}`);
}
