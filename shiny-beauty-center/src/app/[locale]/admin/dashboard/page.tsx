/**
 * Admin Dashboard — /admin/dashboard
 * Gated on view_dashboard permission.
 * Shows KPI cards, revenue trend chart (inline SVG), and peak-hours heatmap.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions, can, PERMISSIONS } from "@/lib/auth";
import {
  getRevenueMetrics,
  getRevenueTrend,
  getPeakHours,
  getClientMetrics,
  type RevenueTrendPoint,
  type PeakHourPoint,
} from "@/lib/metrics";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Dashboard — Admin" };

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const { locale } = await params;
  const { period: rawPeriod } = await searchParams;
  const period =
    rawPeriod === "today" || rawPeriod === "week" || rawPeriod === "month"
      ? rawPeriod
      : "month";

  const user = await getCurrentUserWithPermissions();
  if (!user) {
    redirect(`/${locale}/auth/signin?redirectTo=/${locale}/admin/dashboard`);
  }

  const t = await getTranslations("adminPortal");

  if (!can(user, PERMISSIONS.VIEW_DASHBOARD)) {
    return <AccessDenied message={t("access_denied_body")} />;
  }

  // Fetch all metrics in parallel
  const [revenue, trend, peak, clients] = await Promise.all([
    getRevenueMetrics(period),
    getRevenueTrend(30),
    getPeakHours(90),
    getClientMetrics(period),
  ]);

  const periodLabel =
    period === "today"
      ? t("period_today")
      : period === "week"
      ? t("period_week")
      : t("period_month");

  // Build period switcher links
  const periods = [
    { key: "today", label: t("period_today") },
    { key: "week",  label: t("period_week") },
    { key: "month", label: t("period_month") },
  ] as const;

  return (
    <div className="space-y-8">
      {/* Header + period switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-charcoal-900">{t("dashboard_title")}</h1>
          <p className="text-charcoal-500 text-sm mt-1">
            {t("dashboard_subtitle")} {periodLabel}
          </p>
        </div>
        <div className="flex gap-1 bg-white/80 rounded-xl p-1 border border-nude-200 self-start">
          {periods.map(({ key, label }) => (
            <Link
              key={key}
              href={`/admin/dashboard?period=${key}` as Parameters<typeof Link>[0]["href"]}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === key
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-charcoal-600 hover:bg-rose-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards row 1 — Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t("revenue_label")}
          value={`${revenue.currentRevenue.toLocaleString("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${t("sar")}`}
          delta={revenue.changePct}
          sub={t("vs_previous")}
          accent="rose"
        />
        <KpiCard
          label={t("total_bookings")}
          value={String(revenue.totalBookings)}
          sub={`${revenue.completedCount} ${t("completed")} · ${revenue.cancelledCount} ${t("cancelled")}`}
          accent="nude"
        />
        <KpiCard
          label={t("no_show_rate")}
          value={`${revenue.noShowRate}%`}
          sub={`${revenue.noShowCount} ${t("no_show")}`}
          accent={revenue.noShowRate > 15 ? "blush" : "nude"}
        />
        <KpiCard
          label={t("new_clients")}
          value={String(clients.newClients)}
          sub={`${clients.returningClients} ${t("returning_clients")}`}
          accent="nude"
        />
      </div>

      {/* Revenue trend chart */}
      <section className="card">
        <h2 className="text-base font-semibold text-charcoal-800 mb-4">
          {t("revenue_trend")}
        </h2>
        {trend.length === 0 ? (
          <EmptyState message={t("no_data")} />
        ) : (
          <RevenueTrendChart points={trend} />
        )}
      </section>

      {/* Peak hours heatmap */}
      <section className="card">
        <h2 className="text-base font-semibold text-charcoal-800 mb-1">
          {t("peak_hours")}
        </h2>
        <p className="text-xs text-charcoal-400 mb-4">{t("peak_hours_subtitle")}</p>
        {peak.length === 0 ? (
          <EmptyState message={t("no_data")} />
        ) : (
          <PeakHoursHeatmap points={peak} t={t} />
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (server-side, no "use client" needed)
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  delta,
  sub,
  accent,
}: {
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  accent: "rose" | "nude" | "blush";
}) {
  const accentClasses: Record<string, string> = {
    rose:  "bg-rose-50  border-rose-100",
    nude:  "bg-nude-50  border-nude-100",
    blush: "bg-blush-50 border-blush-100",
  };
  const deltaColor = delta === undefined ? "" : delta >= 0 ? "text-green-600" : "text-red-500";

  return (
    <div className={`rounded-2xl border p-5 ${accentClasses[accent]}`}>
      <p className="text-xs font-medium text-charcoal-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-semibold text-charcoal-900 truncate">{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {delta !== undefined && (
          <span className={`text-xs font-semibold ${deltaColor}`}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
        {sub && <span className="text-xs text-charcoal-400">{sub}</span>}
      </div>
    </div>
  );
}

function RevenueTrendChart({ points }: { points: RevenueTrendPoint[] }) {
  const maxRevenue = Math.max(...points.map((p) => p.revenue), 1);
  const chartH = 120;

  // Build path
  const w = 600;
  const padX = 20;
  const chartW = w - padX * 2;
  const step = points.length > 1 ? chartW / (points.length - 1) : chartW;

  const pathD = points
    .map((p, i) => {
      const x = padX + i * step;
      const y = chartH - (p.revenue / maxRevenue) * chartH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaD =
    pathD +
    ` L${(padX + (points.length - 1) * step).toFixed(1)},${chartH} L${padX},${chartH} Z`;

  // Format day labels (only show ~6)
  const labelStep = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${chartH + 24}`}
        className="w-full"
        style={{ minWidth: 320 }}
        aria-label="Revenue trend chart"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={w - padX}
            y1={(chartH * (1 - t)).toFixed(1)}
            y2={(chartH * (1 - t)).toFixed(1)}
            stroke="#f2d9d0"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={areaD} fill="#fecdd3" fillOpacity="0.3" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => {
          const x = padX + i * step;
          const y = chartH - (p.revenue / maxRevenue) * chartH;
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill="#f43f5e" />
          );
        })}

        {/* X axis labels */}
        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          const x = padX + i * step;
          const label = p.day.slice(5); // MM-DD
          return (
            <text
              key={i}
              x={x.toFixed(1)}
              y={chartH + 16}
              textAnchor="middle"
              fontSize="9"
              fill="#a0a1aa"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function PeakHoursHeatmap({
  points,
  t,
}: {
  points: PeakHourPoint[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  // Build a 7×24 matrix
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let maxCount = 1;
  for (const p of points) {
    matrix[p.dayOfWeek][p.hourOfDay] = p.count;
    if (p.count > maxCount) maxCount = p.count;
  }

  // Show only business hours 8–21
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);
  const days = [0, 1, 2, 3, 4, 5, 6];

  function intensity(count: number): string {
    if (count === 0) return "bg-nude-50";
    const ratio = count / maxCount;
    if (ratio < 0.2) return "bg-rose-100";
    if (ratio < 0.4) return "bg-rose-200";
    if (ratio < 0.6) return "bg-rose-300";
    if (ratio < 0.8) return "bg-rose-400";
    return "bg-rose-500";
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-left text-charcoal-400 font-normal pe-2 pb-1 w-10"></th>
            {hours.map((h) => (
              <th
                key={h}
                className="text-charcoal-400 font-normal text-center pb-1"
                style={{ minWidth: 24 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((dow) => (
            <tr key={dow}>
              <td className="text-charcoal-500 font-medium pe-2 whitespace-nowrap">
                {t(`days_short.${dow}`)}
              </td>
              {hours.map((h) => {
                const count = matrix[dow][h];
                return (
                  <td key={h} title={`${count} bookings`}>
                    <div
                      className={`w-5 h-5 rounded-sm ${intensity(count)}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-charcoal-400">Low</span>
        {["bg-rose-100", "bg-rose-200", "bg-rose-300", "bg-rose-400", "bg-rose-500"].map(
          (cls, i) => (
            <div key={i} className={`w-4 h-4 rounded-sm ${cls}`} />
          )
        )}
        <span className="text-xs text-charcoal-400">High</span>
      </div>
    </div>
  );
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="card max-w-sm text-center">
        <div className="text-3xl mb-3 text-rose-300">◈</div>
        <p className="text-charcoal-600 text-sm">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-charcoal-400 italic py-6 text-center">{message}</p>;
}
