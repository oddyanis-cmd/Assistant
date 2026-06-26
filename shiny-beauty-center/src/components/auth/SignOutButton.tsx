"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  label?: string;
}

export function SignOutButton({ label }: SignOutButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className="w-full text-sm text-charcoal-400 hover:text-rose-500 transition-colors py-3 text-center disabled:opacity-50"
    >
      {isPending ? t("app.loading") : (label ?? t("nav.sign_out"))}
    </button>
  );
}
