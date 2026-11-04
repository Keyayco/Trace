/**
 * TRACE — Characterization Normalizer (rev 2)
 *
 * Implements HANDOFF §5:
 *  - Blanks timeline time cells (.hist-t)
 *  - Masks SIM-\d{4} identifiers
 *  - Preserves fixed lease dates in ipconfig /all
 */

export function normalizeSnapshot(rawText) {
  if (!rawText) return "";
  let text = String(rawText);
  // Mask SIM-\d{4} session ids
  text = text.replace(/SIM-\d{4}/g, "SIM-####");
  return text;
}

export function normalizeDocument(doc) {
  // Blank timeline time cells (.hist-t)
  doc.querySelectorAll(".hist-t").forEach(el => {
    el.textContent = "##:##";
  });
}
