"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

/** Builds the stored content: place picks are JSON, anything else stays plain text. */
function buildContent(form: FormData): string | null {
  const name = text(form, "name", 80);
  const why = text(form, "why", 220);
  const plain = text(form, "plain", 300);
  if (name && why) {
    return JSON.stringify({
      name,
      area: text(form, "area", 60),
      why,
      price: text(form, "price", 6) || undefined,
    });
  }
  return plain || null;
}

function done(message: string, kind: "ok" | "error" = "ok") {
  revalidatePath("/media");
  revalidatePath("/");
  redirect(`/media?${kind}=${encodeURIComponent(message)}`);
}

/** CREATE an AI media item attached to an existing mood request. */
export async function createMedia(form: FormData) {
  const { supabase, user } = await requireAdmin();
  const requestId = Number(form.get("request_id"));
  const content = buildContent(form);
  if (!Number.isInteger(requestId) || requestId <= 0) done("Pick which mood this belongs to.", "error");
  if (!content) done("Add a place name and reason.", "error");

  const { error } = await supabase.from("captions").insert({
    request_id: requestId,
    author_id: user.id,
    content,
    model: "admin",
    prompt: "Added manually in the admin area",
  });
  if (error) done(`Couldn't create: ${error.message}`, "error");
  done("Created.");
}

/** UPDATE an AI media item's content. */
export async function updateMedia(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const content = buildContent(form);
  if (!content) done("Content can't be empty.", "error");

  const { error } = await supabase.from("captions").update({ content }).eq("id", id);
  if (error) done(`Couldn't save: ${error.message}`, "error");
  done("Saved.");
}

/** DELETE an AI media item (its votes and plan saves go with it). */
export async function deleteMedia(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const { error } = await supabase.from("captions").delete().eq("id", id);
  if (error) done(`Couldn't delete: ${error.message}`, "error");
  done("Deleted.");
}
