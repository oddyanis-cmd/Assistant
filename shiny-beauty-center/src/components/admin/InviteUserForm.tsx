/**
 * InviteUserForm — client component for inviting a new user by email.
 * Uses the inviteUserAction server action (service-role gated).
 */
"use client";

import { useState, useTransition } from "react";
import { inviteUserAction } from "@/app/[locale]/admin/users/invite-action";

interface Labels {
  invite_user: string;
  invite_email_label: string;
  invite_email_placeholder: string;
  invite_send: string;
  invite_sending: string;
  invite_sent: string;
  invite_error: string;
  invite_stub_full: string;
}

interface Props {
  canInvite: boolean;
  supabaseReady: boolean;
  hasServiceRole: boolean;
  labels: Labels;
}

export function InviteUserForm({ canInvite, supabaseReady, hasServiceRole, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!canInvite) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await inviteUserAction(email);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
      } else {
        setMessage({ ok: true, text: labels.invite_sent });
        setEmail("");
        setOpen(false);
      }
    });
  }

  const canSend = supabaseReady && hasServiceRole;

  return (
    <div>
      <button
        onClick={() => { setOpen((v) => !v); setMessage(null); }}
        className="btn-primary text-sm"
      >
        + {labels.invite_user}
      </button>

      {open && (
        <div className="mt-4 card border-rose-200 max-w-md">
          <h3 className="text-sm font-semibold text-charcoal-700 mb-3">{labels.invite_user}</h3>

          {/* Note about service-role requirement */}
          <div className="rounded-lg bg-cream-50 border border-cream-200 px-3 py-2 text-xs text-charcoal-600 mb-4">
            {labels.invite_stub_full}
          </div>

          {!canSend && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 mb-3">
              {!supabaseReady
                ? "Supabase not configured."
                : "SUPABASE_SERVICE_ROLE_KEY is missing."}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1">
              <label className="field-label">{labels.invite_email_label}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={labels.invite_email_placeholder}
                required
                className="field-input"
                disabled={isPending || !canSend}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isPending || !canSend || !email.trim()}
                className="btn-primary text-sm"
              >
                {isPending ? labels.invite_sending : labels.invite_send}
              </button>
            </div>
          </form>

          {message && (
            <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
