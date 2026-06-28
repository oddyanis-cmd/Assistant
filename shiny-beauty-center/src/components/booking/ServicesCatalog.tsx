"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Service, ServiceCategory } from "@/lib/supabase/types";
import { StarDisplay } from "@/components/reviews/StarPicker";
import type { ReviewStats } from "@/lib/reviews";
import { CURRENCY } from "@/lib/config";

// Category emoji mapping for visual identity
const CATEGORY_ICONS: Record<string, string> = {
  Massages: "🌸",
  Facials: "✨",
  "Lash Services": "👁",
  Manicure: "💅",
  Pedicure: "🌺",
  "Moroccan Bath": "🫧",
};

// Placeholder gradient colors per category index
const CARD_GRADIENTS = [
  "from-rose-100 to-blush-100",
  "from-nude-100 to-cream-100",
  "from-rose-50 to-rose-100",
  "from-cream-100 to-nude-100",
  "from-blush-50 to-rose-50",
  "from-nude-50 to-nude-100",
];

interface ServicesCatalogProps {
  categories: ServiceCategory[];
  services: Service[];
  locale: string;
  isAr: boolean;
  ratingsByServiceId?: Record<string, ReviewStats>;
}

export function ServicesCatalog({
  categories,
  services,
  locale,
  isAr,
  ratingsByServiceId,
}: ServicesCatalogProps) {
  const t = useTranslations();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? services.filter((s) => s.category_id === activeCategory)
    : services;

  if (services.length === 0) {
    return (
      <div className="text-center py-20 text-charcoal-400">
        <div className="text-4xl mb-4">🌸</div>
        <p>{t("services.empty")}</p>
      </div>
    );
  }

  // Build a category lookup for gradient index
  const catIndex: Record<string, number> = {};
  categories.forEach((c, i) => {
    catIndex[c.id] = i;
  });

  return (
    <div className="space-y-6">
      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        <button
          onClick={() => setActiveCategory(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === null
              ? "bg-rose-500 text-white"
              : "bg-white border border-nude-200 text-charcoal-600 hover:border-rose-300"
          }`}
        >
          {t("services.all_categories")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() =>
              setActiveCategory(cat.id === activeCategory ? null : cat.id)
            }
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? "bg-rose-500 text-white"
                : "bg-white border border-nude-200 text-charcoal-600 hover:border-rose-300"
            }`}
          >
            <span className="me-1">
              {CATEGORY_ICONS[cat.name_en] ?? "◈"}
            </span>
            {isAr ? cat.name_ar : cat.name_en}
          </button>
        ))}
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 gap-4 pb-4">
        {filtered.map((service) => {
          const idx = catIndex[service.category_id] ?? 0;
          const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
          const catName = categories.find((c) => c.id === service.category_id);
          const icon = CATEGORY_ICONS[catName?.name_en ?? ""] ?? "◈";
          const name = isAr ? service.name_ar : service.name_en;
          const desc = isAr ? service.description_ar : service.description_en;

          return (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-nude-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image placeholder with gradient */}
              <div
                className={`bg-gradient-to-br ${gradient} h-36 flex items-center justify-center`}
              >
                <span className="text-5xl opacity-70">{icon}</span>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-charcoal-900 leading-snug">{name}</h3>
                  <span className="flex-shrink-0 text-sm font-semibold text-rose-600">
                    {service.price.toLocaleString()} {CURRENCY}
                  </span>
                </div>

                {desc && (
                  <p className="text-xs text-charcoal-500 leading-relaxed line-clamp-2 mb-3">
                    {desc}
                  </p>
                )}

                {/* Rating display */}
                {(() => {
                  const stats = ratingsByServiceId?.[service.id];
                  if (stats && stats.avgRating !== null && stats.reviewCount > 0) {
                    return (
                      <div className="mb-2">
                        <StarDisplay
                          rating={stats.avgRating}
                          count={stats.reviewCount}
                          size="sm"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-charcoal-400 bg-nude-50 px-2 py-1 rounded-full">
                    {t("services.duration", { minutes: service.duration_minutes })}
                  </span>
                  <Link
                    href={`/book?serviceId=${service.id}`}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    {t("services.book_now")}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
