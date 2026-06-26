/**
 * Client component: mark individual or all notifications read.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/staff";

interface NotificationActionsProps {
  notificationId: string;
  isRead: boolean;
}

export function MarkReadButton({ notificationId, isRead }: NotificationActionsProps) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (isRead) return null;

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await markNotificationRead(notificationId);
          router.refresh();
        });
      }}
      disabled={isPending}
      className="text-xs text-rose-600 hover:text-rose-700 underline-offset-2 hover:underline disabled:opacity-50"
    >
      {t("mark_read")}
    </button>
  );
}

interface MarkAllReadButtonProps {
  hasUnread: boolean;
}

export function MarkAllReadButton({ hasUnread }: MarkAllReadButtonProps) {
  const t = useTranslations("staff");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!hasUnread) return null;

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        });
      }}
      disabled={isPending}
      className="btn-ghost text-sm"
    >
      {t("mark_all_read")}
    </button>
  );
}
