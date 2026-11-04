/**
 * TRACE — Ticket Desk & Coordination View (rev 2)
 *
 * Implements:
 *  - Rendering of trace.ticket.v1 contracts.
 *  - Incorporation of Lovable presentation ideas (prominent description, compact
 *    customer & site details, expandable correspondence, status/priority badges).
 *  - Non-displacement of technical facts, unknowns, evidence, provenance, and requirements.
 *  - Complete escaping (D-12) to prevent XSS.
 *  - Dispatches coordinated intents to the session store.
 */

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const svgIcons = {
  ticket: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>',
  user: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/></svg>',
  contact: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 2v2M8 2v2M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  mail: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  clock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  alert: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  help: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  chevronRight: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  terminal: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  laptop: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>'
};

export function renderTicketDesk(container, ticket, sessionStore, onNavigate) {
  const p = sessionStore.projections;
  const isReviewed = p.viewed.includes("ticket");
  const isCommReviewed = p.viewed.includes("communication");

  const statusTone = ticket.initialStatus === "open" ? "open" : "muted";
  const priorityLevel = ticket.priority?.level || "P2";
  const priorityLabel = ticket.priority?.label || "Normal";

  container.innerHTML = `
    <div class="stage-eyebrow">STAGE 1 OF 4 · OPERATIONAL TICKET DESK</div>
    <div class="stage-title">Incident Coordination &amp; Requirements</div>

    <!-- Ticket Header & Quick Summary -->
    <div class="ticket-header-card">
      <div class="ticket-header-top">
        <div class="ticket-id-badge">
          ${svgIcons.ticket}
          <span>${esc(ticket.id)}</span>
        </div>
        <div class="badges-row">
          <span class="badge badge--${statusTone}">${esc(ticket.initialStatus.toUpperCase())}</span>
          <span class="badge badge--priority">${svgIcons.alert} ${esc(priorityLevel)} · ${esc(priorityLabel)}</span>
          <span class="badge badge--service">${esc(ticket.service || "Technical Support")}</span>
        </div>
      </div>
      <h2 class="ticket-subject-title">${esc(ticket.title)}</h2>
      <p class="ticket-summary-lead">${esc(ticket.report.text)}</p>
    </div>

    <!-- Quick metadata bar -->
    <div class="ticket-meta-grid">
      <div class="meta-item">
        <span class="meta-label">Customer</span>
        <span class="meta-val">${esc(ticket.customer.name)}</span>
        <span class="meta-sub">${esc(ticket.customer.site)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Affected Device / User</span>
        <span class="meta-val">${esc(ticket.affected.device)}</span>
        <span class="meta-sub">${esc(ticket.affected.user)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Logged At</span>
        <span class="meta-val">${esc(ticket.created.date)} · ${esc(ticket.created.time)}</span>
        <span class="meta-sub">Origin: ${esc(ticket.meta.origin)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Customer Contact</span>
        <span class="meta-val">${esc(ticket.customer.contact?.person || "Site Reception")}</span>
        <span class="meta-sub">${esc(ticket.customer.contact?.phone || "Phone on file")}</span>
      </div>
    </div>

    <!-- Business Impact Banner -->
    ${ticket.impact ? `
      <div class="impact-callout">
        <div class="impact-icon">${svgIcons.alert}</div>
        <div class="impact-text">
          <strong>Reported Business Impact:</strong> ${esc(ticket.impact.text)}
        </div>
      </div>
    ` : ""}

    <!-- Two-column Technical Facts vs Unknowns -->
    <div class="grid2">
      <!-- Verified / Reported Technical Facts -->
      <div class="panel">
        <div class="panel-head">
          ${svgIcons.check}
          <span>Known Facts (${ticket.facts.length})</span>
        </div>
        <div class="panel-body">
          <ul class="fact-list">
            ${ticket.facts.map(f => `
              <li class="fact-item">
                <span class="fact-bullet"></span>
                <div class="fact-content">
                  <div class="fact-text">${esc(f.text)}</div>
                  <div class="fact-meta">Status: <span class="tag-status">${esc(f.status)}</span> · Source: <code>${esc(f.sourceId)}</code></div>
                </div>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>

      <!-- Critical Unknowns requiring Investigation -->
      <div class="panel">
        <div class="panel-head">
          ${svgIcons.help}
          <span>Unknowns to Investigate (${ticket.unknowns.length})</span>
        </div>
        <div class="panel-body">
          <ul class="unknown-list">
            ${ticket.unknowns.map(u => `
              <li class="unknown-item">
                <span class="unknown-bullet">?</span>
                <div class="unknown-content">
                  <div class="unknown-text">${esc(u.text)}</div>
                  <div class="unknown-kind">Category: <em>${esc(u.kind)}</em></div>
                </div>
              </li>
            `).join("")}
          </ul>
          <div class="unknown-hint">
            The learner must use available diagnostic tools in the simulated workstation to turn these unknowns into proven findings.
          </div>
        </div>
      </div>
    </div>

    <!-- Raw Sources & Customer Communications (Lovable Expandable Style) -->
    <div class="panel">
      <div class="panel-head">
        ${svgIcons.mail}
        <span>Customer Communication &amp; Source Transcripts (${ticket.sources.length})</span>
      </div>
      <div class="panel-body">
        <div class="sources-accordion">
          ${ticket.sources.map((s, idx) => `
            <div class="source-card ${idx === 1 ? 'is-open' : ''}" id="source-card-${esc(s.id)}">
              <div class="source-header" onclick="document.getElementById('source-card-${esc(s.id)}').classList.toggle('is-open')">
                <div class="source-header-left">
                  <span class="source-type-pill">${esc(s.type)}</span>
                  <strong class="source-title">${esc(s.label)}</strong>
                  ${s.receivedAt ? `<span class="source-time">${esc(s.receivedAt.time || "")}</span>` : ""}
                </div>
                <div class="source-chevron">${svgIcons.chevronRight}</div>
              </div>
              <div class="source-body">
                <pre class="source-raw">${esc(s.raw)}</pre>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="btn-row" style="margin-top: 12px;">
          ${isCommReviewed ? `
            <span class="chip ok">✓ Customer communications reviewed</span>
          ` : `
            <button class="btn small" id="btn-mark-comm">Mark communication as reviewed</button>
          `}
        </div>
      </div>
    </div>

    <!-- Ticket-Coordinated Requirements & Environment Engine Context -->
    <div class="panel">
      <div class="panel-head">
        ${svgIcons.terminal}
        <span>Investigation Requirements &amp; Simulation Environment</span>
      </div>
      <div class="panel-body">
        <div class="req-grid">
          <div class="req-block">
            <div class="req-title">Required Environment Module</div>
            <div class="req-val"><code>${esc(ticket.requirements.environment.module)}</code></div>
            <div class="req-desc">Constructs topology with required components: ${ticket.requirements.environment.componentTypes.map(c => `<code>${esc(c)}</code>`).join(" ")}</div>
          </div>
          <div class="req-block">
            <div class="req-title">Required Diagnostic Tools</div>
            <div class="tool-tags-row">
              ${ticket.requirements.environment.toolIds.map(t => `<span class="pill cyan">${esc(t)}</span>`).join(" ")}
            </div>
          </div>
          <div class="req-block">
            <div class="req-title">Customer Authorization Scope</div>
            <div class="req-val">
              ${ticket.requirements.authorizations.map(a => `
                <div class="auth-scope-badge">
                  <strong>${esc(a.scope)}</strong> — ${esc(a.description)}
                </div>
              `).join("")}
            </div>
          </div>
          <div class="req-block">
            <div class="req-title">Remote Assistance Stage</div>
            <div class="req-val">
              Mode: <strong>${esc(ticket.requirements.remote.mode.toUpperCase())}</strong>
              <div class="small muted">
                ${ticket.requirements.remote.mode === "optional"
                  ? "Optional: Learner can interact with customer contact or connect directly to workstation."
                  : "Required: Handshake with customer mandatory."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Coordinated Action Footer -->
    <div class="ticket-action-bar">
      <div class="ticket-action-info">
        <span class="action-info-status">Ready to investigate:</span>
        <span class="action-info-target">${esc(ticket.affected.device)}</span>
      </div>
      <div class="btn-row" style="margin: 0;">
        <button class="btn" id="btn-to-remote">Remote Support Session →</button>
        <button class="btn primary" id="btn-begin-investigation">Enter Simulated Workstation →</button>
      </div>
    </div>
  `;

  // Bind interactions
  const btnMarkComm = container.querySelector("#btn-mark-comm");
  if (btnMarkComm) {
    btnMarkComm.addEventListener("click", () => {
      sessionStore.dispatch({
        actor: "learner",
        type: "nav.view",
        params: { item: "communication" }
      });
      renderTicketDesk(container, ticket, sessionStore, onNavigate);
    });
  }

  const btnToRemote = container.querySelector("#btn-to-remote");
  if (btnToRemote) {
    btnToRemote.addEventListener("click", () => {
      sessionStore.dispatch({
        actor: "learner",
        type: "nav.view",
        params: { item: "ticket" }
      });
      onNavigate(1); // Screen 1: Remote Support
    });
  }

  const btnBegin = container.querySelector("#btn-begin-investigation");
  if (btnBegin) {
    btnBegin.addEventListener("click", () => {
      sessionStore.dispatch({
        actor: "learner",
        type: "nav.view",
        params: { item: "ticket" }
      });
      // If not yet connected, connect automatically or advance to workstation
      if (!sessionStore.projections.connection.connected) {
        sessionStore.dispatch({
          actor: "learner",
          type: "session.connect",
          params: { connectionId: sessionStore.idGen.next() }
        });
      }
      onNavigate(2); // Screen 2: Workstation
    });
  }
}
