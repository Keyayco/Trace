/**
 * TRACE — Application Entry Point & Subsystem Coordinator (rev 2)
 *
 * Implements ARCHITECTURE §7 (Runtime flow):
 *  1. Load manifest -> fetch ticket, environment, remote -> validate & cross-validate -> deepFreeze.
 *  2. Create session with deterministic clock and ID generator.
 *  3. Append session.start and env.fault.apply (activeAtStart faults).
 *  4. Coordinate UI rendering across the four screens (Ticket Desk, Remote, Workstation, Review).
 *  5. Re-render views from pure projections on action dispatch.
 */

import {
  validateTicket,
  validateEnvironment,
  validateExercise,
  validateRemote,
  crossValidateExercise,
  deepFreeze
} from "./contracts.js";
import { SessionStore, DeterministicClock, DeterministicIdGenerator } from "./session.js";
import { EnvironmentEngine } from "./environment.js";
import { ScriptedTextRemoteProvider } from "./remote.js";
import { renderTicketDesk } from "./tickets.js";
import { renderTopBar, renderNavBar, renderRemoteSupport, renderWorkstation, renderReview } from "./ui.js";

class TraceApp {
  constructor() {
    this.currentScreen = 0; // 0: Ticket, 1: Remote, 2: Workstation, 3: Review
    this.manifest = null;
    this.ticket = null;
    this.environment = null;
    this.remoteDef = null;
    this.remoteProvider = null;
    this.engine = null;
    this.session = null;
  }

  async boot() {
    const screenEl = document.getElementById("screen");
    const topbarEl = document.getElementById("topbar");
    const navEl = document.getElementById("nav");

    try {
      screenEl.innerHTML = `<div class="term"><span class="loading-line">Loading TRACE exercise ns-voip-01...</span></div>`;

      // 1. Fetch data files
      const [exRes, ticketRes, envRes, remRes] = await Promise.all([
        fetch("/data/exercises/ns-voip-01/exercise.json"),
        fetch("/data/exercises/ns-voip-01/ticket.json"),
        fetch("/data/exercises/ns-voip-01/environment.json"),
        fetch("/data/exercises/ns-voip-01/remote.json")
      ]);

      if (!exRes.ok || !ticketRes.ok || !envRes.ok) {
        throw new Error("Failed to load exercise JSON definitions.");
      }

      this.manifest = await exRes.json();
      this.ticket = await ticketRes.json();
      this.environment = await envRes.json();
      this.remoteDef = remRes.ok ? await remRes.json() : null;

      // 2. Validate schemas
      const vEx = validateExercise(this.manifest);
      const vTick = validateTicket(this.ticket);
      const vEnv = validateEnvironment(this.environment);
      const vRem = this.remoteDef ? validateRemote(this.remoteDef) : { ok: true };

      if (!vEx.ok || !vTick.ok || !vEnv.ok || !vRem.ok) {
        const errs = [...vEx.errors, ...vTick.errors, ...vEnv.errors, ...(vRem.errors || [])];
        throw new Error(`Schema validation failed:\n${errs.map(e => `[${e.code}] ${e.path}: ${e.message}`).join("\n")}`);
      }

      // 3. Cross-validate
      const cross = crossValidateExercise(this.manifest, this.ticket, this.environment, this.remoteDef);
      if (!cross.ok) {
        throw new Error(`Cross-validation failed:\n${cross.errors.map(e => `[${e.code}] ${e.message}`).join("\n")}`);
      }

      // 4. Freeze immutable definitions
      deepFreeze(this.manifest);
      deepFreeze(this.ticket);
      deepFreeze(this.environment);
      if (this.remoteDef) deepFreeze(this.remoteDef);

      // 5. Initialize subsystems
      this.initSession();

      // 6. Bind screen updates
      this.session.subscribe(() => {
        this.render();
      });

      this.render();
    } catch (err) {
      console.error("[TRACE boot error]", err);
      screenEl.innerHTML = `
        <div class="panel">
          <div class="panel-head" style="color:var(--red)">System Initialization Error</div>
          <div class="panel-body">
            <p>Could not initialize exercise simulation:</p>
            <pre class="term" style="color:var(--red);margin-top:8px">${err.message || String(err)}</pre>
          </div>
        </div>
      `;
    }
  }

  initSession() {
    this.engine = new EnvironmentEngine(this.environment);
    this.remoteProvider = this.remoteDef ? new ScriptedTextRemoteProvider(this.remoteDef) : null;

    const clock = new DeterministicClock("2026-10-19T09:41:00Z", 2000);
    const idGen = new DeterministicIdGenerator("SIM-", 4821);

    this.session = new SessionStore(
      this.manifest,
      this.environment,
      this.engine.getDeriveFn(),
      clock,
      idGen
    );

    // Initial log events
    this.session.dispatch({
      actor: "system",
      type: "session.start",
      params: {}
    });

    // Apply activeAtStart faults
    for (const fault of this.environment.faults || []) {
      if (fault.activeAtStart) {
        const changes = this.engine.getFaultChanges(fault.id);
        this.session.dispatch({
          actor: "system",
          type: "env.fault.apply",
          params: { faultId: fault.id },
          changes
        });
      }
    }
  }

  navigate(screenId) {
    this.currentScreen = screenId;
    this.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  render() {
    const screenEl = document.getElementById("screen");
    const topbarEl = document.getElementById("topbar");
    const navEl = document.getElementById("nav");

    renderTopBar(topbarEl, this.session, this.ticket, this.currentScreen, (s) => this.navigate(s));
    renderNavBar(navEl, this.currentScreen, this.session, (s) => this.navigate(s));

    switch (this.currentScreen) {
      case 0:
        renderTicketDesk(screenEl, this.ticket, this.session, (s) => this.navigate(s));
        break;
      case 1:
        renderRemoteSupport(screenEl, this.session, this.remoteProvider, (s) => this.navigate(s));
        break;
      case 2:
        renderWorkstation(screenEl, this.session, this.engine, (s) => this.navigate(s));
        break;
      case 3:
        renderReview(screenEl, this.session, this.manifest, () => {
          this.initSession();
          this.navigate(0);
        }, (s) => this.navigate(s));
        break;
    }
  }
}

// Boot application
const app = new TraceApp();
window.addEventListener("DOMContentLoaded", () => {
  app.boot();
});
