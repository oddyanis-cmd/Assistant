"use strict";

// ── Helpers ─────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const scratch = $("#scratch");

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || res.statusText);
  return body;
}

// Grab the current video frame as a JPEG data URL (un-mirrored).
function grabFrame(video, quality = 0.85) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  scratch.width = w; scratch.height = h;
  const ctx = scratch.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  return scratch.toDataURL("image/jpeg", quality);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Camera management (one stream, attached to whichever tab is visible) ─────
let stream = null;
async function ensureCamera(video) {
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
  }
  if (video.srcObject !== stream) video.srcObject = stream;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tab-" + tab).classList.add("active");
    if (tab === "kiosk") ensureCamera($("#kiosk-video")).catch(showCamError);
    if (tab === "enroll") ensureCamera($("#enroll-video")).catch(showCamError);
    if (tab === "admin") refreshAdmin();
  });
});

function showCamError(e) {
  alert("Cannot access the camera: " + e.message +
        "\n\nThe page must be served over HTTPS or localhost, and you must allow camera access.");
}

// ── Engine badge ─────────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const cfg = await api("/config");
    const badge = $("#engine-badge");
    if (cfg.engine.available) {
      badge.textContent = "Engine: " + cfg.engine.name;
      badge.className = "badge badge-ok";
    } else {
      badge.textContent = "⚠ Engine not ready";
      badge.className = "badge badge-bad";
      badge.title = cfg.engine.error || "";
    }
  } catch (e) { /* ignore */ }
}

// ── KIOSK: capture a burst and check in ──────────────────────────────────────
const kioskBtn = $("#kiosk-btn");
const kioskOverlay = $("#kiosk-overlay");
const kioskResult = $("#kiosk-result");

kioskBtn.addEventListener("click", async () => {
  const video = $("#kiosk-video");
  try { await ensureCamera(video); } catch (e) { return showCamError(e); }

  kioskBtn.disabled = true;
  kioskOverlay.className = "overlay scanning";
  kioskResult.className = "result";
  kioskResult.textContent = "Scanning…";

  // Capture a short burst (~1s) so the server can run liveness detection.
  const frames = [];
  for (let i = 0; i < 6; i++) {
    const f = grabFrame(video);
    if (f) frames.push(f);
    await sleep(160);
  }

  try {
    const res = await api("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
    });
    renderKiosk(res);
  } catch (e) {
    kioskOverlay.className = "overlay bad";
    kioskResult.className = "result bad";
    kioskResult.textContent = "Error: " + e.message;
  } finally {
    kioskBtn.disabled = false;
    setTimeout(() => { kioskOverlay.className = "overlay"; }, 3500);
  }
});

function renderKiosk(res) {
  const ok = res.outcome === "checked_in";
  kioskOverlay.className = "overlay " + (ok ? "ok" : "bad");
  kioskResult.className = "result " + (ok ? "ok" : "bad");
  let sub = "";
  if (res.similarity != null) {
    sub += `confidence ${(res.similarity * 100).toFixed(1)}%`;
  }
  if (res.crm_synced) sub += " · synced to CRM";
  else if (ok) sub += " · saved locally (no CRM configured)";
  kioskResult.innerHTML = `${res.message}<span class="sub">${sub}</span>`;
}

// ── ENROLL ───────────────────────────────────────────────────────────────────
let enrollImage = null;
const enrollSubmit = $("#enroll-submit");

$("#enroll-capture").addEventListener("click", async () => {
  const video = $("#enroll-video");
  try { await ensureCamera(video); } catch (e) { return showCamError(e); }
  enrollImage = grabFrame(video, 0.92);
  if (enrollImage) {
    $("#enroll-preview").innerHTML = `<img src="${enrollImage}" alt="captured face" />`;
    enrollSubmit.disabled = false;
  }
});

$("#enroll-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!enrollImage) return;
  const fd = new FormData(ev.target);
  const payload = { image: enrollImage };
  for (const [k, v] of fd.entries()) if (v) payload[k] = v;

  const result = $("#enroll-result");
  result.className = "result";
  result.textContent = "Saving…";
  try {
    const client = await api("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    result.className = "result ok";
    result.textContent = `Saved ${client.full_name} (id ${client.id}) with ${client.template_count} face template.`;
    ev.target.reset();
    enrollImage = null;
    $("#enroll-preview").innerHTML = "";
    enrollSubmit.disabled = true;
  } catch (e) {
    result.className = "result bad";
    result.textContent = "Could not save: " + e.message;
  }
});

// ── ADMIN tables ─────────────────────────────────────────────────────────────
async function refreshAdmin() {
  try {
    const clients = await api("/api/clients");
    const ctbody = $("#clients-table tbody");
    ctbody.innerHTML = clients.map((c) => `
      <tr>
        <td>${c.id}</td><td>${c.full_name}</td><td>${c.membership_no || "—"}</td>
        <td>${c.template_count}</td><td>${c.crm_id || "—"}</td>
        <td><button class="link-btn" data-del="${c.id}">delete</button></td>
      </tr>`).join("") || `<tr><td colspan="6">No clients enrolled yet.</td></tr>`;

    ctbody.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this client and their face data?")) return;
        await fetch("/api/clients/" + b.dataset.del, { method: "DELETE" });
        refreshAdmin();
      }));

    const checkins = await api("/api/checkins?limit=30");
    $("#checkins-table tbody").innerHTML = checkins.map((r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>${r.client_name || "—"}</td>
        <td><span class="pill ${r.outcome}">${r.outcome}</span></td>
        <td>${r.similarity != null ? (r.similarity * 100).toFixed(1) + "%" : "—"}</td>
        <td>${r.liveness_passed ? "✓" : "✗"}</td>
        <td>${r.crm_synced ? "✓" : "—"}</td>
      </tr>`).join("") || `<tr><td colspan="6">No check-ins yet.</td></tr>`;
  } catch (e) { /* ignore */ }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
loadConfig();
ensureCamera($("#kiosk-video")).catch(showCamError);
