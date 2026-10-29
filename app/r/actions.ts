"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getResource, type Resource } from "@/lib/resources";

function back(resource: Resource, message: string, kind: "ok" | "error" = "ok"): never {
  revalidatePath(`/r/${resource.key}`);
  revalidatePath("/");
  redirect(`/r/${resource.key}?${kind}=${encodeURIComponent(message)}`);
}

/** Reads only whitelisted fields from the form and coerces them to the right type. */
function readValues(resource: Resource, form: FormData): Record<string, unknown> | string {
  const values: Record<string, unknown> = {};
  for (const field of resource.fields) {
    const raw = form.get(field.name);
    if (field.type === "bool") {
      values[field.name] = raw === "on" || raw === "true";
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      if (field.required) return `${field.label} is required.`;
      values[field.name] = null;
      continue;
    }
    if (field.type === "number" || field.type === "select") {
      const n = Number(text);
      if (!Number.isFinite(n)) return `${field.label} must be a number.`;
      values[field.name] = n;
    } else if (field.type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return "Enter a valid e-mail address.";
      values[field.name] = text.toLowerCase();
    } else if (field.type === "domain") {
      const domain = text.toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return "Enter a domain like example.com.";
      values[field.name] = domain;
    } else {
      values[field.name] = text.slice(0, 4000);
    }
  }
  return values;
}

export async function createRow(key: string, form: FormData) {
  const resource = getResource(key);
  if (!resource?.ops.create) throw new Error("Not allowed");
  const { supabase } = await requireAdmin();

  const values = readValues(resource, form);
  if (typeof values === "string") back(resource, values, "error");

  const { error } = await supabase.from(resource.table).insert(values);
  if (error) back(resource, error.code === "23505" ? "That already exists." : `Couldn't create: ${error.message}`, "error");
  back(resource, "Created.");
}

export async function updateRow(key: string, form: FormData) {
  const resource = getResource(key);
  if (!resource?.ops.update) throw new Error("Not allowed");
  const { supabase, user } = await requireAdmin();
  const id = Number(form.get("id"));

  const values = readValues(resource, form);
  if (typeof values === "string") back(resource, values, "error");
  if (resource.touch) {
    values[resource.touch] = new Date().toISOString();
    if (resource.touch === "modified_datetime_utc" && resource.select.includes("created_by_user_id")) {
      values.modified_by_user_id = user.id;
    }
  }

  const { error } = await supabase.from(resource.table).update(values).eq(resource.idColumn ?? "id", id);
  if (error) back(resource, `Couldn't save: ${error.message}`, "error");
  back(resource, "Saved.");
}

export async function deleteRow(key: string, form: FormData) {
  const resource = getResource(key);
  if (!resource?.ops.delete) throw new Error("Not allowed");
  const { supabase } = await requireAdmin();
  const id = Number(form.get("id"));

  const { error } = await supabase.from(resource.table).delete().eq(resource.idColumn ?? "id", id);
  if (error) {
    back(resource, error.code === "23503" ? "Can't delete: other rows still use this one." : `Couldn't delete: ${error.message}`, "error");
  }
  back(resource, "Deleted.");
}
