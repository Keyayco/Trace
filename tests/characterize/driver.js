/**
 * TRACE — Browser-Driven Characterization Test Driver (rev 2)
 *
 * Implements HANDOFF §5:
 *  - Loads legacy/trace-v0.1.html in same-origin iframe.
 *  - Clicks buttons/nav items by visible text (fails if 0 or >1 matches).
 *  - Chooses <select> options by value/text and dispatches change.
 *  - Polls until condition passes (until).
 *  - Snapshots DOM text.
 *  - FORBIDDEN: eval, Function, reading S or legacy globals, modifying the legacy file.
 */

import { normalizeDocument, normalizeSnapshot } from "./normalize.js";

export class CharacterizationDriver {
  constructor(iframeEl) {
    this.iframe = iframeEl;
  }

  async load(src = "/legacy/trace-v0.1.html") {
    return new Promise((resolve, reject) => {
      this.iframe.onload = () => resolve();
      this.iframe.onerror = (e) => reject(e);
      this.iframe.src = src;
    });
  }

  get doc() {
    return this.iframe.contentDocument || this.iframe.contentWindow.document;
  }

  async click(text) {
    const doc = this.doc;
    const candidates = Array.from(doc.querySelectorAll("button, .nav-item, a, .btn"));
    const matches = candidates.filter(el => {
      const isVisible = el.offsetParent !== null || window.getComputedStyle(el).display !== "none";
      return isVisible && el.textContent.trim().includes(text);
    });

    if (matches.length === 0) {
      throw new Error(`Click target not found: '${text}'`);
    }
    if (matches.length > 1) {
      // Find exact match if any
      const exact = matches.filter(el => el.textContent.trim() === text);
      if (exact.length === 1) {
        exact[0].click();
        return;
      }
      throw new Error(`Ambiguous click target '${text}': ${matches.length} elements matched`);
    }

    matches[0].click();
  }

  async choose(selectIdOrSelector, value) {
    const doc = this.doc;
    let select = doc.getElementById(selectIdOrSelector);
    if (!select) {
      select = doc.querySelector(selectIdOrSelector);
    }
    if (!select) {
      throw new Error(`Select element '${selectIdOrSelector}' not found`);
    }

    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async until(predicateFn, timeoutMs = 5000, intervalMs = 25) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        if (predicateFn(this.doc)) return true;
      } catch {
        // ignore interim errors
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Timed out waiting for predicate after ${timeoutMs}ms`);
  }

  snap() {
    const doc = this.doc;
    normalizeDocument(doc);
    const screenEl = doc.getElementById("screen") || doc.body;
    const text = screenEl.innerText || screenEl.textContent;
    return normalizeSnapshot(text);
  }
}
