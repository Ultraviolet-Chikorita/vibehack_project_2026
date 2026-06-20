/* V1 dispute-readiness dashboard — talks to the engine API (spec §16, §25). */
"use strict";

const api = {
  async get(path) {
    const r = await fetch("/api" + path);
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "request failed");
    return j.data;
  },
  async post(path, body) {
    const r = await fetch("/api" + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "request failed");
    return j.data;
  },
};

const $ = (sel) => document.querySelector(sel);
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const money = (n, c = "GBP") => (c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : "") + (n ?? 0);
const titleCase = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

let state = { vaultFilter: "all" };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("hidden"), 2600);
}

// --- onboarding flow (spec §6, §25 Scene 1–2) ------------------------------

async function boot() {
  const session = await api.get("/auth/session");
  if (session.merchant?.name) $("#merchant-name").textContent = session.merchant.name;
  const dash = await api.get("/dashboard").catch(() => null);
  if (session.connected && dash && dash.emails_scanned > 0) {
    showApp();
  } else if (session.connected) {
    showOnboarding("connected");
  } else {
    showOnboarding("connect");
  }
}

function showOnboarding(step) {
  $("#onboarding").classList.remove("hidden");
  $("#app").classList.add("hidden");
  $("#step-connect").classList.toggle("hidden", step !== "connect");
  $("#step-provider").classList.toggle("hidden", step !== "provider");
  $("#step-connected").classList.toggle("hidden", step !== "connected");
}

$("#btn-link").addEventListener("click", () => showOnboarding("provider"));

document.querySelectorAll(".btn-provider").forEach((b) =>
  b.addEventListener("click", async () => {
    await api.post("/auth/connect", { provider: b.dataset.provider });
    showOnboarding("connected");
  })
);

$("#btn-scan").addEventListener("click", async () => {
  const prog = $("#scan-progress");
  prog.classList.remove("hidden");
  const lines = [
    "› Connecting to mailbox…",
    "› Fetching recent messages…",
    "› First-pass sender/subject filtering…",
    "› Classifying & extracting commerce events…",
    "› Building order evidence vaults…",
    "› Scoring dispute-readiness…",
    "› Detecting dispute signals…",
    "› Generating evidence packs…",
  ];
  prog.textContent = "";
  for (const l of lines) {
    prog.textContent += l + "\n";
    await new Promise((r) => setTimeout(r, 180));
  }
  const res = await api.post("/mailbox/scan");
  const d = res.dashboard;
  prog.textContent +=
    `\n✓ Scanned ${d.emails_scanned} emails\n✓ Found ${d.relevant_messages_found} relevant merchant emails\n` +
    `✓ Created ${d.order_vaults_created} order evidence vaults\n✓ Detected ${d.new_dispute_signals} dispute signals\n` +
    `✓ Generated ${d.packs_ready_for_review} ready-to-review packs`;
  await new Promise((r) => setTimeout(r, 700));
  showApp();
});

// --- main app --------------------------------------------------------------

async function showApp() {
  $("#onboarding").classList.add("hidden");
  $("#app").classList.remove("hidden");
  await refresh();
}

async function refresh() {
  const [dash, digest] = await Promise.all([api.get("/dashboard"), api.get("/digest")]);
  renderHero(dash);
  renderMetrics(dash);
  await renderActiveTab();
  renderDigestData(digest);
}

function renderHero(d) {
  $("#hero").innerHTML = `
    <h2>Mailbox connected.</h2>
    <p>V1 scanned <strong>${d.emails_scanned}</strong> emails and created <strong>${d.order_vaults_created}</strong> order evidence vaults.
    <strong>${d.new_dispute_signals}</strong> dispute signals were detected.
    <strong>${d.packs_ready_for_review}</strong> evidence packs are ready to review.</p>`;
}

function renderMetrics(d) {
  const tiles = [
    { v: d.emails_scanned, l: "Emails scanned" },
    { v: d.relevant_messages_found, l: "Relevant messages" },
    { v: d.order_vaults_created, l: "Order vaults" },
    { v: d.orders_dispute_ready, l: "Dispute-ready", cls: "good" },
    { v: d.orders_missing_evidence, l: "Missing evidence", cls: "warn" },
    { v: d.new_dispute_signals, l: "Dispute signals", cls: "alert" },
    { v: d.packs_ready_for_review, l: "Packs to review", cls: "good" },
    { v: d.evidence_items_captured, l: "Evidence items" },
    { v: money(d.disputed_value, d.currency), l: "Disputed value", cls: "alert" },
    { v: money(d.estimated_recoverable_value, d.currency), l: "Est. recoverable", cls: "good" },
  ];
  $("#metrics").innerHTML = tiles
    .map((t) => `<div class="metric ${t.cls || ""}"><div class="value">${t.v}</div><div class="label">${t.l}</div></div>`)
    .join("");
}

// Tabs
document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    $("#tab-" + tab.dataset.tab).classList.remove("hidden");
    state.activeTab = tab.dataset.tab;
    await renderActiveTab();
  })
);

async function renderActiveTab() {
  const tab = state.activeTab || "vaults";
  if (tab === "vaults") return renderVaults();
  if (tab === "disputes") return renderDisputes();
  if (tab === "packs") return renderPacks();
  if (tab === "billing") return renderBilling();
  if (tab === "digest") return renderDigest();
}

// --- Order Evidence Vaults (spec §16.2) ------------------------------------

const VAULT_FILTERS = [
  ["all", "All"],
  ["dispute_ready", "Dispute-ready"],
  ["missing_delivery_proof", "Missing delivery proof"],
  ["missing_product_snapshot", "Missing product snapshot"],
  ["missing_policy_snapshot", "Missing policy snapshot"],
  ["disputed", "Disputed"],
  ["needs_review", "Needs review"],
];

async function renderVaults() {
  const vaults = await api.get("/vaults");
  $("#vault-filters").innerHTML = VAULT_FILTERS.map(
    ([k, l]) => `<span class="chip ${state.vaultFilter === k ? "active" : ""}" data-f="${k}">${l}</span>`
  ).join("");
  $("#vault-filters")
    .querySelectorAll(".chip")
    .forEach((c) =>
      c.addEventListener("click", () => {
        state.vaultFilter = c.dataset.f;
        renderVaults();
      })
    );

  const filtered = vaults.filter((v) => {
    const f = state.vaultFilter;
    if (f === "all") return true;
    if (f === "disputed") return v.status === "disputed";
    return v.evidence_status === f;
  });

  const rows = filtered
    .sort((a, b) => b.evidence_score - a.evidence_score)
    .map(
      (v) => `
    <tr class="clickable" data-vault="${v.id}">
      <td><strong>#${v.order_id}</strong></td>
      <td>${v.customer_email || "—"}</td>
      <td>${money(v.amount, v.currency)}</td>
      <td><span class="badge neutral">${titleCase(v.status)}</span></td>
      <td>${scoreBar(v.evidence_score)}</td>
      <td>${(v.missing || []).map((m) => titleCase(m)).join(", ") || "—"}</td>
      <td><span class="badge ${v.evidence_status}">${titleCase(v.evidence_status)}</span></td>
    </tr>`
    )
    .join("");

  $("#vaults-table").innerHTML = `
    <table>
      <thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Fulfilment</th><th>Evidence score</th><th>Missing</th><th>Status</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="muted">No vaults match this filter.</td></tr>`}</tbody>
    </table>`;

  $("#vaults-table")
    .querySelectorAll("tr[data-vault]")
    .forEach((tr) => tr.addEventListener("click", () => openVault(tr.dataset.vault)));
}

function scoreBar(score) {
  const color = score >= 90 ? "var(--green)" : score >= 60 ? "var(--brand)" : score >= 40 ? "var(--amber)" : "var(--red)";
  return `<div class="score"><div class="score-bar"><span style="width:${score}%;background:${color}"></span></div><strong>${score}</strong></div>`;
}

// --- Dispute Signal Queue (spec §16.3) -------------------------------------

async function renderDisputes() {
  const [signals, packs] = await Promise.all([api.get("/signals"), api.get("/packs")]);
  const packBySignal = Object.fromEntries(packs.map((p) => [p.signal_id, p]));
  const rows = signals
    .map((s) => {
      const pack = packBySignal[s.id];
      const rec = pack ? pack.recommendation : "—";
      return `
      <tr class="clickable" data-pack="${pack ? pack.id : ""}" data-vault="${s.vault_id || ""}">
        <td><span class="badge ${s.category}">${titleCase(s.signal_type)}</span></td>
        <td>${s.vault_id ? "#" + s.vault_id.replace("vault_", "") : '<span class="badge needs_review">unmatched</span>'}</td>
        <td>${money(s.disputed_amount, s.currency)}</td>
        <td>${s.deadline || "—"}</td>
        <td>${pack ? `<span class="badge ${rec}">${titleCase(rec)}</span>` : "—"}</td>
        <td><span class="badge ${pack ? pack.status : "needs_review"}">${titleCase(pack ? pack.status : "queued")}</span></td>
      </tr>`;
    })
    .join("");
  $("#disputes-table").innerHTML = `
    <table>
      <thead><tr><th>Signal type</th><th>Order</th><th>Amount</th><th>Deadline</th><th>Recommendation</th><th>Status</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">No dispute signals.</td></tr>`}</tbody>
    </table>`;
  $("#disputes-table")
    .querySelectorAll("tr[data-pack]")
    .forEach((tr) =>
      tr.addEventListener("click", () => {
        if (tr.dataset.pack) openPack(tr.dataset.pack);
        else if (tr.dataset.vault) openVault(tr.dataset.vault);
      })
    );
}

// --- Evidence Packs (spec §16.4) -------------------------------------------

async function renderPacks() {
  const packs = await api.get("/packs");
  if (!packs.length) {
    $("#packs-list").innerHTML = `<p class="muted">No evidence packs yet.</p>`;
    return;
  }
  $("#packs-list").innerHTML = packs
    .map(
      (p) => `
    <div class="pack">
      <div class="pack-head">
        <div>
          <h3>${p.dispute_summary}</h3>
          <div class="conf">Recommendation: <span class="badge ${p.recommendation}">${titleCase(p.recommendation)}</span>
            &nbsp;·&nbsp; confidence ${(p.recommendation_confidence * 100).toFixed(0)}%
            &nbsp;·&nbsp; <span class="badge ${p.status}">${titleCase(p.status)}</span></div>
        </div>
        <div class="pack-actions">
          <button class="btn btn-sm" data-open="${p.id}">Review</button>
        </div>
      </div>
    </div>`
    )
    .join("");
  $("#packs-list")
    .querySelectorAll("button[data-open]")
    .forEach((b) => b.addEventListener("click", () => openPack(b.dataset.open)));
}

// --- Billing (spec §23) ----------------------------------------------------

async function renderBilling() {
  const [usage, invoice, plans] = await Promise.all([
    api.get("/billing/usage"),
    api.get("/billing/invoice"),
    api.get("/billing/plans"),
  ]);
  const usageRows = [
    ["Emails scanned", usage.emails_scanned],
    ["Relevant messages processed", usage.relevant_messages],
    ["Order vaults created", usage.order_vaults_created],
    ["Evidence items captured", usage.evidence_items_captured],
    ["Dispute signals detected", usage.dispute_signals_detected],
    ["Evidence packs generated", usage.evidence_packs_generated],
    ["Disputed value", money(usage.disputed_value, usage.currency)],
    ["Recovered revenue", money(usage.recovered_revenue, usage.currency)],
  ];
  const planCards = Object.values(plans)
    .map(
      (p) => `
    <div class="plan-card ${p.name === invoice.plan ? "current" : ""}">
      <h4>${p.name} ${p.name === invoice.plan ? '<span class="badge dispute_ready">current</span>' : ""}</h4>
      <div class="plan-price">${money(p.base_fee, p.currency)}<span class="muted" style="font-size:13px">/mo</span></div>
      <ul class="plan-list">
        <li>${p.included.emails_scanned.toLocaleString()} emails scanned</li>
        <li>${p.included.order_vaults.toLocaleString()} order vaults</li>
        <li>${p.included.dispute_packs} dispute packs</li>
        <li>${money(p.overage.per_pack, p.currency)} per extra pack</li>
        ${p.recovered_revenue_fee_pct ? `<li>${(p.recovered_revenue_fee_pct * 100).toFixed(0)}% recovered-revenue fee</li>` : ""}
      </ul>
    </div>`
    )
    .join("");

  $("#billing-view").innerHTML = `
    <div class="billing-grid">
      <div class="section">
        <h4>Metered usage (Solvimon events)</h4>
        ${usageRows.map(([k, v]) => `<div class="invoice-row"><span>${k}</span><strong>${v}</strong></div>`).join("")}
      </div>
      <div class="section">
        <h4>Current invoice — ${invoice.plan}</h4>
        <div class="invoice-row"><span>Base fee</span><strong>${money(invoice.base_fee, invoice.currency)}</strong></div>
        <div class="invoice-row"><span>Pack overage (${invoice.overage.packs})</span><strong>${money(invoice.overage.pack_charge, invoice.currency)}</strong></div>
        <div class="invoice-row"><span>Success fee (recovered revenue)</span><strong>${money(invoice.success_fee, invoice.currency)}</strong></div>
        <div class="invoice-row invoice-total"><span>Total</span><span>${money(invoice.total, invoice.currency)}</span></div>
        <p class="muted" style="font-size:12px;margin-top:10px">Outcome-based: a 5% success fee applies to recovered revenue on the Growth plan when a won dispute is logged.</p>
      </div>
    </div>
    <h4 class="muted" style="margin-top:22px">Pricing plans</h4>
    <div class="metrics" style="grid-template-columns:repeat(3,1fr)">${planCards}</div>`;
}

// --- Daily digest (spec §16.5) ---------------------------------------------

let _digest = null;
function renderDigestData(d) { _digest = d; }
async function renderDigest() {
  const d = _digest || (await api.get("/digest"));
  const rows = [
    ["Emails scanned", d.emails_scanned],
    ["Relevant merchant emails found", d.relevant_merchant_emails],
    ["Order vaults created", d.order_vaults_created],
    ["Delivery confirmations captured", d.delivery_confirmations_captured],
    ["Orders now dispute-ready", d.orders_dispute_ready],
    ["New dispute signals", d.new_dispute_signals],
    ["Ready packs", d.ready_packs],
    ["Needs review", d.needs_review],
    ["Disputed value", money(d.disputed_value, d.currency)],
    ["Estimated recoverable value", money(d.estimated_recoverable_value, d.currency)],
  ];
  $("#digest-view").innerHTML = `
    <div class="section">
      <h4>Good morning ☀️</h4>
      ${rows.map(([k, v]) => `<div class="invoice-row"><span>${k}</span><strong>${v}</strong></div>`).join("")}
    </div>`;
}

// --- Drawer: vault & pack detail -------------------------------------------

function openDrawer(html) {
  $("#drawer-content").innerHTML = html;
  $("#drawer").classList.remove("hidden");
}
function closeDrawer() { $("#drawer").classList.add("hidden"); }
$("#drawer-close").addEventListener("click", closeDrawer);
$(".drawer-backdrop") && $(".drawer-backdrop").addEventListener("click", closeDrawer);
document.querySelector(".drawer-backdrop").addEventListener("click", closeDrawer);

async function openVault(vaultId) {
  const { vault, evidence } = await api.get("/vaults/" + vaultId);
  const items = evidence
    .sort((a, b) => new Date(a.event_timestamp || a.captured_at) - new Date(b.event_timestamp || b.captured_at))
    .map(
      (e) => `<li><div class="t-when">${fmtDate(e.event_timestamp || e.captured_at)}</div>
        <div class="t-what">${titleCase(e.type)} — ${e.summary} <span class="badge ${e.strength === "strong" ? "dispute_ready" : "weak_evidence"}">${e.strength}</span></div></li>`
    )
    .join("");
  openDrawer(`
    <h2>Order #${vault.order_id}</h2>
    <dl class="kv">
      <dt>Customer</dt><dd>${vault.customer_email || "—"}</dd>
      <dt>Amount</dt><dd>${money(vault.amount, vault.currency)}</dd>
      <dt>Evidence score</dt><dd>${scoreBar(vault.evidence_score)}</dd>
      <dt>Status</dt><dd><span class="badge ${vault.evidence_status}">${titleCase(vault.evidence_status)}</span></dd>
      <dt>Strongest</dt><dd>${(vault.strongest_evidence || []).map(titleCase).join(", ") || "—"}</dd>
      <dt>Weak</dt><dd>${(vault.weak || []).map(titleCase).join(", ") || "—"}</dd>
      <dt>Missing</dt><dd>${(vault.missing || []).map(titleCase).join(", ") || "—"}</dd>
    </dl>
    <div class="section"><h4>Evidence timeline</h4><ul class="timeline">${items || '<li class="muted">No evidence yet.</li>'}</ul></div>`);
}

async function openPack(packId) {
  const p = await api.get("/packs/" + packId);
  const timeline = p.timeline
    .map((t) => `<li><div class="t-when">${fmtDate(t.at)}</div><div class="t-what">${t.label} ${t.source_message_id ? `<span class="src">${t.source_message_id}</span>` : ""}</div></li>`)
    .join("");
  const table = p.evidence_table
    .map((r) => `<tr><td>${titleCase(r.type)}</td><td>${r.summary}</td><td><span class="badge ${r.strength === "strong" ? "dispute_ready" : "weak_evidence"}">${r.strength}</span></td><td class="src">${r.source_message_id}</td></tr>`)
    .join("");
  const warnings = p.missing_evidence_warnings.length
    ? `<ul class="warn-list">${p.missing_evidence_warnings.map((w) => `<li>${w}</li>`).join("")}</ul>`
    : '<p class="muted">No missing-evidence warnings.</p>';
  const checklist = `<ul class="checklist">${p.attachments_checklist.map((c) => `<li>${c}</li>`).join("")}</ul>`;
  const approved = p.status === "approved" || p.status === "overridden";

  openDrawer(`
    <h2>Evidence Pack</h2>
    <p>${p.dispute_summary}</p>
    <p class="muted">${p.order_summary}</p>

    <div class="section">
      <h4>Recommendation (separated from facts)</h4>
      <div><span class="badge ${p.recommendation}">${titleCase(p.recommendation)}</span>
      &nbsp;·&nbsp; confidence <strong>${(p.recommendation_confidence * 100).toFixed(0)}%</strong>
      &nbsp;·&nbsp; <span class="badge ${p.status}">${titleCase(p.status)}</span></div>
      <p style="margin:10px 0 0">${p.recommendation_rationale}</p>
    </div>

    <div class="section"><h4>Evidence timeline</h4><ul class="timeline">${timeline}</ul></div>

    <div class="section"><h4>Captured evidence</h4>
      <table><thead><tr><th>Type</th><th>Summary</th><th>Strength</th><th>Source</th></tr></thead><tbody>${table}</tbody></table>
    </div>

    <div class="section"><h4>Missing-evidence warnings</h4>${warnings}</div>

    <div class="section"><h4>Copy-paste submission text</h4>
      <div class="submission" id="submission-text">${p.submission_text}</div>
      <button class="btn btn-sm" style="margin-top:10px" id="btn-copy">Copy submission text</button>
    </div>

    <div class="section"><h4>Attachments checklist</h4>${checklist}</div>

    <p class="disclaimer">${p.disclaimer}</p>

    <div class="pack-actions" style="margin-top:8px">
      <button class="btn btn-approve" id="btn-approve" ${approved ? "disabled" : ""}>${approved ? "✓ Approved" : "Approve for submission"}</button>
      <button class="btn btn-override" id="btn-refund">Override → refund</button>
    </div>
    <p class="muted" style="font-size:12px;margin-top:10px">Nothing is submitted or sent to the customer until you approve. V1 never submits a dispute or emails a customer autonomously.</p>
  `);

  $("#btn-copy").addEventListener("click", () => {
    navigator.clipboard?.writeText(p.submission_text);
    toast("Submission text copied");
  });
  $("#btn-approve").addEventListener("click", async () => {
    await api.post(`/packs/${p.id}/approve`, { approved_by: "merchant" });
    toast("Pack approved — ready for you to submit");
    closeDrawer();
    refresh();
  });
  $("#btn-refund").addEventListener("click", async () => {
    await api.post(`/packs/${p.id}/override`, { recommendation: "refund" });
    toast("Recommendation overridden to refund");
    closeDrawer();
    refresh();
  });
}

// Topbar actions
$("#btn-resync").addEventListener("click", async () => {
  await api.post("/mailbox/resync");
  toast("Mailbox resynced (idempotent — no duplicates)");
  refresh();
});
$("#btn-reset").addEventListener("click", async () => {
  await api.post("/demo/reset");
  location.reload();
});

boot().catch((e) => toast("Error: " + e.message));
