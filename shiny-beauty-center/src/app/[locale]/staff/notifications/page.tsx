/**
 * Staff Notifications — in-app inbox reading the notifications table.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getMyNotifications } from "@/lib/staff";
import { MarkReadButton, MarkAllReadButton } from "@/components/staff/NotificationActions";

export const metadata: Metadata = { title: "Notifications — Staff" };

function timeAgo(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (locale === "ar") {
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${days} يوم`;
  }

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

interface NotificationsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { locale } = await params;
  const t = await getTranslations("staff");

  const notifications = await getMyNotifications();
  const unreadCount = notifications.filter((n) => n.status !== "read").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("notifications_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">
            {t("notifications_subtitle")}
            {unreadCount > 0 && (
              <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                {t("unread_count", { count: unreadCount })}
              </span>
            )}
          </p>
        </div>
        <MarkAllReadButton hasUnread={unreadCount > 0} />
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4 text-nude-300">◎</div>
          <p className="text-charcoal-500 text-sm">{t("no_notifications")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const isUnread = notif.status !== "read";
            return (
              <div
                key={notif.id}
                className={`rounded-2xl border p-4 transition-all ${
                  isUnread
                    ? "bg-white border-rose-200 shadow-sm"
                    : "bg-nude-50/60 border-nude-100"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Unread dot */}
                    <div className="flex-shrink-0 mt-1.5">
                      {isUnread ? (
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-charcoal-200" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {notif.subject && (
                        <p className={`text-sm font-semibold mb-0.5 ${isUnread ? "text-charcoal-800" : "text-charcoal-600"}`}>
                          {notif.subject}
                        </p>
                      )}
                      <p className={`text-sm leading-relaxed ${isUnread ? "text-charcoal-700" : "text-charcoal-500"}`}>
                        {notif.body}
                      </p>
                      <p className="text-xs text-charcoal-400 mt-1.5">
                        {timeAgo(notif.created_at, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <MarkReadButton notificationId={notif.id} isRead={!isUnread} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
