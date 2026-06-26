import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { BottomNav } from "@/components/ui/BottomNav";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "My Profile",
};

async function getLoyaltyPoints(userId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return 0;

  // Find client record
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!client) return 0;
  const clientId = (client as { id: string }).id;

  const { data } = await supabase
    .from("loyalty_points")
    .select("points")
    .eq("client_id", clientId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).reduce(
    (sum: number, row: any) => sum + (row.points ?? 0),
    0
  );
}

export default async function ProfilePage() {
  const t = await getTranslations();
  const user = await getCurrentUserWithPermissions();

  if (!user) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <LanguageSwitcher />
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4">
            <div className="text-4xl">👤</div>
            <h1 className="text-xl font-light text-charcoal-900">
              {t("profile.title")}
            </h1>
            <p className="text-charcoal-500 text-sm">
              {t("appointments.sign_in_required")}
            </p>
            <Link href="/auth/signin" className="btn-primary">
              {t("nav.sign_in")}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const loyaltyPoints = await getLoyaltyPoints(user.id);
  const profile = user.profile;

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-nude-100 px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        <LanguageSwitcher />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 space-y-6">
        <h1 className="text-2xl font-light text-charcoal-900">
          {t("profile.title")}
        </h1>

        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-200 to-nude-200 flex items-center justify-center text-2xl font-semibold text-rose-700">
            {(profile?.full_name ?? user.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-charcoal-900">
              {profile?.full_name ?? t("app.name")}
            </p>
            <p className="text-sm text-charcoal-400">{user.email}</p>
          </div>
        </div>

        {/* Loyalty points */}
        <div className="card bg-gradient-to-br from-rose-50 to-nude-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-charcoal-800">
              {t("profile.loyalty_title")}
            </h2>
            <span className="text-2xl font-bold text-rose-600">
              {t("profile.loyalty_points", { points: loyaltyPoints })}
            </span>
          </div>
          <p className="text-xs text-charcoal-500 leading-relaxed">
            {t("profile.loyalty_desc")}
          </p>
          {/* Progress bar — visual only */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-charcoal-400 mb-1">
              <span>0</span>
              <span>100 pts → 1 free service</span>
            </div>
            <div className="h-2 bg-nude-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (loyaltyPoints % 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Profile details (read-only stub — edit in Phase 3) */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-charcoal-800 mb-2">
            {t("auth.full_name_label")}
          </h2>
          <ProfileRow
            label={t("profile.full_name")}
            value={profile?.full_name ?? "—"}
          />
          <ProfileRow label={t("profile.email")} value={user.email ?? "—"} />
          {profile?.phone && (
            <ProfileRow label={t("profile.phone")} value={profile.phone} />
          )}
          <ProfileRow
            label={t("profile.locale")}
            value={profile?.locale === "ar" ? "العربية" : "English"}
          />

          {/* Stub: edit profile in Phase 3 */}
          <button
            disabled
            className="btn-secondary w-full opacity-50 cursor-not-allowed mt-2"
          >
            {t("profile.edit_profile")} (Phase 3)
          </button>
        </div>

        {/* Roles */}
        {user.roles.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-charcoal-800 mb-3">
              Account Type
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span
                  key={role.id}
                  className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium"
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sign out */}
        <SignOutButton label={t("nav.sign_out")} />
      </main>

      <BottomNav />
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-nude-100 last:border-0">
      <span className="text-sm text-charcoal-500">{label}</span>
      <span className="text-sm font-medium text-charcoal-800">{value}</span>
    </div>
  );
}

// Client component for sign-out (needs browser client)
import { SignOutButton } from "@/components/auth/SignOutButton";
