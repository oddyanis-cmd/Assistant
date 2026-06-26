/**
 * Client component: add a private note to a client.
 */
"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { addClientNote } from "@/lib/staff";

interface AddClientNoteFormProps {
  clientId: string;
}

export function AddClientNoteForm({ clientId }: AddClientNoteFormProps) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    setMessage(null);

    const result = await addClientNote(clientId, note.trim());

    if (result.success) {
      setNote("");
      setMessage({ type: "success", text: t("note_added") });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? "Failed to add note." });
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {message && (
        <div
          className={`mb-3 px-4 py-2 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <label className="field-label">{t("private_note_label")}</label>
      <div className="flex gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("private_note_placeholder")}
          rows={2}
          className="field-input resize-none flex-1"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !note.trim()}
          className="btn-primary self-end"
        >
          {loading ? t("adding_note") : t("add_note")}
        </button>
      </div>
    </form>
  );
}
