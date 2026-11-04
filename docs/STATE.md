# TRACE — State ownership and lifecycle (rev 2, proposed)

Companion: [CONTRACTS](CONTRACTS.md), [ARCHITECTURE](ARCHITECTURE.md). Tags as in ARCHITECTURE.

## 1. Principle `[APPROVED R-1]`

**The action log is the only authoritative session data.** A session is an immutable header (`id`, `exerciseRef`, `engine.version`) plus an append-only `actions[]`. Every other session-level value is a **projection** computed by `project(definitions, log)`:

`status, connection, viewed, authorizations, privilege, envState/envRev/healthy, observations, probes, verification, remote, evidence, findings, touchedTools, denied counts, completion`

No projection is independently mutable. There is no exception in this revision; if one is ever needed, this principle must be amended explicitly first.

What must be *in* the log (cannot be derived): learner intent; the engine's recorded outcome (`ok/denied/noop/error` + code); recorded `changes[]` for accepted configuration changes; external inputs (customer replies, ids, timestamps). What is *not* stored: tool output text (a deterministic projection; `outputDigest` guards against engine drift `[NEEDS APPROVAL: A-1]`).

## 2. Kinds of state

| Kind | Contents | Mutable? | Writer | Persisted? |
|---|---|---|---|---|
| Definition | exercise, ticket, remote, environment | No (deep-frozen) | loader | repo JSON |
| **Log** | header + `actions[]` | append-only | `dispatch()` only | export / optional autosave |
| Projection | §3 | rebuilt | `reduce()` / `rebuild()` | never as authority |
| Result | score, outcome, category text | No | `assess()` | export only |
| UI | current screen, open tool panel, form drafts, "connecting…" spinner | yes | `ui.js` | never in session export |

## 3. Projection catalogue

| Projection | Source events | Rule |
|---|---|---|
| `status` | `session.*`, `tool.*`, `investigation.finish` | §5 |
| `connection` | `session.connect`, `session.end` | `{connected, connectionId}`; last of the two wins |
| `viewed` | `nav.view` | set of items |
| `authorizations[]` | `auth.grant` (ok) | `{authorizationId, scope, targets?, source, seq}`; `auth.decline` recorded but grants nothing |
| `privilege{node→level}` | `priv.elevate` (ok) | starts at `exercise.learner.privilege`; no expiry in v1 `[NEEDS APPROVAL: A-6]` |
| `envState`, `envRev` | `env.fault.apply`, `env.config.set` (ok) | definition + recorded `changes[]` folded in `seq` order; `envRev` = number of applied change-sets |
| `healthy(rev)` | derived | all `outcomes.verification` checks pass at that rev |
| `fixApplied` | accepted learner `env.config.set` | state after it is `healthy` |
| `observations[]` | `tool.run` | engine renders output from `envState` at that point; compared with `outputDigest`; each carries `envRev` and `probes[]` |
| `postFixProbes` | observations | probe keys (`ping:<target>`, `dns`, `voip`) from observations made while `healthy(envRev)` |
| `verification[]` | observations | for each `outcomes.verification` check: covered if a passing probe with the same check spec was observed while `healthy` |
| `remote` | `remote.start/message/end` | `{status, messages[]}` |
| `evidence[]` | `remote.message` (customer) `params.evidence` | `origin` is always `remote` (tool output is observations, ticket facts stay in the ticket) |
| `findings[]`, `finding` | `finding.record` | latest wins |
| `touchedTools` | `tool.open`, `tool.run` | distinct panel ids |
| `deniedCount` | actions with `outcome.status = denied` | any code |
| `completion` | `investigation.finish` | `{finishedAt (first), finishCount}`; the **outcome** is not stored here, only in the Result |

## 4. Invariants (all testable without a test hook)

1. `rebuild(log)` deep-equals the incrementally reduced projections.
2. Dropping every projection cache changes nothing.
3. Log is append-only; `seq` strictly increasing from 1; entries never edited.
4. `replayCheck(log)` re-runs the access gate and tool rendering against projection-at-that-time and reports **drift** (outcome mismatch, digest mismatch). **Recorded outcomes and changes win** in projections; drift is a warning `[NEEDS APPROVAL: A-2]`.
5. No `Set`, `Map`, `Date`, `undefined` or functions anywhere in a log; time and ids come from an injected clock/id source.
6. Definitions are deep-frozen; mutation attempts throw in dev.

## 5. Lifecycle

Status is a projection (the `finished` rule is `[NEEDS APPROVAL: A-15]`):

```
finished      if any investigation.finish exists
else investigating   if connection.connected and any tool.open|tool.run exists
else connected       if connection.connected
else intake          (not connected: before connect, or after session.end)
```

`ui.screen` (which of the four screens is shown) is separate from `status`. The prototype uses one field, `S.stage`, for both (D-01).

The prototype lets the learner press "Back to Workspace" after Finish and continue, then finish again. Legacy-compat keeps that: `finished` is sticky, `finishedAt` is the first finish, results are recomputed from the whole log. A stricter rule (finish ends the session) is a later change.

**Enforcement path for `env.config.set`** `[NEEDS APPROVAL: A-4]`: policy lookup → `authorizations` projection holds the policy's scope for the target (`E_UNAUTHORIZED`) → `privilege[node]` level has the policy's capability (`E_PRIVILEGE`) → module `validate` (`E_INVALID`) → apply and record `changes`. `priv.elevate` is denied only with `E_ELEVATION_UNAVAILABLE` when `permissions.elevation` does not allow it. Authorization and privilege are separate projections with separate codes `[APPROVED R-2]`.

## 6. Ownership by subsystem

- **Tickets** owns the ticket definition and the import workspace (draft, parse report) — authoring only, never in a session. Runtime read-only.
- **Remote** owns provider internals (transient) and appends `remote.*`, `auth.grant` (source `remote`) as `customer` actor. It never edits the ticket.
- **Environment Engine** owns the derived runtime and the access gate; appends `env.*`, `tool.*`, `priv.*`, `auth.grant` (source `simulated`, actor `system`). Never mutates definitions.
- **Session store** owns ids, ordering, clock, `reduce/rebuild`, export. Only `dispatch` appends.
- **Assess** is stateless: `(assessment, projections) → result`.
- **UI** reads projections, renders, dispatches; holds nothing other code needs.

## 7. Mapping: prototype `S` → proposed

| Prototype | Proposed |
|---|---|
| `stage` | `ui.screen` (progress = `status` projection) |
| `viewTicket`, `viewComm` | `viewed` ← `nav.view` |
| `connected`, `sessionEnded` | `connection` ← `session.connect/end` |
| `connecting` | UI transient |
| `sid` | `connectionId` on `session.connect` |
| `elevated` | **split**: `authorizations[]` (customer) **and** `privilege[ws01]` (technical) |
| `fixed` | derived: `healthy` / `fixApplied` |
| `fixAttempted`, `denied` | derived from `env.config.set` outcomes |
| `tool` | `ui.tool` |
| `toolsRun` | `touchedTools` |
| `postFix` | `postFixProbes` |
| `voipChecks`, `softphoneRestarts`, `connectLog` | dropped (never used by scoring / never read) |
| `finding` | latest of `findings[]` |
| `actions[]` (labels) | typed `actions[]`; labels are render-time strings |
| `clock` | injected clock (removes `Math.random`, D-10) |
| `finished` | `completion` / `status` |
| `pingOut`, `dnsOut`, `voipOut` | UI cache or latest `observations[]` entry per command; staleness rule deferred (D-09) |

## 8. Persistence and export (later; deferred)

Export `trace.session.v1` / `trace.result.v1` as JSON via `Blob`. Optional autosave `localStorage["trace.session.<id>"]` stores **header + log only**, wrapped in try/catch; on load the schema is validated and projections rebuilt. Multi-tab: last write wins, unsupported in v1.
