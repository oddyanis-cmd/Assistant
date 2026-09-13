/**
 * ServiceImageUploader — lets a manager upload / change / remove a service photo.
 *
 * The file is uploaded straight to the public `service-images` Storage bucket
 * from the browser (Storage RLS only allows this for users with edit_service);
 * the resulting public URL is then persisted on the service row via a server
 * action.
 */
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setServiceImageAction } from "@/app/[locale]/admin/services/actions";

const BUCKET = "service-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function ServiceImageUploader({
  serviceId,
  imageUrl,
  locale,
  canEdit,
}: {
  serviceId: string;
  imageUrl: string | null;
  locale: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Service not configured.");
      return;
    }

    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${serviceId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const res = await setServiceImageAction(serviceId, data.publicUrl, locale);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const res = await setServiceImageAction(serviceId, null, locale);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const thumb = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className="h-14 w-14 rounded-lg object-cover border border-nude-100"
    />
  ) : (
    <div className="h-14 w-14 rounded-lg bg-nude-50 border border-nude-100 flex items-center justify-center text-nude-300 text-lg">
      ◉
    </div>
  );

  if (!canEdit) return thumb;

  return (
    <div className="flex items-center gap-3">
      {thumb}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="text-xs text-rose-600 hover:underline disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
          disabled={busy || isPending}
        >
          {busy ? "Uploading…" : imageUrl ? "Change photo" : "Upload photo"}
        </button>
        {imageUrl && (
          <button
            type="button"
            className="text-[11px] text-charcoal-400 hover:text-red-600 disabled:opacity-50"
            onClick={handleRemove}
            disabled={busy || isPending}
          >
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        {error && <p className="text-[10px] text-red-600 max-w-[10rem]">{error}</p>}
      </div>
    </div>
  );
}
