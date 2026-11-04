# TRACE — Handoff (rev 2)

Date: 2026-10-19 · Phase: **architecture and audit — amended, awaiting approval of §4**. No product code has been written or changed.

## 1. What changed in rev 2

Reviewer corrections R-1…R-5 applied across all five documents. Twenty schema contradictions found in rev 1 are listed with resolutions in DEV-LOG §4. The earlier `eval`-based test proposal is withdrawn.

## 2. Verified baseline / not verified

- **Verified (by reading only):** the supplied prototype is one self-contained HTML file with inline CSS/JS, no external requests, four screens, one hardcoded networking scenario (`INC-1042`, tag `NS-VOIP-01`). Audit in DEV-LOG §1–3 (D-01…D-17).
- **Checked by running something:** the six JSON examples in CONTRACTS parse as JSON. They are not schema-validated; no validator exists.
- **Not verified:** runtime behavior of the prototype in any browser; any earlier implementation, checkpoint, repo or tests (none supplied); the Kimi origin.

## 3. Reviewer corrections → where addressed

| # | Correction | Status | Where |
|---|---|---|---|
| R-1 | Action log authoritative; everything else a projection | `[APPROVED]`; details A-1, A-2, A-3, A-15 | ARCH §2; STATE §1, §3–4; CONTRACTS §5; DEV-LOG C-1, C-2, C-11, C-12 |
| R-2 | Customer authorization separate from technical privilege | `[APPROVED]`; details A-4…A-8 | ARCH §5; CONTRACTS §1, §3, §5; STATE §3, §5 |
| R-3 | Coherent scenario: workstation softphone fault, aligned ticket, defined SIP host and dependencies | `[APPROVED]`; wording and added nodes A-9 | ARCH §9; CONTRACTS §1, §3; DEV-LOG §5 |
| R-4 | One environment-selection authority | `[APPROVED]`; details A-10…A-12 | ARCH §4; CONTRACTS §0, §4; DEV-LOG C-4…C-6 |
| R-5 | No `eval`; browser-driven or controlled interface; goldens from actual behavior | `[APPROVED]`; details A-16, A-17 | ARCH §10; DEV-LOG §6; §5 below |

## 4. Decision register

**`[NEEDS APPROVAL]` = proposed, not yet approved.** Nothing below proceeds without a yes/no.

| ID | Decision | Status |
|---|---|---|
| A-1 | Tool output is a projection, not stored; each `tool.run` records an `outputDigest` (32-bit FNV-1a of the output text) for drift detection | NEEDS APPROVAL |
| A-2 | On rebuild, recorded outcomes and recorded `changes` win; recomputation only yields `replayCheck` drift warnings | NEEDS APPROVAL |
| A-3 | Session stores header (`id`, `exerciseRef` + optional digest, `engine.version`) and `actions[]` only; no copied refs | NEEDS APPROVAL |
| A-4 | Gate order: authorization (`E_UNAUTHORIZED`) → privilege (`E_PRIVILEGE`) → module validate (`E_INVALID`); every outcome recorded on the action | NEEDS APPROVAL |
| A-5 | Authorizations: scopes declared in ticket `requirements.authorizations`; events `auth.request/grant/decline`; sources `simulated` or `remote`; manifest `authorization.mode` | NEEDS APPROVAL |
| A-6 | Privilege: per-node `standard`/`admin`; `priv.elevate`; no expiry; elevation persists across `session.end` in legacy-compat (D-17) | NEEDS APPROVAL |
| A-7 | Legacy-compat UI: the single "Request Elevation" button dispatches `auth.request`→`auth.grant`(simulated)→`priv.elevate`; separate controls deferred | NEEDS APPROVAL |
| A-8 | `TR-8841` stays fixed handshake text; network-change authorization gets its own id (`auth-network-change`) | NEEDS APPROVAL |
| A-9 | Scenario: ticket/voicemail amended (T-1…T-4); desk phone kept as reference device; added `sw01`, `pbx01` (`192.168.1.20`), `sipsrv-pbx01`, `sipreg-204` | NEEDS APPROVAL |
| A-10 | `module` is declared by the environment only; the ticket's requirement must match; manifest has no module field | NEEDS APPROVAL |
| A-11 | Exercise-load cross-validation (requirements met, authorization scopes declared, remote context rules) with `E_REQUIREMENT_UNMET` / `E_AUTH_UNDECLARED` | NEEDS APPROVAL |
| A-12 | Remote contract has no `ticketRef` and no `mode` | NEEDS APPROVAL |
| A-13 | Faults (`activeAtStart`) and the answer key (`outcomes`) live in the environment file; credit weights only in the rubric | NEEDS APPROVAL |
| A-14 | Tool = panel with commands; probes → verification projection; rubric check catalogue `legacy-1` as in CONTRACTS §4 | NEEDS APPROVAL |
| A-15 | `finished` is sticky; `finishedAt` is the first finish; reopening and re-finishing allowed (legacy-compat) | NEEDS APPROVAL |
| A-16 | Parity scope: every baseline golden must match except the deviation register (DEV-LOG §5, T-1…T-4) | NEEDS APPROVAL |
| A-17 | Test method: same-origin iframe, real DOM clicks, record-then-verify goldens, targeted normalization, no product test hook; dev-time only | NEEDS APPROVAL |
| A-18 | Six contracts; manifest carries refs, authorization mode, learner privilege and the rubric | NEEDS APPROVAL |
| U-2 | ES modules + `fetch` JSON (needs an HTTP origin) vs classic scripts with embedded JSON | NEEDS APPROVAL (open since rev 1) |
| U-3 | Fix D-01…D-17 after parity is established, as separate commits and a later rubric version | NEEDS APPROVAL (open since rev 1) |
| U-5 | The answer key is plain JSON on static hosting, readable by learners; accept | NEEDS APPROVAL (open since rev 1) |
| U-7 | Persistence: export first, autosave (header + log only) later | NEEDS APPROVAL (open since rev 1) |
| U-9 | Keep the 6 × 2 scoring as the initial `legacy-1` rubric | NEEDS APPROVAL (open since rev 1) |

Closed: U-1 (by R-3), U-4 (by R-2), U-6 (merged into A-18), U-8 (merged into A-9).

## 5. First implementation step — N1: freeze the baseline and record its actual behavior

Scope: **no product code**. Creates only `legacy/` and `tests/characterize/`. Needs approval of **A-16 and A-17** (the rest do not block it).

**You supply** the original file. The copy in `legacy/` must be byte-for-byte; it cannot be reproduced reliably from a conversation transcript.

1. `legacy/trace-v0.1.html` — copy of the original; `legacy/SHA256.txt` records `sha256sum` of original and copy (must match).
2. `tests/characterize/index.html` — runner page, classic scripts, big pass/fail list readable on a phone; `?mode=record` and `?mode=verify`.
3. `tests/characterize/driver.js` — `load()` (fresh same-origin iframe of `../../legacy/trace-v0.1.html`), `click(text)` (find exactly one visible button/nav item by its text, fail if zero or several, call `.click()`), `choose(id, value)` (set the `<select>` value and dispatch `change`), `until(fn)` (poll every 25 ms, 5 s limit), `snap()` (rendered text of the screen, header chips and nav item classes). **Allowed:** DOM reads and DOM events only. **Forbidden:** `eval`, `Function`, reading `S` or any legacy global, patching or editing the legacy file.
4. `tests/characterize/normalize.js` — targeted rules only: blank the timeline time cells (`.hist-t`) and mask `SIM-\d{4}`. No blanket clock regex (the fixed `ipconfig /all` output contains a literal lease time that must stay as recorded).
5. `tests/characterize/paths.js` — scripted paths, each from a fresh load:
   - **G1** full happy path: ticket → comm reviewed → Begin → connect (wait for "SIMULATED SESSION ACTIVE") → workstation → every panel → all pings, both lookups, SIP check, softphone restart, `ipconfig /all` → record finding "static" → Request Elevation → Apply DHCP → repeat pings/lookups/SIP check → Finish → review.
   - **G2** blind fix (elevate + apply, no diagnosis) → Finish.
   - **G3** apply before elevating (denial banner) → elevate → apply → ping gateway + lookup → Finish.
   - **G4/G5/G6** wrong findings (DNS, ISP, cabling), no fix → Finish.
   - **G7** connect → workstation → Finish immediately.
   - **G8** End Session → click Workstation nav (D-02) → snapshot.
   - **G9** Return to Ticket → snapshot nav states → click Connect nav (D-01).
   - **G10** open four tool tabs only → Finish (D-04).
   - **G11** Finish → Retry → open Connectivity Tests (reset check).
6. `tests/characterize/golden/G*.json` — produced by record mode, not typed by hand.

**Acceptance (all required):**
1. Hashes in `legacy/SHA256.txt` match.
2. Record mode completes every path with no step errors (each click target found exactly once; every wait satisfied).
3. Recording twice yields byte-identical goldens after normalization.
4. Verify mode passes against the committed goldens in the same browser.
5. Review: compare G1's review snapshot and at least three terminal outputs with what you see by hand in the legacy UI; report which of D-01, D-02, D-04, D-05, D-07, D-09, D-17 are **confirmed or refuted** by the recorded behavior, and correct DEV-LOG accordingly.
6. Grep of `tests/characterize/` shows no `eval`, `Function(`, or legacy-global access.
7. No file outside `legacy/` and `tests/characterize/` is added or changed.

**Stop conditions:** if same-origin iframe access is blocked (for example `file://`), stop and report; choose a served origin (GitHub Pages preview or any static server) rather than weakening the method. Report browser(s) and device(s) used.

## 6. After N1

**N2** — externalize the ticket: `data/exercises/ns-voip-01/ticket.json` + `validateTicket` + render the Ticket Desk from it; goldens unchanged except T-1. Then M1 (log + `reduce/rebuild`), per DEV-LOG §7.

## 7. Constraints (carry forward)

Vanilla HTML/CSS/JS, GitHub Pages, no backend/framework/paid service/runtime dependency. Preserve the dark console design; no UI redesign. Keep the networking scenario as data. No `eval`; no expression strings in data. All interpolated text through one complete escaping helper before any importer exists (D-12). Do not claim anything verified unless inspected or executed. No speculative code changes; defect fixes are separate approved changes.

## 8. Reading order

ARCHITECTURE → CONTRACTS → STATE → DEV-LOG → this file.
