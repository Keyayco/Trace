/**
 * TRACE mobile ticket page — app entry (framework-free ES module).
 *
 * Responsibilities:
 *  1. Load demonstration ticket data from data/ticket.json.
 *  2. Adapt it to the TRACE ticket contract shape (single integration point —
 *     swap `adaptTicket` when the real TRACE data source is connected).
 *  3. Render the ticket page via js/ticket-renderer.js.
 *  4. Emit clearly defined UI intents as DOM CustomEvents on `document`:
 *
 *     - `trace:start-investigation`
 *         detail: { ticketId, subject, emittedAt }
 *         Fired when the fixed bottom "Start Investigation" button is pressed.
 *         No remote access, simulation, session or assessment logic here.
 *
 *     - `trace:note-added`
 *         detail: { ticketId, text, emittedAt }
 *         Fired when the user submits a note from the bottom bar.
 */

import { hydrateStaticIcons, renderTicket } from "./ticket-renderer.js";

/* ----- Data adapter: demo JSON -> TRACE ticket contract ----- */

function adaptTicket(raw) {
  const t = raw.ticket ?? raw;
  return {
    id: t.id,
    subject: t.subject,
    summary: t.summary ?? "",
    status: t.status,
    priority: t.priority,
    category: t.category ?? "",
    created: t.created ?? "",
    description: t.description ?? "",
    customer: {
      name: t.customer?.name ?? "",
      company: t.customer?.company ?? "",
      email: t.customer?.email ?? "",
      phone: t.customer?.phone ?? "",
      location: t.customer?.location ?? "",
    },
    emails: Array.isArray(t.emails) ? t.emails : [],
    updates: Array.isArray(t.updates) ? t.updates : [],
  };
}

/* ----- Intent emitters ----- */

function emitStartInvestigation(ticket) {
  const intent = new CustomEvent("trace:start-investigation", {
    bubbles: true,
    cancelable: true,
    detail: {
      ticketId: ticket.id,
      subject: ticket.subject,
      emittedAt: new Date().toISOString(),
    },
  });
  document.dispatchEvent(intent);
  // Debug surface for integrators; remove when the real handler is wired in.
  console.info("[TRACE] intent:", "trace:start-investigation", intent.detail);
}

function emitNoteAdded(ticket, text) {
  const intent = new CustomEvent("trace:note-added", {
    bubbles: true,
    cancelable: true,
    detail: { ticketId: ticket.id, text, emittedAt: new Date().toISOString() },
  });
  document.dispatchEvent(intent);
  console.info("[TRACE] intent:", "trace:note-added", intent.detail);
}

/* ----- Section expand/collapse ----- */

function bindSectionToggles(root) {
  root.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest(".section");
      const open = section.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });
}

/* ----- Boot ----- */

async function loadTicketData() {
  const res = await fetch("./data/ticket.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`ticket.json unavailable (HTTP ${res.status})`);
  return res.json();
}

async function init() {
  hydrateStaticIcons();

  const root = document.getElementById("ticket-root");
  const noteInput = document.getElementById("note-input");
  const startBtn = document.getElementById("start-investigation");
  const subbarId = document.querySelector("[data-slot='subbar-ticket-id']");

  try {
    const raw = await loadTicketData();
    const ticket = adaptTicket(raw);

    renderTicket(root, ticket);
    bindSectionToggles(root);
    if (subbarId) subbarId.textContent = ticket.id;

    startBtn.addEventListener("click", () => emitStartInvestigation(ticket));

    const submitNote = () => {
      const text = noteInput.value.trim();
      if (!text) return;
      emitNoteAdded(ticket, text);
      noteInput.value = "";
    };
    noteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitNote();
    });
  } catch (err) {
    root.setAttribute("aria-busy", "false");
    root.innerHTML =
      '<p class="muted" style="padding:1rem 0">Could not load ticket data. ' +
      "Serve this folder over HTTP (e.g. <code>npx serve</code>) and reload.</p>";
    console.error("[TRACE] failed to load ticket:", err);
  }
}

init();
