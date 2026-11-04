# TRACE — Dev Log (rev 2)

Phase: architecture and audit · Date: 2026-10-19 · Rev 2 applies reviewer corrections R-1…R-5.
The decision register lives in [HANDOFF](HANDOFF.md) §4; this log records findings, contradictions and what changed.

## 0. Audit method and limits

- **Inspected:** the single HTML document supplied in the conversation, read end to end.
- **Not done:** the prototype was **not executed**. Findings are "by reading". No tests, repo, history or earlier checkpoints were supplied; none are assumed. "Generated with Kimi" is stated in the brief and cannot be verified from the code.
- In rev 2 the only checks actually run were: the six JSON examples in CONTRACTS parse as JSON. They were not schema-validated (no validator exists yet).

## 1. Baseline to preserve (P)

| ID | Item |
|---|---|
| P-1 | Dark console design (CSS variables, panels, chips, pills, terminal blocks, mobile bottom nav / desktop side nav, safe-area padding). |
| P-2 | Four-screen flow: Ticket Desk → Remote Support → Customer Computer Environment → Exercise Review. |
| P-3 | Standard-User boundary; admin change denied until a simulated elevation step. |
| P-4 | Tools: overview; `ipconfig`, `ipconfig /all`; pings (gateway, WAN, phone); `nslookup` (two names); SIP check; softphone restart. |
| P-5 | Distractor design: DNS timeouts and failed WAN ping look like DNS/ISP faults but are downstream of the routing fault; four recordable hypotheses. |
| P-6 | Review: six categories 0–2, percent, Resolved/Incomplete/Unresolved, action classification, timeline, retry. |
| P-7 | Training banners; fictional data; zero external dependencies. |

## 2. Hardcoded scenario and lesson logic (H)

| ID | Where (by reading) | What |
|---|---|---|
| H-1 | `TICKET`, `COMM` | ticket, evidence, impact, voicemail |
| H-2 | `vOverview`, `vIpconfig`, `runIpconfigAll`, `runPing`, `runDns`, `vVoip`, `voipCheck`, `softphoneRestart` | every terminal output, IPs, names, each written for broken and fixed |
| H-3 | `findingLabel`, `<select>` in `vHistory` | four hypotheses |
| H-4 | `computeReview`, `renderReview` | rubric text and a "Diagnosed issue" paragraph naming the fault |
| H-5 | `elevate()` | self-grants "training authorization TR-8841 … by customer contact"; no customer interaction exists |
| H-6 | UI strings | "Stage x of 4", "Stages remaining: 3", "scenario NS-VOIP-01", `TOOLS` |

State: one global `let S`, mutated by ~25 functions; `S.stage` is both current screen and progress; full `innerHTML` re-render; inline `onclick` calling globals.

## 3. Defects and risks (D) — by reading, not reproduced

| ID | Sev | Finding |
|---|---|---|
| D-01 | Med | Connect nav lock tests `S.stage<1` (current screen, not progress): after "Return to Ticket" Connect is locked again; "Begin Investigation" re-logs each time. |
| D-02 | Med | `endSession()` leaves `connected` true: Workstation stays reachable and tools/fix still work after "Session Ended"; Remote screen still shows "SIMULATED SESSION ACTIVE"; workstation pill still "Session: Connected". |
| D-03 | Low | `viewTicket` is set only by `go(0)`; reading the ticket at boot then pressing Begin forfeits the Scope point. |
| D-04 | Med | Evidence credit counts tabs **opened** (`selectTool` adds to `toolsRun`), not commands run. |
| D-05 | Med | Finding has no ordering/evidence precondition; `Resolved` and score are not coupled to the finding; elevate → apply → two pings reaches "Resolved" with no diagnosis. |
| D-06 | Low | Permissions = 2 whenever `denied === 0`, even if elevation was never used; text claims it was "used correctly". |
| D-07 | Low | `log()` defaults `cls` to `"helpful"` (navigation counts as Helpful); `flashNav` logs `cls:"unnecessary"`, which is never displayed and is excluded from the empty-check. |
| D-08 | Low | "Verification" counts any two distinct post-fix checks (including the WAN ping); copy says gateway, DNS, SIP. |
| D-09 | Low | Cached terminal HTML (`pingOut`, `dnsOut`, `voipOut`) survives the fix; SIP tiles can say REGISTERED while the terminal block still shows the failure. |
| D-10 | Low | `stamp()` and the session id use `Math.random`, contradicting "deterministic". |
| D-11 | Low | `S` holds `Set`s (not JSON-serializable); `pingOut`, `dnsOut`, `voipOut`, `sid` undeclared in `freshState()`; `connectLog`, `voipChecks`, `softphoneRestarts` unused by scoring. |
| D-12 | **High (latent)** | `esc()` escapes only `&` and `<`; most templates interpolate unescaped. Safe only while all strings are hardcoded. **Must precede any importer.** |
| D-13 | Low | `recordFinding` re-renders only the tool area; "Finding logged" pill is stale. |
| D-14 | Cosmetic | dead `locked` variable; nested `<b>` in header chip; chip says "Standard User" after elevation; desktop `.nav` assumes 57px topbar; connect `setTimeout` not cancellable. |
| D-15 | Scenario | Ticket says the *handset* is not registering; SIP status/restart are a workstation softphone and registration is tied to the workstation's IP. **Resolved by R-3** (§5). |
| D-16 | Low | `TR-8841` means two things: "training grant" in the connect handshake and the elevation authorization. Resolved by A-8. |
| D-17 | Low | `S.elevated` is not reset by `endSession`/`connectSession`; elevation outlives the session. Legacy-compat keeps it `[NEEDS APPROVAL: A-6]`. |

## 4. Schema contradictions found in rev 1 and their resolution

| ID | Contradiction (rev 1) | Resolution (rev 2) |
|---|---|---|
| C-1 | Session stored `status, grants, evidence, remote, findings, verification, completion` **alongside** `actions[]` (two truths). | Log only; all of those are projections (R-1, STATE §3). |
| C-2 | `envRev` stored in observations and verification though derivable from the log. | Derived; observations/verification are projections. |
| C-3 | One "elevated" grant (`grantSources: remote\|training-authorization`) mixed customer consent with technical rights. | Separate authorization and privilege: types, events, projections, denial codes (R-2). |
| C-4 | Environment selected in three places: ticket `requirements.environment.ref`, manifest `refs.environment`, session `refs`. | Manifest only; ticket states requirements; session holds `exerciseRef` (R-4). |
| C-5 | Remote carried `ticketRef` and `mode`, duplicating manifest and ticket. | Removed; relation via manifest, constraint via ticket (A-12). |
| C-6 | `module` declared in manifest, ticket and environment. | Environment is the authority; ticket requirement must match; manifest has none (A-10). |
| C-7 | Services defined in two places (embedded in nodes and top-level); `host` ambiguous (`"softphone-204"`). | Top-level only; `host: {node, software?}`. |
| C-8 | SIP registration "required" reachability to the gateway; the registrar was never modelled. | `pbx01` registrar node/service; `sipreg-204` requires `linkUp`, `resolve`, `reach pbx01`, `serviceState sipsrv-pbx01` (A-9). |
| C-9 | Rubric tool ids (`dns`, `voip`) ≠ environment tool ids (`nslookup`, `sip-status`). | Tool = panel id with commands; `tool.open`/`tool.run` use panel + command (A-14). |
| C-10 | Hypothesis credit duplicated in environment `outcomes` and rubric. | Credit only in rubric; environment lists ids/labels. |
| C-11 | Session `evidence.origin` allowed `tool`, which nothing produced. | Evidence is remote-only; tool output is observations. |
| C-12 | `session.completion.outcome` duplicated the result's `outcome`. | Outcome only in Result. |
| C-13 | `rubricVersion` in session `engine` and in manifest. | Manifest and Result only. |
| C-14 | Ticket `status` read as live status. | Renamed `initialStatus`. |
| C-15 | `finished` modelled as terminal; prototype allows Back to Workspace and a second Finish. | Sticky `finished`, first `finishedAt`, results recomputed from the whole log (A-15). |
| C-16 | Rubric check names (`viewed`, `toolsUsed`, …) were undefined. | Check catalogue in CONTRACTS §4. |
| C-17 | Actor `remote` conflated a subsystem with a role. | Actors: `learner`, `system`, `customer`. |
| C-18 | Rev-1 session example referenced actions it did not contain. | Rewritten as a complete, consistent 15-event log; result example derived from it by hand. |
| C-19 | Classification rules were implicit in free-text labels. | Typed actions and manifest `classification` rules (learner actions only). |
| C-20 | `outcomes` (answer key) sits in an environment file; reuse across exercises impossible. | Accepted: environment files are exercise-specific (A-13). Alternative is moving faults/outcomes into the manifest. |

## 5. Scenario amendment (R-3) and deviation register

The scenario keeps the **workstation softphone** fault. The ticket is aligned to it `[NEEDS APPROVAL: A-9]`; original wording stays in `legacy/`. Everything not listed below must reproduce the baseline's recorded golden output (after normalizing clocks and `SIM-####`).

| ID | Baseline wording (by reading) | Amended wording |
|---|---|---|
| T-1 | Title "Reception VoIP phone cannot connect"; report "The reception phone has stopped registering… Restarting the phone did not resolve…"; device "Reception workstation and IP phone"; facts "The IP phone is powered on." / "Restarting the phone did not help."; voicemail "the reception phone has stopped registering… We have restarted the handset…" | Title "Reception softphone cannot register"; "The reception softphone has stopped registering… Restarting the softphone did not resolve…"; device "Reception workstation (softphone, account 204)"; "The reception desk phone is powered on." / "Restarting the softphone did not help."; voicemail "the reception softphone… We have restarted the softphone…" |
| T-2 | Review "Diagnosed issue": "…which took the reception IP phone out of service." | "…which took the reception softphone line (account 204) out of service." |
| T-3 | Overview tile "Reception IP phone"; VoIP tile "Phone link" | "Reception desk phone"; "Desk phone link" (wording only; phone remains a reference device pinged at `192.168.1.10`) |
| T-4 | Elevation timeline line "Requested simulated elevation — training authorization TR-8841 granted by customer contact" | Timeline reflects `auth.request` / `auth.grant` / `priv.elevate` (A-7, A-8) |

Added to the model, invisible in the UI until a canvas exists: node `sw01` (switch, four ports, four links), node `pbx01` (registrar at `192.168.1.20`, taken from the prototype's `nslookup` answer; the prototype never pings or names it), services `sipsrv-pbx01`, `sipreg-204`. The DNS records and the `ping 192.168.1.10` / `8.8.8.8` outputs are the prototype's own.

## 6. Test gaps and test approach `[APPROVED R-5; details NEEDS APPROVAL: A-17]`

No tests were supplied. The earlier proposal (drive the legacy file via `contentWindow.eval`) is **withdrawn**. Replacement: browser-driven interactions — real clicks and `<select>` changes on the real DOM, observing rendered text — with goldens **recorded from the running baseline**, reviewed by a human, then committed. The harness must not read `S`, call legacy functions, or modify the legacy file. Unit/contract tests for new code are pure-function tests with no hook. Known baseline obstacles to handle in the harness: 1.3 s asynchronous connect (poll for rendered text, do not sleep), random stamps/ids (masks), full-page re-renders (re-query the DOM each step). Whether this works on the user's browsers is **unverified** until N1 is run.

Cases to characterize (paths in HANDOFF §5): correct fix with verification; blind fix; no fix with wrong finding (dns / isp / cable); denied attempt then fix; end-session then navigate (D-02); return-to-ticket nav lock (D-01); open-tabs-only evidence (D-04); retry reset.

## 7. Migration risks

| Risk | Mitigation |
|---|---|
| Scoring drift | `rubricVersion: "legacy-1"` reproduces today's rules (defects included); goldens on scripted paths. Fixes ship later as another rubric. |
| Terminal text drift | per-(tool, command, state) goldens recorded from the baseline; only the deviation register (§5) may differ. |
| Hidden behavior change inside "cleanup" | D-items are logged, not fixed, during migration; each fix is its own approved change (U-3). |
| Replay drift between engine versions | recorded outcomes win; `replayCheck` + `outputDigest` report drift (A-1, A-2). |
| Importer XSS | one complete escaping helper first (D-12). |
| Over-engineering | ~8 files; modules only where a second implementation is foreseeable. |

Order: **M0** freeze + browser-driven characterization → **M1** log + `reduce/rebuild` + injected clock, UI unchanged → **M2** ticket JSON + validator → **M3** networking environment + runtime reproducing goldens → **M4** rubric as data (`legacy-1`) → **M5** remote text provider → **M6** importer → **M7** canvas.

## 8. Rev-1 decision disposition

| Rev-1 | Disposition |
|---|---|
| DEC-001 six contracts | Directionally approved; contract fields amended (this revision). |
| DEC-002 definition/session/result separation | Directionally approved, unchanged. |
| DEC-003 event-sourced session | **Superseded by R-1**: log is the only authority; projections specified. |
| DEC-004 data in JSON, behavior in modules | Directionally approved, unchanged. |
| DEC-005 remote optional, scripted text first | Directionally approved; contract trimmed (A-12). |
| DEC-006 remote info is session evidence | Directionally approved; now a projection of `remote.message` events. |
| DEC-007 legacy preserved, characterize first | Directionally approved; harness method replaced by R-5. |
| DEC-008 defects documented not fixed | Directionally approved, unchanged (U-3 still open). |
| DEC-009 versioning scheme | Directionally approved, unchanged. |
| DEC-010 baseline + faults, "fixed" derived | Directionally approved; `healthy` defined via verification checks. |
| U-1, U-4 | Closed by R-3 and R-2. |
| U-2, U-3, U-5, U-7, U-9 | Carried over, still open (HANDOFF §4). U-6 merged into A-18; U-8 merged into A-9. |

## 9. Not done (by constraint)

No canvas or external dependencies; dark console design preserved.

## 10. Phase 2 Implementation Record (2026-11-04)

### 10.1 Work executed
1. **Baseline frozen:** Byte-for-byte baseline copied to `legacy/trace-v0.1.html`; checksum recorded in `legacy/SHA256.txt`.
2. **Contracts & Exercise Externalization:**
   - Created `data/exercises/ns-voip-01/ticket.json` conforming to `trace.ticket.v1`
   - Created `data/exercises/ns-voip-01/environment.json` conforming to `trace.environment.v1`
   - Created `data/exercises/ns-voip-01/exercise.json` conforming to `trace.exercise.v1`
   - Created `data/exercises/ns-voip-01/remote.json` conforming to `trace.remote.v1`
3. **Core Modular Architecture:**
   - `js/contracts.js`: Schema validators and cross-validation for all contracts.
   - `js/session.js`: Append-only action log with pure projection `reduce`/`rebuild`, deterministic clock and ID generator, FNV-1a output digests.
   - `js/modules/networking.js`: Registered networking module with topology node/link derivations, linkUp, reach, resolve, serviceState, diagnostic command runners (`overview`, `ipconfig`, `ping`, `nslookup`, `voip`), and `net.config.set` action.
   - `js/environment.js`: Environment engine with 5-stage Access Gate (policy -> customer authorization `E_UNAUTHORIZED` -> technical privilege `E_PRIVILEGE` -> module validation `E_INVALID` -> apply changes).
   - `js/remote.js`: Scripted-text customer remote assistance provider.
   - `js/assess.js`: Pure assessment engine implementing rubric `legacy-1` check catalogue (`viewed`, `toolsTouched`, `finding`, `deniedActions`, `fixState`, `postFixProbes`, classification).
   - `js/tickets.js`: Ticket desk view integrating Lovable presentation ideas with strict contract compliance and complete HTML escaping (D-12).
   - `js/ui.js`: Interactive screens for Topbar, Nav, Remote Support, Customer Computer Environment (Workstation), and Exercise Review.
   - `js/app.js`: Application coordinator loading manifest, cross-validating, freezing definitions, and orchestrating runtime flows.
4. **Testing & Invariants:**
   - `tests/unit/`: Contract validation, engine derivation, access gate denial/grant sequence, solvability check, and `rebuild(log) === reduce()` invariant check.
   - `tests/characterize/`: Browser-driven characterization test runner, driver, targeted normalizer, and paths G1..G11.

