"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Service } from "@/lib/supabase/types";
import type { StaffWithProfile } from "@/lib/catalog";
import { fetchAvailableSlots, createAppointmentAction } from "@/lib/appointments";
import { initiateBookingPayment } from "@/lib/payments/actions";
import { CURRENCY } from "@/lib/config";

// Steps include an optional "payment" step inserted after "confirm" when
// paymentsEnabled is true.
type Step = "service" | "staff" | "datetime" | "confirm" | "payment";

interface Slot {
  staff_id: string;
  staff_name: string;
  slot_start: string;
}

interface BookingWizardProps {
  services: Service[];
  staff: StaffWithProfile[];
  preselectedServiceId: string | null;
  locale: string;
  isAr: boolean;
  /** Injected from server so the client never reads env directly */
  paymentsEnabled: boolean;
  /** Full name of the authenticated user, for pre-filling Tap customer */
  clientName?: string;
  clientEmail?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDateOptions() {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-SA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    opts.push({ label, value });
  }
  return opts;
}

// ── Step indicator ──────────────────────────────────────────────────────────

function StepBar({
  step,
  paymentsEnabled,
}: {
  step: Step;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("booking");

  const baseSteps: Step[] = ["service", "staff", "datetime", "confirm"];
  const steps: Step[] = paymentsEnabled
    ? [...baseSteps, "payment"]
    : baseSteps;

  const labels: string[] = paymentsEnabled
    ? [
        t("step_service"),
        t("step_staff"),
        t("step_datetime"),
        t("step_confirm"),
        t("step_payment"),
      ]
    : [
        t("step_service"),
        t("step_staff"),
        t("step_datetime"),
        t("step_confirm"),
      ];

  const current = steps.indexOf(step);

  return (
    <div className="flex items-center mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors ${
              i <= current
                ? "bg-rose-500 text-white"
                : "bg-nude-100 text-charcoal-400"
            }`}
          >
            {i < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span
            className={`text-[10px] ms-1 font-medium hidden sm:inline transition-colors ${
              i === current ? "text-rose-600" : "text-charcoal-400"
            }`}
          >
            {labels[i]}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-px mx-2 transition-colors ${
                i < current ? "bg-rose-300" : "bg-nude-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────

export function BookingWizard({
  services,
  staff,
  preselectedServiceId,
  locale,
  isAr,
  paymentsEnabled,
  clientName = "Guest",
  clientEmail,
}: BookingWizardProps) {
  const t = useTranslations("booking");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>(
    preselectedServiceId ? "staff" : "service"
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    preselectedServiceId
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Set after appointment is created (before payment step)
  const [createdAppointmentId, setCreatedAppointmentId] = useState<
    string | null
  >(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // ── Date → fetch slots ────────────────────────────────────────────────────

  async function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);
    if (!selectedServiceId) return;
    setLoadingSlots(true);
    const results = await fetchAvailableSlots(
      selectedServiceId,
      selectedStaffId,
      date
    );
    setSlots(results);
    setLoadingSlots(false);
  }

  // ── Confirm booking (flag OFF path: create + confirm immediately) ─────────

  function handleConfirmNoPayment() {
    if (!selectedSlot || !selectedServiceId) return;
    setError(null);

    startTransition(async () => {
      const result = await createAppointmentAction({
        serviceId: selectedServiceId,
        staffId: selectedSlot.staff_id,
        startAt: selectedSlot.slot_start,
        notes: notes.trim() || undefined,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push(
        `/book/confirmation?token=${result.publicToken}&appointmentId=${result.appointmentId}`
      );
    });
  }

  // ── Confirm booking (flag ON path: create PENDING, then pay) ─────────────

  function handleConfirmWithPayment() {
    if (!selectedSlot || !selectedServiceId || !selectedService) return;
    setError(null);

    startTransition(async () => {
      // Step 1: create the appointment in PENDING state
      const result = await createAppointmentAction({
        serviceId: selectedServiceId,
        staffId: selectedSlot.staff_id,
        startAt: selectedSlot.slot_start,
        notes: notes.trim() || undefined,
        pending: true,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setCreatedAppointmentId(result.appointmentId);
      setPublicToken(result.publicToken);
      setStep("payment");
    });
  }

  function handleConfirm() {
    if (paymentsEnabled) {
      handleConfirmWithPayment();
    } else {
      handleConfirmNoPayment();
    }
  }

  // ── Payment step: initiate Tap charge ─────────────────────────────────────

  function handlePay() {
    if (!createdAppointmentId || !selectedService) return;
    setError(null);

    startTransition(async () => {
      const result = await initiateBookingPayment({
        appointmentId: createdAppointmentId,
        serviceId: selectedService.id,
        clientName,
        clientEmail,
        locale,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      // Redirect to Tap hosted payment page
      window.location.href = result.paymentUrl;
    });
  }

  // ── Step: choose service ──────────────────────────────────────────────────

  if (step === "service") {
    return (
      <div>
        <StepBar step="service" paymentsEnabled={paymentsEnabled} />
        <h2 className="text-lg font-medium text-charcoal-800 mb-4">
          {t("step_service")}
        </h2>
        <div className="space-y-3">
          {services.map((svc) => {
            const name = isAr ? svc.name_ar : svc.name_en;
            return (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedServiceId(svc.id);
                  setStep("staff");
                }}
                className={`w-full text-start p-4 rounded-xl border transition-all ${
                  selectedServiceId === svc.id
                    ? "border-rose-400 bg-rose-50"
                    : "border-nude-200 bg-white hover:border-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-charcoal-800">{name}</span>
                  <span className="text-sm font-semibold text-rose-600">
                    {svc.price} {CURRENCY}
                  </span>
                </div>
                <div className="text-xs text-charcoal-400 mt-1">
                  {t("services.duration", { minutes: svc.duration_minutes })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step: choose staff ────────────────────────────────────────────────────

  if (step === "staff") {
    return (
      <div>
        <StepBar step="staff" paymentsEnabled={paymentsEnabled} />
        <h2 className="text-lg font-medium text-charcoal-800 mb-4">
          {t("choose_staff")}
        </h2>

        <div className="space-y-3">
          <button
            onClick={() => {
              setSelectedStaffId(null);
              setStep("datetime");
            }}
            className={`w-full text-start p-4 rounded-xl border transition-all ${
              selectedStaffId === null
                ? "border-rose-400 bg-rose-50"
                : "border-nude-200 bg-white hover:border-rose-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-100 to-nude-100 flex items-center justify-center text-xl flex-shrink-0">
                ✦
              </div>
              <div>
                <div className="font-medium text-charcoal-800">
                  {t("no_preference")}
                </div>
                <div className="text-xs text-charcoal-400">
                  {t("no_preference_desc")}
                </div>
              </div>
            </div>
          </button>

          {staff.map((member) => (
            <button
              key={member.id}
              onClick={() => {
                setSelectedStaffId(member.id);
                setStep("datetime");
              }}
              className={`w-full text-start p-4 rounded-xl border transition-all ${
                selectedStaffId === member.id
                  ? "border-rose-400 bg-rose-50"
                  : "border-nude-200 bg-white hover:border-rose-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: member.color_hex ?? "#fda4af" }}
                >
                  {member.full_name[0]}
                </div>
                <div>
                  <div className="font-medium text-charcoal-800">
                    {member.full_name}
                  </div>
                  {member.specialties && (
                    <div className="text-xs text-charcoal-400">
                      {member.specialties.slice(0, 2).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button onClick={() => setStep("service")} className="mt-6 btn-ghost w-full">
          {t("back")}
        </button>
      </div>
    );
  }

  // ── Step: date + time ─────────────────────────────────────────────────────

  if (step === "datetime") {
    const dateOptions = getDateOptions();

    const slotsByTime = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
      const key = slot.slot_start;
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    }, {});

    const uniqueTimes = Object.keys(slotsByTime).sort();

    return (
      <div>
        <StepBar step="datetime" paymentsEnabled={paymentsEnabled} />

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-charcoal-700 mb-3">
              {t("choose_date")}
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
              {dateOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDateSelect(opt.value)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border text-sm transition-all ${
                    selectedDate === opt.value
                      ? "bg-rose-500 text-white border-rose-500"
                      : "bg-white border-nude-200 text-charcoal-700 hover:border-rose-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div>
              <h2 className="text-sm font-semibold text-charcoal-700 mb-3">
                {t("choose_time")}
              </h2>

              {loadingSlots ? (
                <div className="text-center py-8 text-charcoal-400 text-sm">
                  {t("loading_slots")}
                </div>
              ) : uniqueTimes.length === 0 ? (
                <div className="text-center py-8 text-charcoal-400 text-sm">
                  {t("no_slots")}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {uniqueTimes.map((timeKey) => {
                    const slotGroup = slotsByTime[timeKey];
                    const slot =
                      slotGroup.find((s) => s.staff_id === selectedStaffId) ??
                      slotGroup[0];
                    const isSelected = selectedSlot?.slot_start === timeKey;

                    return (
                      <button
                        key={timeKey}
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          isSelected
                            ? "bg-rose-500 text-white border-rose-500"
                            : "bg-white border-nude-200 text-charcoal-700 hover:border-rose-300"
                        }`}
                      >
                        {formatTime(timeKey)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={() => setStep("staff")} className="btn-ghost flex-1">
            {t("back")}
          </button>
          <button
            disabled={!selectedSlot}
            onClick={() => selectedSlot && setStep("confirm")}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("next")}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: confirm ─────────────────────────────────────────────────────────

  if (step === "confirm") {
    const svcName = selectedService
      ? isAr
        ? selectedService.name_ar
        : selectedService.name_en
      : "";
    const staffName = selectedSlot?.staff_name ?? t("no_preference");

    return (
      <div>
        <StepBar step="confirm" paymentsEnabled={paymentsEnabled} />
        <h2 className="text-lg font-medium text-charcoal-800 mb-6">
          {t("review_title")}
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="card space-y-4 mb-6">
          <Row label={t("service_label")} value={svcName} />
          <Row label={t("specialist_label")} value={staffName} />
          {selectedSlot && (
            <>
              <Row label={t("date_label")} value={formatDate(selectedSlot.slot_start)} />
              <Row label={t("time_label")} value={formatTime(selectedSlot.slot_start)} />
            </>
          )}
          {selectedService && (
            <Row
              label={t("price_label")}
              value={`${selectedService.price} ${CURRENCY}`}
            />
          )}
          {/* Payment note — toggles based on flag */}
          <div className="pt-2 border-t border-nude-100">
            <span className="text-xs text-charcoal-400 bg-nude-50 px-3 py-1.5 rounded-full">
              {paymentsEnabled
                ? t("payment_note_online")
                : t("payment_note")}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="field-label">{t("notes_label")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notes_placeholder")}
            rows={3}
            className="field-input resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep("datetime")}
            disabled={isPending}
            className="btn-ghost flex-1"
          >
            {t("back")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="btn-primary flex-1"
          >
            {isPending
              ? t("confirming")
              : paymentsEnabled
              ? t("continue_to_payment")
              : t("confirm_button")}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: payment (paymentsEnabled === true only) ─────────────────────────

  if (step === "payment") {
    const svcName = selectedService
      ? isAr
        ? selectedService.name_ar
        : selectedService.name_en
      : "";
    const price = selectedService ? Number(selectedService.price) : 0;

    return (
      <div>
        <StepBar step="payment" paymentsEnabled={paymentsEnabled} />
        <h2 className="text-lg font-medium text-charcoal-800 mb-6">
          {t("payment_title")}
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"
          >
            {error}
          </div>
        )}

        {/* Order summary */}
        <div className="card space-y-4 mb-6">
          <Row label={t("service_label")} value={svcName} />
          {selectedSlot && (
            <>
              <Row label={t("date_label")} value={formatDate(selectedSlot.slot_start)} />
              <Row label={t("time_label")} value={formatTime(selectedSlot.slot_start)} />
            </>
          )}
          <div className="pt-2 border-t border-nude-100 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-charcoal-700">
              {t("total_label")}
            </span>
            <span className="text-lg font-bold text-rose-600">
              {price} {CURRENCY}
            </span>
          </div>
        </div>

        {/* Secure payment badge */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-charcoal-400">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1L2 3v4c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V3L7 1z"
              stroke="#7c7e89"
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
            />
            <path d="M4.5 7l2 2 3-3" stroke="#7c7e89" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {t("payment_secure_note")}
        </div>

        {/* Tap payment button */}
        <div className="flex gap-3">
          <button
            onClick={() => setStep("confirm")}
            disabled={isPending}
            className="btn-ghost flex-1"
          >
            {t("back")}
          </button>
          <button
            onClick={handlePay}
            disabled={isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending ? (
              t("payment_processing")
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="white" strokeWidth="1.2" />
                  <path d="M1 7h14" stroke="white" strokeWidth="1.2" />
                </svg>
                {t("pay_now_button")}
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-charcoal-400 mt-4">
          {t("payment_provider_note")}
        </p>
      </div>
    );
  }

  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-charcoal-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-charcoal-900 text-end">
        {value}
      </span>
    </div>
  );
}
