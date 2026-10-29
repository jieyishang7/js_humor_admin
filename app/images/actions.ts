"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

const BUCKET = "uploads";

function back(message: string, kind: "ok" | "error" = "ok"): never {
  revalidatePath("/images");
  redirect(`/images?${kind}=${encodeURIComponent(message)}`);
}

/** Storage path from a public URL like …/object/public/uploads/<path>. */
function pathFromUrl(url: string) {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

/** CREATE: called after the browser uploaded the file into the admin's own folder. */
export async function createImage(path: string, description: string) {
  const { supabase, user } = await requireAdmin();
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) return { ok: false, message: "Invalid upload path." };
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from("uploads")
    .insert({ owner_id: user.id, image_url: publicUrl, description: description.trim().slice(0, 300) || null });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/images");
  return { ok: true };
}

/** UPDATE: description, and optionally swap in a newly uploaded file. */
export async function updateImage(id: number, description: string, newPath?: string) {
  const { supabase, user } = await requireAdmin();
  const values: Record<string, unknown> = { description: description.trim().slice(0, 300) || null };
  if (newPath) {
    if (!newPath.startsWith(`${user.id}/`) || newPath.includes("..")) return { ok: false, message: "Invalid upload path." };
    const { data: old } = await supabase.from("uploads").select("image_url").eq("id", id).maybeSingle();
    values.image_url = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
    const oldPath = old?.image_url ? pathFromUrl(old.image_url) : null;
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
  }
  const { error } = await supabase.from("uploads").update(values).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/images");
  return { ok: true };
}

/** DELETE: the row and its file in Storage. */
export async function deleteImage(form: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));
  const { data: row } = await supabase.from("uploads").select("image_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("uploads").delete().eq("id", id);
  if (error) back(`Couldn't delete: ${error.message}`, "error");
  const path = row?.image_url ? pathFromUrl(row.image_url) : null;
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  back("Image deleted.");
}
