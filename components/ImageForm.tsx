"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createImage, updateImage } from "@/app/images/actions";
import { createClient } from "@/lib/supabase/client";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Upload a new image, or (with `imageId`) edit an existing one's description / replace its file. */
export function ImageForm({ adminId, imageId, initialDescription = "" }: { adminId: string; imageId?: number; initialDescription?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!imageId && !file) return setStatus({ kind: "error", text: "Choose an image first." });
    if (file && !ALLOWED.includes(file.type)) return setStatus({ kind: "error", text: "Use JPG, PNG, WebP or GIF." });
    if (file && file.size > 5 * 1024 * 1024) return setStatus({ kind: "error", text: "Max 5 MB." });

    setStatus({ kind: "busy", text: "Saving…" });
    let path: string | undefined;
    if (file) {
      path = `${adminId}/${Date.now()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
      const { error } = await createClient().storage.from("uploads").upload(path, file, { contentType: file.type });
      if (error) return setStatus({ kind: "error", text: `Upload failed: ${error.message}` });
    }
    const result = imageId ? await updateImage(imageId, description, path) : await createImage(path!, description);
    if (!result.ok) return setStatus({ kind: "error", text: result.message });
    setStatus({ kind: "ok", text: imageId ? "Saved." : "Uploaded." });
    if (!imageId) {
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack image-form">
      <label>
        {imageId ? "Replace file (optional)" : "Image file"}
        <input ref={fileRef} type="file" accept={ALLOWED.join(",")} />
      </label>
      <label>
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="e.g. Hungarian Pastry Shop on a rainy day" />
      </label>
      <div className="form-row">
        <button className="btn btn-dark" type="submit" disabled={status.kind === "busy"}>
          {status.kind === "busy" ? "Saving…" : imageId ? "Save changes" : "Upload image"}
        </button>
        {status.text && status.kind !== "busy" && (
          <span className={status.kind === "error" ? "form-error" : "form-ok"}>{status.text}</span>
        )}
      </div>
    </form>
  );
}
