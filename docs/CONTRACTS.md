# TRACE — Contracts (rev 2, proposed)

Nothing here is implemented. Examples use data from the supplied prototype unless marked *amended*, *added* or *illustrative*. Tags as in ARCHITECTURE. Changes from rev 1 are itemised in DEV-LOG §4.

## 0. Conventions

| Topic | Rule |
|---|---|
| Schema tag | `"schema": "trace.<name>.v<major>"` on every object. |
| Contracts | `trace.ticket.v1`, `trace.remote.v1`, `trace.environment.v1`, `trace.exercise.v1` (manifest + rubric), `trace.session.v1`, `trace.result.v1`. |
| Ids | `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, unique within their array/file. |
| Cross-file refs | `{ "schema": "...", "id": "..." }`. **Only the exercise manifest holds refs to other definitions** `[APPROVED R-4]`. Remote and environment files hold none. |
| Unknown data | `null` plus an entry in `gaps[]`; never a guess. |
| Source wall-clock | `{ "date", "time", "tz" }`, `tz: null` if unstated. |
| Runtime timestamps | ISO-8601 UTC from the injected clock. |
| Extensions | unknown keys must start with `x-`; others produce `W_UNKNOWN_KEY`. |
| Validation result | `{ ok, errors:[{path,code,message}], warnings:[…] }`. Codes: `E_SCHEMA E_TYPE E_REQUIRED E_ENUM E_REF E_DUP_ID E_MODULE E_REQUIREMENT_UNMET E_AUTH_UNDECLARED W_GAP W_UNKNOWN_KEY`. |
| Runtime outcome codes | `E_UNAUTHORIZED E_PRIVILEGE E_INVALID E_ELEVATION_UNAVAILABLE`. |
| Immutability | ticket, remote, environment, exercise are deep-frozen after validation. |

Versioning: additive optional fields do not bump; rename/removal/type change/new required field bumps major; `migrate` map per schema; unknown major → refuse (`E_SCHEMA`). A result records engine and rubric versions.

---

## 1. `trace.ticket.v1`

A normalized incident with provenance, plus what is missing and what the exercise will need. Definition only.

| Field | Type | Req | Notes |
|---|---|---|---|
| `schema`, `id`, `title` | string | ✔ | |
| `priority` | `{level: P1..P4\|null, label}` \| null | | |
| `initialStatus` | enum `open\|in_progress\|resolved\|closed` | ✔ | status at creation; runtime status is never stored here |
| `created` | `{date,time,tz}` \| null | | |
| `customer` | `{name, site}` | | |
| `service` | string \| null | | |
| `affected` | `{device, user}` | | |
| `report` | `{text, sourceId}` | ✔ | customer's words |
| `impact` | `{text, sourceId}` \| null | | |
| `facts[]` | `{id, text, status: confirmed\|reported\|unconfirmed, sourceId, span?}` | ✔ | |
| `unknowns[]` | `{id, text, kind: missing\|ambiguous\|unconfirmed}` | ✔ | |
| `sources[]` | `{id, type, label, raw, receivedAt?, origin, parser?}` | ✔ | `raw` preserved exactly |
| `requirements.remote` | `{mode: none\|optional\|required, infoNeeds[]}` | ✔ | `infoNeeds[]`: `{id, unknownId?, question, blocking}` — **information only** |
| `requirements.authorizations[]` | `{id, scope, description}` | ✔ | customer authorizations the scenario may require `[APPROVED R-2]` |
| `requirements.environment` | `{module, componentTypes[], serviceTypes[], toolIds[]}` | ✔ | a **requirement**, not a selection `[APPROVED R-4]` |
| `gaps[]` | `{path, reason}` | ✔ | |
| `meta` | `{origin: authored\|imported\|generated, generator?, importedFrom?, amendedFrom?}` | ✔ | |

Validation: `sourceId`s resolve; ids unique; authorization scopes unique; `infoNeeds[].unknownId` resolves; for `origin: imported`, `report.text` is a substring of its source `raw`; `gaps` lists every null field the schema expects.

*Amended* example (aligned to the softphone scenario `[NEEDS APPROVAL: A-9]`; original wording preserved in `legacy/`):

```json
{
  "schema": "trace.ticket.v1",
  "id": "INC-1042",
  "title": "Reception softphone cannot register",
  "priority": { "level": "P2", "label": "High" },
  "initialStatus": "open",
  "created": { "date": "2026-10-19", "time": "09:12", "tz": null },
  "customer": { "name": "Northstar Business Services", "site": "Manchester Office — Reception" },
  "service": "Business VoIP",
  "affected": { "device": "Reception workstation (softphone, account 204)", "user": "Reception Support" },
  "report": {
    "text": "The reception softphone has stopped registering. The receptionist says the computer is also showing intermittent connectivity issues. Restarting the softphone did not resolve the problem.",
    "sourceId": "src-ticket"
  },
  "impact": { "text": "Incoming reception calls may be missed.", "sourceId": "src-ticket" },
  "facts": [
    { "id": "f1", "text": "The workstation is powered on.", "status": "reported", "sourceId": "src-ticket" },
    { "id": "f2", "text": "The reception desk phone is powered on.", "status": "reported", "sourceId": "src-ticket" },
    { "id": "f3", "text": "Restarting the softphone did not help.", "status": "reported", "sourceId": "src-ticket" }
  ],
  "unknowns": [ { "id": "u1", "text": "The underlying cause has not been confirmed.", "kind": "ambiguous" } ],
  "sources": [
    { "id": "src-ticket", "type": "ticket-text", "label": "Ticket INC-1042", "origin": "authored",
      "raw": "The reception softphone has stopped registering. The receptionist says the computer is also showing intermittent connectivity issues. Restarting the softphone did not resolve the problem.\nIncoming reception calls may be missed.\nThe workstation is powered on.\nThe reception desk phone is powered on.\nRestarting the softphone did not help." },
    { "id": "src-voicemail", "type": "voicemail-transcript", "label": "Customer voicemail", "origin": "authored",
      "receivedAt": { "date": null, "time": "09:31", "tz": null },
      "raw": "Hi Support, the reception softphone has stopped registering and the PC has been unreliable this morning. We have restarted the softphone, but the problem remains. Please investigate." }
  ],
  "requirements": {
    "remote": { "mode": "optional", "infoNeeds": [] },
    "authorizations": [
      { "id": "auth-network-change", "scope": "network-change",
        "description": "Customer approval to change network settings on the reception workstation" }
    ],
    "environment": {
      "module": "networking",
      "componentTypes": ["workstation", "router", "switch", "sip-registrar"],
      "serviceTypes": ["dhcp", "dns", "sip-registration"],
      "toolIds": ["overview", "ipconfig", "ping", "dns", "voip"]
    }
  },
  "gaps": [ { "path": "created.tz", "reason": "source gives no timezone" } ],
  "meta": { "origin": "authored", "amendedFrom": "trace-v0.1 prototype" }
}
```

### Import rules (Phase 2+, not built)

Inputs in order: (1) `trace.ticket.v1` JSON, (2) plain-text ticket (`Key: value` + free text), (3) raw attachments (logs, `ipconfig` output, config) kept as `sources[]` and parsed only for literal values. Parsers return `{ticket, gaps, warnings}`. A field is filled only if its text appears in a source; facts keep `sourceId` and `span`. Priority, impact and root cause are never inferred. Everything interpolated into the UI is escaped (D-12).

---

## 2. `trace.remote.v1`

How a simulated customer responds. Definition only; the conversation exists only as log events. **No `ticketRef`, no `mode`** (relation and enablement are the manifest's; the constraint is the ticket's) `[NEEDS APPROVAL: A-12]`.

| Field | Type | Req | Notes |
|---|---|---|---|
| `schema`, `id` | string | ✔ | |
| `channels` | `["text"]` now; `"voice"` later | ✔ | |
| `provider` | `{type: "scripted-text", version}` | ✔ | no vendor in core |
| `persona` | `{name, role}` | | |
| `opening` | string \| null | | |
| `responses[]` | `{id, match:{any:[phrases]}, reply, answers?[needIds], grants?[authorizationIds], evidence?[{text}]}` | ✔ | first match by order; deterministic |
| `fallback` | string | ✔ | |

Context validation (at exercise load, against the manifest's ticket): `answers[]` ⊆ ticket `infoNeeds` ids; `grants[]` ⊆ ticket `requirements.authorizations` ids; every `blocking` need has a response; if `authorization.mode` is `remote`, every ticket authorization is granted by some response; if the ticket's `remote.mode` is `required`, the manifest's `remote` is non-null.

Provider interface (code): `{ id, channels, start(ctx), send(message) → Promise<{reply, answers[], grants[], evidence[]}>, end() }`. The caller appends `remote.message` events and one `auth.grant` per returned grant. A voice provider later implements the same interface; the canonical transcript stays text.

*Illustrative* (not in the prototype; the baseline ships with `remote: null`):

```json
{
  "schema": "trace.remote.v1",
  "id": "rem-ns-voip-01",
  "channels": ["text"],
  "provider": { "type": "scripted-text", "version": "1" },
  "persona": { "name": "Reception Support", "role": "Receptionist" },
  "opening": null,
  "responses": [
    { "id": "r-auth",
      "match": { "any": ["authorise", "authorize", "okay to change", "ok to change", "permission"] },
      "reply": "Yes, you have my approval to change the network settings on this PC.",
      "grants": ["auth-network-change"] }
  ],
  "fallback": "Sorry, I'm not sure about that. The PC has been unreliable and the phone line isn't working."
}
```

---

## 3. `trace.environment.v1`

Topology, configuration, services, access rules, faults and expected outcomes. Definition only. Environment files are exercise-specific; faults and outcomes live here `[NEEDS APPROVAL: A-13]`.

| Field | Type | Req | Notes |
|---|---|---|---|
| `schema`, `id`, `module`, `title` | string | ✔ | `module` must be registered; it is the single authority |
| `nodes[]` | `{id, type, label, layout:{x,y}, interfaces[], software[]?, config?, role?}` | ✔ | `type` ∈ module `componentTypes` |
| `interfaces[]` | `{id, kind, mac?, config?}` | | id = `<nodeId>.<name>` |
| `software[]` | `{id, type, config}` | | runs on its node |
| `links[]` | `{id, a, b, medium, status}` | ✔ | endpoints are interface ids |
| `services[]` | `{id, type, host:{node, software?}, config?, requires?[]}` | | **the only place services are defined** |
| `permissions` | `{levels:{<level>:[caps]}, elevation:{method, to}, policies:{<actionType>:{privilege, authorization?}}}` | ✔ | |
| `tools[]` | `{id, on, commands[]}` | ✔ | panels; commands ∈ module |
| `faults[]` | `{id, activeAtStart, target, set}` | | |
| `outcomes` | `{hypotheses[{id,label}], rootCause:{faultId,hypothesisId}, fixes[], verification[]}` | ✔ | answer key; **no credit weights here** |

Validation: ids unique; link endpoints resolve and each interface is linked once; `service.host.node` (and `software`) resolve; `requires[]` use known module checks; static IPs unique; DHCP reservations resolve and sit inside the subnet; DNS record values for a registrar name equal an interface IP of the `expectNode`; tools/commands/actions/checks exist in the module; fault paths resolve; `rootCause` ids resolve; every `verification[].check` is a known module check; **solvability test**: applying `fixes` to the baseline-plus-faults model satisfies all verification checks. `permissions.policies[*].authorization` scopes must be declared by the ticket (checked at exercise load, `E_AUTH_UNDECLARED`).

Example (`env-ns-voip-01`; nodes `sw01`, `pbx01` and their links/services are *added* `[NEEDS APPROVAL: A-9]`):

```json
{
  "schema": "trace.environment.v1",
  "id": "env-ns-voip-01",
  "module": "networking",
  "title": "Northstar Manchester — reception",
  "nodes": [
    { "id": "ws01", "type": "workstation", "label": "MCR-REC-WS01", "layout": { "x": 80, "y": 160 },
      "interfaces": [ { "id": "ws01.eth0", "kind": "ethernet", "mac": "8C-16-45-2F-9B-71", "config": { "mode": "dhcp" } } ],
      "software": [ { "id": "softphone-204", "type": "sip-client", "config": { "account": "204", "registrar": "sip.northstar-voice.test" } } ] },
    { "id": "phone01", "type": "ip-phone", "label": "Reception desk phone", "role": "reference-device", "layout": { "x": 80, "y": 40 },
      "interfaces": [ { "id": "phone01.eth0", "kind": "ethernet", "config": { "mode": "static", "ip": "192.168.1.10", "mask": "255.255.255.0", "gateway": "192.168.1.1" } } ] },
    { "id": "gw01", "type": "router", "label": "gateway.local", "layout": { "x": 400, "y": 160 },
      "config": { "uplink": { "reachable": ["8.8.8.8"] } },
      "interfaces": [ { "id": "gw01.eth0", "kind": "ethernet", "config": { "mode": "static", "ip": "192.168.1.1", "mask": "255.255.255.0" } } ] },
    { "id": "sw01", "type": "switch", "label": "Office switch", "layout": { "x": 240, "y": 100 },
      "interfaces": [ { "id": "sw01.p1", "kind": "ethernet" }, { "id": "sw01.p2", "kind": "ethernet" },
                      { "id": "sw01.p3", "kind": "ethernet" }, { "id": "sw01.p4", "kind": "ethernet" } ] },
    { "id": "pbx01", "type": "sip-registrar", "label": "Voice platform", "layout": { "x": 400, "y": 40 },
      "interfaces": [ { "id": "pbx01.eth0", "kind": "ethernet", "config": { "mode": "static", "ip": "192.168.1.20", "mask": "255.255.255.0", "gateway": "192.168.1.1" } } ] }
  ],
  "links": [
    { "id": "l1", "a": "ws01.eth0",    "b": "sw01.p1", "medium": "cat6", "status": "up" },
    { "id": "l2", "a": "phone01.eth0", "b": "sw01.p2", "medium": "cat6", "status": "up" },
    { "id": "l3", "a": "gw01.eth0",    "b": "sw01.p3", "medium": "cat6", "status": "up" },
    { "id": "l4", "a": "pbx01.eth0",   "b": "sw01.p4", "medium": "cat6", "status": "up" }
  ],
  "services": [
    { "id": "dhcp-gw01", "type": "dhcp", "host": { "node": "gw01" },
      "config": { "subnet": "192.168.1.0/24", "gateway": "192.168.1.1", "dns": ["192.168.1.1"],
                  "reservations": { "ws01.eth0": "192.168.1.105" } } },
    { "id": "dns-gw01", "type": "dns", "host": { "node": "gw01" },
      "config": { "records": { "voice.example.test": "192.168.1.20", "sip.northstar-voice.test": "192.168.1.20" } } },
    { "id": "sipsrv-pbx01", "type": "sip-registrar", "host": { "node": "pbx01" }, "config": { "domain": "northstar-voice.test" } },
    { "id": "sipreg-204", "type": "sip-registration", "host": { "node": "ws01", "software": "softphone-204" },
      "requires": [
        { "check": "linkUp", "interface": "ws01.eth0" },
        { "check": "resolve", "from": "ws01", "name": "sip.northstar-voice.test", "expectNode": "pbx01" },
        { "check": "reach", "from": "ws01", "to": "pbx01" },
        { "check": "serviceState", "service": "sipsrv-pbx01", "state": "up" }
      ] }
  ],
  "permissions": {
    "levels": { "standard": ["tool.run", "env.read"], "admin": ["tool.run", "env.read", "config.write"] },
    "elevation": { "method": "simulated", "to": "admin" },
    "policies": { "net.config.set": { "privilege": "config.write", "authorization": "network-change" } }
  },
  "tools": [
    { "id": "overview", "on": "ws01", "commands": [] },
    { "id": "ipconfig", "on": "ws01", "commands": ["ipconfig", "ipconfig-all"] },
    { "id": "ping",     "on": "ws01", "commands": ["ping"] },
    { "id": "dns",      "on": "ws01", "commands": ["nslookup"] },
    { "id": "voip",     "on": "ws01", "commands": ["sip-register-check", "sip-restart"] }
  ],
  "faults": [
    { "id": "fault-static-ip", "activeAtStart": true, "target": "ws01.eth0",
      "set": { "config": { "mode": "static", "ip": "10.0.0.50", "mask": "255.255.255.0", "gateway": "10.0.0.1", "dns": ["10.0.0.5"] } } }
  ],
  "outcomes": {
    "hypotheses": [
      { "id": "static-ip",   "label": "Incorrect static IP configuration (off-subnet)" },
      { "id": "dns-failure", "label": "DNS server failure" },
      { "id": "isp-outage",  "label": "ISP / WAN outage" },
      { "id": "cabling-nic", "label": "Physical cabling / NIC fault" }
    ],
    "rootCause": { "faultId": "fault-static-ip", "hypothesisId": "static-ip" },
    "fixes": [ { "action": "net.config.set", "target": "ws01.eth0", "set": { "config": { "mode": "dhcp" } } } ],
    "verification": [
      { "id": "v-gw",  "check": "reach",   "from": "ws01", "to": "gw01" },
      { "id": "v-dns", "check": "resolve", "from": "ws01", "name": "voice.example.test", "expectNode": "pbx01" },
      { "id": "v-sip", "check": "serviceState", "service": "sipreg-204", "state": "registered" }
    ]
  }
}
```

Module checks used above: `linkUp`, `reach`, `resolve`, `serviceState`. `healthy` = all `outcomes.verification` checks pass in the current derived state.

---

## 4. `trace.exercise.v1` (manifest)

The only file that selects other definitions `[APPROVED R-4]`.

| Field | Type | Notes |
|---|---|---|
| `schema`, `id`, `title` | string | no `module` field |
| `ticket`, `environment` | ref | required |
| `remote` | ref \| null | null = remote off |
| `authorization` | `{mode: simulated\|remote}` | how customer authorizations are obtained `[NEEDS APPROVAL: A-5]` |
| `learner` | `{privilege: "standard"}` | initial level on every node |
| `assessment` | `{rubricVersion, maxPerCategory, categories[], outcomeRules[], classification:{appliesTo, rules[]}}` | see below |

Load-time cross-validation: ticket/environment/remote each valid; environment `module` equals ticket `requirements.environment.module` and is registered; environment satisfies the ticket's component/service/tool requirements (`E_REQUIREMENT_UNMET`); remote context rules (§2); every policy authorization scope is declared by the ticket (`E_AUTH_UNDECLARED`); rubric ids (hypotheses, tools, checks) resolve.

```json
{
  "schema": "trace.exercise.v1",
  "id": "ns-voip-01",
  "title": "Reception softphone cannot register",
  "ticket":      { "schema": "trace.ticket.v1",      "id": "INC-1042" },
  "environment": { "schema": "trace.environment.v1", "id": "env-ns-voip-01" },
  "remote": null,
  "authorization": { "mode": "simulated" },
  "learner": { "privilege": "standard" },
  "assessment": {
    "rubricVersion": "legacy-1",
    "maxPerCategory": 2,
    "categories": [
      { "id": "scope",        "check": "viewed",       "params": { "items": ["ticket", "communication"] }, "perItem": 1 },
      { "id": "evidence",     "check": "toolsTouched", "params": { "tools": ["ipconfig", "ping", "dns", "voip"] },
        "thresholds": [ { "min": 3, "points": 2 }, { "min": 2, "points": 1 }, { "min": 1, "points": 1 } ] },
      { "id": "reasoning",    "check": "finding",
        "params": { "static-ip": 2,
                    "dns-failure": { "points": 1, "requiresToolsTouchedMin": 3 },
                    "isp-outage":  { "points": 1, "requiresToolsTouchedMin": 3 },
                    "cabling-nic": 0, "none": 0 } },
      { "id": "permissions",  "check": "deniedActions", "thresholds": [ { "eq": 0, "points": 2 }, { "else": true, "points": 1 } ] },
      { "id": "corrective",   "check": "fixState",      "params": { "applied": 2, "attemptedOnly": 1, "none": 0 } },
      { "id": "verification", "check": "postFixProbes", "thresholds": [ { "min": 2, "points": 2 }, { "min": 1, "points": 1 } ] }
    ],
    "outcomeRules": [
      { "outcome": "resolved",   "when": { "fixApplied": true, "postFixProbesMin": 2 } },
      { "outcome": "incomplete", "when": { "fixApplied": true } },
      { "outcome": "unresolved", "when": "else" }
    ],
    "classification": { "appliesTo": "learner-actions", "rules": [
      { "class": "blocked",      "when": { "outcome": "denied" } },
      { "class": "incorrect",    "when": { "type": "finding.record", "hypothesis": "cabling-nic" } },
      { "class": "inconclusive", "when": { "type": "finding.record", "hypothesisIn": ["dns-failure", "isp-outage"] } },
      { "class": "inconclusive", "when": { "type": "tool.run", "healthy": false } },
      { "class": "unnecessary",  "when": { "type": "nav.blocked" } },
      { "class": "helpful",      "when": "else" }
    ] }
  }
}
```

### Rubric check catalogue (`legacy-1`) `[NEEDS APPROVAL: A-14]`

Every check is a pure function over projections (STATE §3). `legacy-1` encodes the prototype's current rules, defects included (D-03…D-08); improvements ship as a separate `rubricVersion`.

| Check | Definition |
|---|---|
| `viewed` | distinct `nav.view` items ∩ `params.items`, × `perItem` |
| `toolsTouched` | distinct panel ids with a `tool.open` **or** `tool.run`, ∩ `params.tools` (legacy credits opening, D-04) |
| `finding` | latest `finding.record`; points by hypothesis id; `requiresToolsTouchedMin` counts **all** touched panels incl. `overview` (legacy `toolsRun.size`) |
| `deniedActions` | count of actions with `outcome.status = "denied"` (either `E_UNAUTHORIZED` or `E_PRIVILEGE`) |
| `fixState` | `applied` if an accepted learner `env.config.set` leaves the environment `healthy`; `attemptedOnly` if only denied `env.config.set` exist; else `none` |
| `postFixProbes` | count of distinct probe keys from `tool.run` results observed while `healthy`; keys: `ping:<target>`, `dns`, `voip` (legacy-1 counts a WAN ping as one, D-08) |

---

## 5. `trace.session.v1`

**Stored: header + action log. Nothing else.** `[APPROVED R-1]` Projections (status, authorizations, privilege, observations, evidence, remote state, findings, verification, completion) are specified in STATE §3 and are never exported as authority; if a snapshot is cached or autosaved it is discarded and rebuilt on load.

| Field | Type | Notes |
|---|---|---|
| `schema`, `id` | string | id from the injected id source |
| `exerciseRef` | ref (+ optional `digest`) | the only reference; definitions resolve through the manifest |
| `engine` | `{version}` | rubric version belongs to the manifest/result, not here |
| `actions[]` | append-only, `seq` strictly increasing from 1 | below |

Action: `{seq, at, actor: learner|system|customer, type, params, outcome:{status: ok|denied|noop|error, code?, message?}, changes?[{path,from,to}], outputDigest?}`.

The log records (a) learner intent, (b) the engine's **recorded outcome** and, if accepted, the **recorded changes**, and (c) external inputs (customer replies, ids, timestamps). Tool output is **not** stored: it is a deterministic projection; `outputDigest` (32-bit FNV-1a of the output text) is an integrity check used by `replayCheck` to report engine drift `[NEEDS APPROVAL: A-1]`. On rebuild, recorded outcomes and changes win; recomputation only produces drift warnings `[NEEDS APPROVAL: A-2]`.

| Type | Actor | `params` | Typical outcomes |
|---|---|---|---|
| `session.start` | system | `{}` | ok |
| `env.fault.apply` | system | `{faultId}` + `changes` | ok |
| `nav.view` | learner | `{item: ticket\|communication}` | ok |
| `nav.blocked` | learner | `{screen}` | noop |
| `session.connect` / `session.end` | learner | `{connectionId}` / `{}` | ok |
| `tool.open` | learner | `{tool}` | ok |
| `tool.run` | learner | `{tool, command, args}` + `outputDigest` | ok |
| `auth.request` | learner | `{scope, target?}` | ok |
| `auth.grant` | system \| customer | `{authorizationId, scope, targets?, source: simulated\|remote}` | ok |
| `auth.decline` | system \| customer | `{scope, source}` | ok |
| `priv.elevate` | learner | `{target, to}` | ok · denied `E_ELEVATION_UNAVAILABLE` |
| `env.config.set` | learner | `{action, target, set}` + `changes` | ok · denied `E_UNAUTHORIZED` / `E_PRIVILEGE` · error `E_INVALID` |
| `remote.start` / `remote.end` | system | `{}` | ok |
| `remote.message` | learner \| customer | `{channel, text, responseId?, evidence?[{id,text}]}` | ok |
| `finding.record` | learner | `{hypothesisId}` | ok |
| `investigation.finish` | learner | `{}` | ok (may repeat; see STATE §5, `[NEEDS APPROVAL: A-15]`) |

Example — a complete, minimal log (real logs also contain `nav.view` of the communication and `tool.open` events):

```json
{
  "schema": "trace.session.v1",
  "id": "ses-20261019-0001",
  "exerciseRef": { "schema": "trace.exercise.v1", "id": "ns-voip-01" },
  "engine": { "version": "0.2.0" },
  "actions": [
    { "seq": 1,  "at": "2026-10-19T09:41:05Z", "actor": "system",  "type": "session.start", "params": {}, "outcome": { "status": "ok" } },
    { "seq": 2,  "at": "2026-10-19T09:41:05Z", "actor": "system",  "type": "env.fault.apply", "params": { "faultId": "fault-static-ip" }, "outcome": { "status": "ok" },
      "changes": [ { "path": "ws01.eth0.config", "from": { "mode": "dhcp" }, "to": { "mode": "static", "ip": "10.0.0.50", "mask": "255.255.255.0", "gateway": "10.0.0.1", "dns": ["10.0.0.5"] } } ] },
    { "seq": 3,  "at": "2026-10-19T09:41:40Z", "actor": "learner", "type": "nav.view", "params": { "item": "ticket" }, "outcome": { "status": "ok" } },
    { "seq": 4,  "at": "2026-10-19T09:42:10Z", "actor": "learner", "type": "session.connect", "params": { "connectionId": "SIM-4821" }, "outcome": { "status": "ok" } },
    { "seq": 5,  "at": "2026-10-19T09:44:12Z", "actor": "learner", "type": "tool.run", "params": { "tool": "ping", "command": "ping", "args": { "target": "192.168.1.1" } }, "outcome": { "status": "ok" }, "outputDigest": "9c1f07a2" },
    { "seq": 6,  "at": "2026-10-19T09:46:30Z", "actor": "learner", "type": "finding.record", "params": { "hypothesisId": "static-ip" }, "outcome": { "status": "ok" } },
    { "seq": 7,  "at": "2026-10-19T09:48:02Z", "actor": "learner", "type": "env.config.set", "params": { "action": "net.config.set", "target": "ws01.eth0", "set": { "config": { "mode": "dhcp" } } },
      "outcome": { "status": "denied", "code": "E_UNAUTHORIZED", "message": "authorization scope network-change not held" } },
    { "seq": 8,  "at": "2026-10-19T09:48:30Z", "actor": "learner", "type": "auth.request", "params": { "scope": "network-change", "target": "ws01" }, "outcome": { "status": "ok" } },
    { "seq": 9,  "at": "2026-10-19T09:48:30Z", "actor": "system",  "type": "auth.grant", "params": { "authorizationId": "auth-network-change", "scope": "network-change", "targets": ["ws01"], "source": "simulated" }, "outcome": { "status": "ok" } },
    { "seq": 10, "at": "2026-10-19T09:48:55Z", "actor": "learner", "type": "env.config.set", "params": { "action": "net.config.set", "target": "ws01.eth0", "set": { "config": { "mode": "dhcp" } } },
      "outcome": { "status": "denied", "code": "E_PRIVILEGE", "message": "config.write required on ws01" } },
    { "seq": 11, "at": "2026-10-19T09:49:20Z", "actor": "learner", "type": "priv.elevate", "params": { "target": "ws01", "to": "admin" }, "outcome": { "status": "ok" } },
    { "seq": 12, "at": "2026-10-19T09:49:45Z", "actor": "learner", "type": "env.config.set", "params": { "action": "net.config.set", "target": "ws01.eth0", "set": { "config": { "mode": "dhcp" } } }, "outcome": { "status": "ok" },
      "changes": [ { "path": "ws01.eth0.config", "from": { "mode": "static", "ip": "10.0.0.50" }, "to": { "mode": "dhcp" } } ] },
    { "seq": 13, "at": "2026-10-19T09:50:30Z", "actor": "learner", "type": "tool.run", "params": { "tool": "ping", "command": "ping", "args": { "target": "192.168.1.1" } }, "outcome": { "status": "ok" }, "outputDigest": "41be5d90" },
    { "seq": 14, "at": "2026-10-19T09:51:05Z", "actor": "learner", "type": "tool.run", "params": { "tool": "dns", "command": "nslookup", "args": { "name": "voice.example.test" } }, "outcome": { "status": "ok" }, "outputDigest": "d27a3c18" },
    { "seq": 15, "at": "2026-10-19T09:58:30Z", "actor": "learner", "type": "investigation.finish", "params": {}, "outcome": { "status": "ok" } }
  ]
}
```

(Digest values are placeholders, not computed.)

---

## 6. `trace.result.v1`

Immutable output of `assess(manifest.assessment, projections)`; reproducible from the same inputs.

| Field | Type | Notes |
|---|---|---|
| `schema`, `id` | string | |
| `sessionRef` | ref | |
| `exerciseRef` | ref | denormalized echo so a result is readable alone (derived artifact; not an authority) |
| `assessedThroughSeq` | integer | last log `seq` included |
| `engine`, `rubricVersion`, `generatedAt` | | |
| `outcome` | enum `resolved\|incomplete\|unresolved` | the only place outcome is stored |
| `score` | `{points, max, percent}` | `round(points/max*100)` |
| `categories[]` | `{id, points, max, explanation}` | |
| `finalFinding` | `{hypothesisId, seq}` \| null | |
| `correctiveAction` | `{applied, seq?}` | |
| `verification[]` | `{checkId, covered, passed?}` | from the verification projection |
| `classification` | `{helpful, inconclusive, blocked, incorrect, unnecessary}` counts | from manifest rules |

Example consistent with the log in §5:

```json
{
  "schema": "trace.result.v1",
  "id": "res-ses-20261019-0001",
  "sessionRef": { "schema": "trace.session.v1", "id": "ses-20261019-0001" },
  "exerciseRef": { "schema": "trace.exercise.v1", "id": "ns-voip-01" },
  "assessedThroughSeq": 15,
  "engine": { "version": "0.2.0" },
  "rubricVersion": "legacy-1",
  "generatedAt": "2026-10-19T09:58:31Z",
  "outcome": "resolved",
  "score": { "points": 9, "max": 12, "percent": 75 },
  "categories": [
    { "id": "scope",        "points": 1, "max": 2, "explanation": "Ticket reviewed; customer communication not reviewed." },
    { "id": "evidence",     "points": 1, "max": 2, "explanation": "2 of 4 diagnostic tools used (ping, dns)." },
    { "id": "reasoning",    "points": 2, "max": 2, "explanation": "Recorded finding matched the actual fault." },
    { "id": "permissions",  "points": 1, "max": 2, "explanation": "2 changes attempted before authorization/privilege were in place; both blocked." },
    { "id": "corrective",   "points": 2, "max": 2, "explanation": "DHCP restored through the authorized, elevated change." },
    { "id": "verification", "points": 2, "max": 2, "explanation": "2 post-fix probes passed." }
  ],
  "finalFinding": { "hypothesisId": "static-ip", "seq": 6 },
  "correctiveAction": { "applied": true, "seq": 12 },
  "verification": [
    { "checkId": "v-gw",  "covered": true,  "passed": true },
    { "checkId": "v-dns", "covered": true,  "passed": true },
    { "checkId": "v-sip", "covered": false }
  ],
  "classification": { "helpful": 9, "inconclusive": 1, "blocked": 2, "incorrect": 0, "unnecessary": 0 }
}
```

Classification applies to learner actions only (12 in the §5 log): seq 7 and 10 → blocked; seq 5 (ping while unhealthy) → inconclusive; the other nine → helpful. All numbers here were worked out by hand from the example log and the `legacy-1` rules, not produced by running anything.
