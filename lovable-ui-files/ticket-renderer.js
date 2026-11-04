/**
 * TRACE ticket renderer (framework-free).
 *
 * Pure functions that turn an adapted TRACE ticket object into HTML strings,
 * plus the Lucide icon map (inline SVGs copied from the Lucide icon set —
 * no framework or icon-library dependency is introduced).
 */

/* ----- Lucide icons (inline SVG, MIT licensed) ----- */

const stroke = {
  open: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
  close: '</svg>',
};

const paths = {
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  "circle-user": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  "contact": '<path d="M16 2v2M8 2v2M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  calendar: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  "alert-triangle": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
};

export function icon(name, cls = "") {
  const body = paths[name] || "";
  return `${stroke.open}${body}${stroke.close}`.replace(
    "<svg ",
    `<svg class="${cls}" `
  );
}

export const icons = {
  menu: icon("menu"),
  "circle-user": icon("circle-user"),
  "chevron-left": icon("chevron-left"),
  "chevron-right": icon("chevron-right"),
  user: icon("user"),
  contact: icon("contact"),
  tag: icon("tag"),
  calendar: icon("calendar"),
  "file-text": icon("file-text"),
  mail: icon("mail"),
  clock: icon("clock"),
  "map-pin": icon("map-pin"),
  "alert-triangle": icon("alert-triangle"),
  play: icon("play"),
  paperclip: icon("paperclip"),
};

/* Replace every <span data-icon="name"> placeholder in the static shell. */
export function hydrateStaticIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    if (icons[name]) el.innerHTML = icons[name];
  });
}

/* ----- HTML builders ----- */

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function metaRow(iconName, label, value) {
  return `
    <li class="meta-row">
      <span class="meta-icon">${icons[iconName]}</span>
      <span class="meta-text">
        <span class="meta-label">${esc(label)}</span>
        <span class="meta-value">${esc(value)}</span>
      </span>
    </li>`;
}

function customerSection(t) {
  const c = t.customer;
  return `
    <section class="section section--open" data-section="customer">
      <button class="section-head" type="button" data-toggle aria-expanded="true">
        <span class="section-icon">${icons.contact}</span>
        <span class="section-title">Customer Information</span>
        <span class="section-chevron">${icons["chevron-right"]}</span>
      </button>
      <div class="section-body customer-lines">
        <p class="customer-name">${esc(c.name)}</p>
        <p class="customer-line">${esc(c.company)}</p>
        <a class="customer-line" href="mailto:${esc(c.email)}">${esc(c.email)}</a>
        <a class="customer-line" href="tel:${esc(c.phone.replace(/[^+\d]/g, ""))}">${esc(c.phone)}</a>
        <p class="customer-loc">${icons["map-pin"]}<span>${esc(c.location)}</span></p>
      </div>
    </section>`;
}

function descriptionSection(t) {
  return `
    <section class="section section--plain" data-section="description">
      <div class="section-head">
        <span class="section-icon">${icons["file-text"]}</span>
        <span class="section-title">Ticket Description</span>
        <span class="section-chevron">${icons["chevron-right"]}</span>
      </div>
      <div class="section-body">
        <p class="description-text">${esc(t.description)}</p>
      </div>
    </section>`;
}

function emailSection(t) {
  const items = t.emails
    .map(
      (e) => `
      <div class="email-item">
        <div class="email-meta">${esc(e.timestamp)} &nbsp;<span class="email-from">From: ${esc(e.from)}</span></div>
        <p class="email-body">${esc(e.body)}</p>
      </div>`
    )
    .join("");
  return `
    <section class="section" data-section="email">
      <button class="section-head" type="button" data-toggle aria-expanded="false">
        <span class="section-icon">${icons.mail}</span>
        <span class="section-title">Email Correspondence</span>
        <span class="section-count">${t.emails.length}</span>
        <span class="section-chevron">${icons["chevron-right"]}</span>
      </button>
      <div class="section-body">${items}</div>
    </section>`;
}

function updatesSection(t) {
  const items = t.updates
    .map(
      (u) => `
      <li class="timeline-item">
        <span class="timeline-dot timeline-dot--${esc(u.kind)}"></span>
        <div class="timeline-content">
          <div class="timeline-top">
            <span class="timeline-time">${esc(u.timestamp)}</span>
            <span class="timeline-actor">${esc(u.actor)}</span>
          </div>
          <p class="timeline-text">${esc(u.text)}</p>
        </div>
      </li>`
    )
    .join("");
  return `
    <section class="section section--plain" data-section="updates">
      <div class="section-head">
        <span class="section-icon">${icons.clock}</span>
        <span class="section-title">Recent Updates</span>
        <span class="section-chevron">${icons["chevron-right"]}</span>
      </div>
      <div class="section-body">
        <ul class="timeline">${items}</ul>
      </div>
    </section>`;
}

/**
 * Render the full ticket page into the given container.
 * @param {HTMLElement} root  container element
 * @param {object} t      adapted TRACE ticket (see adaptTicket in app.js)
 */
export function renderTicket(root, t) {
  const statusTone = t.status.toLowerCase() === "open" ? "open" : "muted";
  const priorityIcon = t.priority.toLowerCase() === "high" ? icons["alert-triangle"] : "";

  root.innerHTML = `
    <div class="ticket-head">
      <h1 class="ticket-id">#${esc(t.id)}</h1>
      <div class="badges">
        <span class="badge badge--${statusTone}">${esc(t.status)}</span>
        <span class="badge badge--high">${priorityIcon}${esc(t.priority)}</span>
      </div>
    </div>
    <h2 class="ticket-subject">${esc(t.subject)}</h2>
    <p class="ticket-summary">${esc(t.summary)}</p>
    <ul class="meta-list">
      ${metaRow("user", "Customer", `${t.customer.company} — ${t.customer.name}`)}
      ${metaRow("tag", "Category", t.category)}
      ${metaRow("calendar", "Created", t.created)}
    </ul>
    ${customerSection(t)}
    ${descriptionSection(t)}
    ${emailSection(t)}
    ${updatesSection(t)}
  `;
  root.setAttribute("aria-busy", "false");
}
