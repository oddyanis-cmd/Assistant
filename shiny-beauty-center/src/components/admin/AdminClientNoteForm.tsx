/**
 * AdminClientNoteForm — client component: add a private note from the admin detail page.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { addAdminClientNoteAction } from "@/app/[locale]/admin/clients/[id]/actions";

interface Labels {
  add_note: string;
  adding_note: string;
  note_added: string;
  note_placeholder: string;
}

interface Props {
  clientId: string;
  labels: Labels;
}

export function AdminClientNoteForm({ clientId, labels }: Props) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addAdminClientNoteAction(clientId, note.trim());
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setNote("");
        setMessage({ ok: true, text: labels.note_added });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {message && (
        <div
          className={`mb-3 px-4 py-2 rounded-xl text-sm font-medium ${
            message.ok
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={labels.note_placeholder}
          rows={2}
          className="field-input resize-none flex-1"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !note.trim()}
          className="btn-primary self-end"
        >
          {isPending ? labels.adding_note : labels.add_note}
        </button>
      </div>
    </form>
  );
}
