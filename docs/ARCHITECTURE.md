# TRACE — Architecture (rev 2)

Status: amended proposal · Phase: architecture and audit · Date: 2026-10-19
Companion docs: [CONTRACTS](CONTRACTS.md) · [STATE](STATE.md) · [HANDOFF](HANDOFF.md) · [DEV-LOG](DEV-LOG.md)

**Approval tags used in all docs:** `[APPROVED]` = reviewer direction (corrections R-1…R-5) · `[NEEDS APPROVAL: A-n]` = proposed, decision in HANDOFF §4 · untagged = directionally approved in rev 1, unchanged.

## 1. Purpose

TRACE is a mobile-first, client-side technical-support and infrastructure simulation. The supplied prototype (one HTML file, one hardcoded networking scenario) becomes a data-driven system: three cooperating subsystems (Tickets, Remote, Environment Engine) over one append-only session log. Vanilla HTML/CSS/JS on GitHub Pages; no backend, framework, paid service or runtime dependency; the dark console design is preserved.

## 2. Principles

1. **Definition ≠ session ≠ result.** Definitions are immutable inputs; the session is the only mutable thing; a result is an immutable output.
2. **The action log is the only authoritative session data.** `[APPROVED R-1]` A session is `{header, actions[]}`. Status, authorizations, privilege, evidence, remote state, findings, observations, verification and completion are **projections**: `project(definitions, log)`. No session field is independently mutable. Anything that cannot be derived from definitions plus earlier log entries (learner intent, customer replies, ids, timestamps, the engine's recorded decision) must be *in* the log. See STATE §1.
3. **Derive, don't store.** Reachability, service state and "is it fixed" are computed from environment + recorded changes, never kept as flags.
4. **No invented facts.** Importers extract what is literally present, tag provenance, record gaps.
5. **Data from JSON, behavior from registered code.** No `eval`, no expression strings in data.
6. **One selection authority per relationship.** `[APPROVED R-4]` See §4.
7. **Small surface.** About eight source files; keep each modest so it stays editable in a mobile editor.

## 3. Subsystems

| | Tickets | Remote | Environment Engine |
|---|---|---|---|
| Contract | `trace.ticket.v1` | `trace.remote.v1` | `trace.environment.v1` |
| Owns | ticket definition; import pipeline; provenance; validation; export | provider interface; scripted responder; customer-side events | topology model; module registry; simulation runtime; **access gate**; fault injection |
| Reads | nothing | ticket needs (via manifest) | ticket requirements (validation only); log projections |
| Appends (via dispatch) | nothing at runtime | `remote.*`, `auth.grant`/`auth.decline` (source `remote`) | `env.*`, `tool.*`, `priv.*`, `auth.grant` (source `simulated`) |
| Never | holds session state; selects an environment | edits the ticket; selects a ticket | renders UI; scores |

- **Tickets** expresses *requirements* (information needs, customer authorizations, environment capabilities). It never names a concrete environment.
- **Remote** is optional. Customer replies are recorded as log events, so a future non-deterministic provider (voice, LLM) replays exactly.
- **Environment Engine** instantiates an environment, enforces access, applies controlled changes, calculates outcomes via module rules. The canvas (later) is a view over the model; every gesture dispatches an action the runtime validates and interprets.

## 4. Selection authority `[APPROVED R-4]`

| Relationship | Authority | Everything else |
|---|---|---|
| Which ticket, environment, remote script an exercise uses | **Exercise manifest** (`ticket`, `environment`, `remote` refs) | Session stores only `exerciseRef`; remote and environment files carry **no** ticket/exercise refs |
| What an environment must provide | **Ticket** `requirements.environment` (module, component types, service types, tool ids) | Checked at exercise load: `E_REQUIREMENT_UNMET` if the selected environment lacks them |
| Which module simulates | **Environment** `module` | Ticket's `requirements.environment.module` must match; the manifest declares no module |
| Whether remote is used | Manifest `remote` (null = off); ticket `remote.mode` (`none/optional/required`) constrains it | `required` + `remote: null` is `E_REQUIREMENT_UNMET` |
| Hypothesis credit | **Rubric** (manifest) | Environment lists hypotheses (ids/labels) but not credit |

## 5. Authorization vs technical privilege `[APPROVED R-2]`

Two different things with different types, grants and enforcement:

| | **Customer authorization** | **Technical privilege** |
|---|---|---|
| Question | "Has the customer approved this change?" | "Does this account have the rights to perform it on that machine?" |
| Declared by | Ticket `requirements.authorizations[]` (scope) | Environment `permissions.levels` (capabilities) |
| Granted by | `auth.grant` — source `remote` (customer reply) or `simulated` (training convenience) `[NEEDS APPROVAL: A-5]` | `priv.elevate` against a node (learner action; environment `permissions.elevation`) |
| Projection | `authorizations[]` (scope, targets, source) | `privilege[nodeId]` = `standard` \| `admin` |
| Denial code | `E_UNAUTHORIZED` | `E_PRIVILEGE` |

Gate order for a config action `[NEEDS APPROVAL: A-4]`: environment policy lookup → **authorization** (`E_UNAUTHORIZED`) → **privilege** (`E_PRIVILEGE`) → module `validate` (`E_INVALID`) → apply. Every outcome, accepted or denied, is recorded on the action.

Legacy-compat `[NEEDS APPROVAL: A-7]`: the prototype's single "Request Elevation (simulated authorization)" button keeps its place and, in the data-driven version, dispatches `auth.request` → `auth.grant` (simulated) then `priv.elevate`. Separate controls are a later, approved UI change. The prototype's `TR-8841` is used for two meanings (connect handshake and elevation, D-16); in the new model it stays as fixed handshake text and the network-change authorization gets its own id `[NEEDS APPROVAL: A-8]`.

## 6. Dependency diagram

```
 import ──► Tickets ──────────────┐ requirements (not selections)
                                  ▼
 Exercise manifest ──selects──► ticket · environment · remote? · rubric
        │                         │  cross-validation at load (§4)
        ▼                         ▼
   Remote (optional)        Environment Engine ◄── Module registry
        │ customer events         │ access gate + simulation   (networking, …)
        └───────────┬─────────────┘
                    ▼  dispatch (append only)
          ┌──────────────────────┐
          │  ACTION LOG (truth)  │──► assess (pure) ──► Result (export)
          └──────────┬───────────┘
                     ▼ project()
              projections ──► UI screens (views only)
```

Arrows are the only allowed imports. Remote and Environment never import each other; the gate reads `authorizations` and `privilege` projections.

## 7. Runtime flow

1. Load manifest → fetch ticket, environment, remote? → validate each → cross-validate (§4) → deep-freeze.
2. Create session: header `{id, exerciseRef, engine}`; append `session.start` and `env.fault.apply` (for each `activeAtStart` fault) as system actions.
3. Learner acts → `dispatch(intent)`.
4. Gate (§5) decides the outcome; the engine appends **one action** carrying intent, outcome and, if accepted, `changes[]`.
5. Incremental `reduce(projections, action)`; UI re-renders from projections. `rebuild(log)` must equal the incremental result.
6. Remote (if enabled): provider reply → appended `remote.message` (customer) with evidence, plus `auth.grant` for each authorization it yields.
7. Finish: `assess(manifest.assessment, projections)` → Result.
8. Retry = new session over the same frozen definitions.

## 8. Module boundaries

A module registers *code*; an exercise supplies *data*.

```js
registerModule({
  id: "networking", version: "1",
  componentTypes: { workstation:{}, router:{}, switch:{}, "ip-phone":{}, "sip-registrar":{} },
  serviceTypes:   { dhcp:{}, dns:{}, "sip-registrar":{}, "sip-registration":{} },
  configSchemas:  { "net.interface": { /* fields: config panels + validation */ } },
  actions: { "net.config.set": { validate(env,p){}, apply(env,p){ /* → changes[] */ } } },
  tools:   { ping: { commands: { ping:{ run(env,target,args){ /* → {text, data:{probes[]}} */ } } } } },
  derive(env){ /* reachability + service state */ },
  checks:  { linkUp(env,p){}, reach(env,p){}, resolve(env,p){}, serviceState(env,p){} }
});
```

- A **tool** is a panel (`overview`, `ipconfig`, `ping`, `dns`, `voip`) holding **commands**; `tool.open` names a panel, `tool.run` names a panel and command. Config changes are actions, not tools.
- Commands return `data.probes[]` (`{check, …params, passed}`); matching a probe to an environment `verification` check is how verification is projected (STATE §3).
- Tickets knows a module only as a string. Adding AD/GPO, Azure or SQL = register a module + ship JSON.
- Unknown module → exercise fails validation (`E_MODULE`), not a crash.

## 9. First scenario, made coherent `[APPROVED R-3]`

The fault is on the **workstation softphone path**. The ticket is amended to say so `[NEEDS APPROVAL: A-9]` (before/after in DEV-LOG §5). The desk IP phone is retained as a healthy **reference device** whose reachability from the workstation is a probe; its own registration is out of scope. Nodes `sw01` (switch) and `pbx01` (SIP registrar at `192.168.1.20`, derived from the prototype's `nslookup` answer) are **added** to make dependencies real `[NEEDS APPROVAL: A-9]`.

```
softphone-204 (software on ws01)        service sipreg-204, host {node: ws01, software: softphone-204}
 ├─ linkUp  ws01.eth0 ── l1 ── sw01
 ├─ resolve sip.northstar-voice.test ──► dns-gw01 (on gw01) ──► 192.168.1.20 = pbx01
 ├─ reach   ws01 ──► pbx01   (same subnet, or via a reachable gateway in own subnet)
 └─ serviceState sipsrv-pbx01 = up       (registrar service on pbx01)

topology: ws01 ─┐
          phone01 ─┤
          gw01 ─┼─ sw01
          pbx01 ─┘
```

Fault `fault-static-ip`: `ws01.eth0` = static `10.0.0.50/24`, gateway `10.0.0.1`, DNS `10.0.0.5`. Derivation: the link is up, but `192.168.1.20` is outside `10.0.0.0/24`; gateway `10.0.0.1` exists on no node → unreachable; DNS `10.0.0.5` exists on no node → resolve fails; so `sipreg-204` is not registered. The WAN ping fails for the same reason (no route), which preserves the prototype's distractor design. Restoring DHCP yields `192.168.1.105`, gateway and DNS `192.168.1.1`, and all three verification checks pass.

## 10. Testing strategy `[APPROVED R-5; details NEEDS APPROVAL: A-17]`

- **No `eval`, no reading of prototype globals, no patching of the legacy file.**
- **Legacy characterization = browser-driven.** A dev-only runner page loads `legacy/trace-v0.1.html` in a same-origin iframe and interacts by clicking real buttons and reading rendered text. Goldens are **recorded from the actual running baseline** (record mode) and committed after human review; verify mode compares. Non-deterministic text (clock stamps, `SIM-####` ids; D-10) is normalized by declared masks, not by changing the file.
- **New code = pure-function tests** (validators, `reduce`/`rebuild` equality, gate, module derive) that import modules directly; they need no test hook.
- A controlled test interface (read-only `snapshot()` behind `?test`) is **not built** unless a later step needs it.
- Tests are dev-time only; the product keeps zero dependencies. Results render as a plain pass/fail list readable on a phone.

## 11. Proposed layout

```
index.html · css/trace.css          shell and current design, unchanged
js/app.js                           boot, screen switching (UI state only)
js/session.js                       log, dispatch, reduce/rebuild, clock/ids, export
js/tickets.js                       validate, import/normalize, export
js/remote.js                        provider interface + scripted-text provider
js/environment.js                   model, runtime, access gate, module registry
js/assess.js                        rubric-check catalogue + interpreter (pure)
js/modules/networking.js            first module
js/ui.js                            screens; one complete escaping helper
data/exercises/ns-voip-01/          exercise.json ticket.json environment.json [remote.json]
legacy/trace-v0.1.html              supplied prototype, untouched
tests/                              characterize/ (browser-driven) · unit/
docs/
```

ES modules + `fetch` need an HTTP origin (fine on Pages, not `file://`); alternative is JSON embedded in classic scripts `[NEEDS APPROVAL: U-2]`.

## 12. Security

The prototype builds screens with `innerHTML` and a partial `esc()`. All interpolated data must pass one complete escaping helper (or `textContent`) **before** any importer ships (DEV-LOG D-12).

## 13. Out of scope for this phase

Canvas, terminal, new modules, voice, UI redesign, persistence, any code change.
