# TRACE

Technical Support Simulation Lab — a mobile-first, client-side training prototype
for broadband, networking and business VoIP support engineers.

## Run

Static site — no build step, no backend. Open `index.html` from any static host.
GitHub Pages serves it at: https://keyayco.github.io/trace/

## Status

- `index.html` — interactive prototype (four screens: Ticket Desk, Remote Support,
  Customer Computer Environment, Exercise Review). Deterministic fictional scenario,
  vanilla HTML/CSS/JS, zero dependencies.
- `docs/` — architecture package rev 2 (2026-10-19): subsystem contracts
  (`trace.ticket.v1`, `trace.remote.v1`, `trace.environment.v1`, `trace.exercise.v1`,
  `trace.session.v1`, `trace.result.v1`), state ownership, handoff and dev log.
  All content is fictional training data; no real systems are accessed.

See `docs/HANDOFF.md` for the decision register and next step.
