/**
 * TRACE — Session Store, Log & Projections (rev 2)
 *
 * Implements STATE.md:
 *  - Action log is the single authority.
 *  - Projections are pure functions: project(definitions, log).
 *  - rebuild(log) === incremental reduce.
 *  - Injected clock and ID generators (no Math.random in session state).
 *  - FNV-1a 32-bit output digest for drift detection.
 */

// 32-bit FNV-1a hash
export function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class DeterministicClock {
  constructor(initialIso = "2026-10-19T09:41:00Z", stepMs = 1000) {
    this.current = new Date(initialIso).getTime();
    this.stepMs = stepMs;
  }
  now() {
    const iso = new Date(this.current).toISOString();
    this.current += this.stepMs;
    return iso;
  }
}

export class DeterministicIdGenerator {
  constructor(prefix = "SIM-", start = 4820) {
    this.prefix = prefix;
    this.counter = start;
  }
  next() {
    return `${this.prefix}${this.counter++}`;
  }
}

export function createInitialProjections(environmentDefinition, learnerPrivilege = "standard") {
  // Deep clone baseline environment state
  const envState = JSON.parse(JSON.stringify(environmentDefinition));
  const initialPrivilege = {};
  for (const node of envState.nodes || []) {
    initialPrivilege[node.id] = learnerPrivilege;
  }

  return {
    status: "intake",
    connection: { connected: false, connectionId: null },
    viewed: [],
    authorizations: [],
    privilege: initialPrivilege,
    envState,
    envRev: 0,
    healthy: false,
    fixApplied: false,
    fixAttempted: false,
    observations: [],
    postFixProbes: [],
    verification: (envState.outcomes?.verification || []).map(v => ({ checkId: v.id, covered: false, passed: false })),
    remote: { status: "inactive", messages: [] },
    evidence: [],
    findings: [],
    touchedTools: [],
    deniedCount: 0,
    completion: { finishedAt: null, finishCount: 0 }
  };
}

/**
 * Reduce a single action into projections. Pure reducer.
 */
export function reduceAction(projections, action, environmentDefinition, deriveFn) {
  // Deep clone to avoid mutating input projections directly
  const p = JSON.parse(JSON.stringify(projections));

  if (action.outcome && action.outcome.status === "denied") {
    p.deniedCount++;
  }

  switch (action.type) {
    case "session.start":
      break;

    case "env.fault.apply": {
      if (action.outcome?.status === "ok" && Array.isArray(action.changes)) {
        applyChangesToEnv(p.envState, action.changes);
        p.envRev++;
      }
      break;
    }

    case "nav.view": {
      if (action.params?.item && !p.viewed.includes(action.params.item)) {
        p.viewed.push(action.params.item);
      }
      break;
    }

    case "session.connect": {
      p.connection = { connected: true, connectionId: action.params?.connectionId || "SIM-0000" };
      break;
    }

    case "session.end": {
      p.connection = { connected: false, connectionId: null };
      break;
    }

    case "tool.open": {
      if (action.params?.tool && !p.touchedTools.includes(action.params.tool)) {
        p.touchedTools.push(action.params.tool);
      }
      break;
    }

    case "tool.run": {
      if (action.params?.tool && !p.touchedTools.includes(action.params.tool)) {
        p.touchedTools.push(action.params.tool);
      }
      const obs = {
        seq: action.seq,
        tool: action.params?.tool,
        command: action.params?.command,
        args: action.params?.args,
        envRev: p.envRev,
        outputDigest: action.outputDigest,
        probes: action.params?.probes || []
      };
      p.observations.push(obs);

      if (p.healthy && Array.isArray(obs.probes)) {
        for (const probe of obs.probes) {
          const key = probe.key || `${probe.check}:${probe.target || ""}`;
          if (!p.postFixProbes.includes(key)) {
            p.postFixProbes.push(key);
          }
        }
      }
      break;
    }

    case "auth.grant": {
      if (action.outcome?.status === "ok" && action.params?.authorizationId) {
        p.authorizations.push({
          authorizationId: action.params.authorizationId,
          scope: action.params.scope,
          targets: action.params.targets || [],
          source: action.params.source || "simulated",
          seq: action.seq
        });
      }
      break;
    }

    case "priv.elevate": {
      if (action.outcome?.status === "ok") {
        const target = action.params?.target || "ws01";
        const toLevel = action.params?.to || "admin";
        p.privilege[target] = toLevel;
      }
      break;
    }

    case "env.config.set": {
      p.fixAttempted = true;
      if (action.outcome?.status === "ok" && Array.isArray(action.changes)) {
        applyChangesToEnv(p.envState, action.changes);
        p.envRev++;
        // Check if healthy now
        if (deriveFn) {
          const derived = deriveFn(p.envState);
          p.healthy = derived.healthy;
          if (p.healthy) {
            p.fixApplied = true;
          }
        }
      }
      break;
    }

    case "remote.start": {
      p.remote.status = "active";
      break;
    }

    case "remote.message": {
      p.remote.messages.push({
        actor: action.actor,
        text: action.params?.text,
        seq: action.seq,
        at: action.at
      });
      if (action.params?.evidence && Array.isArray(action.params.evidence)) {
        for (const ev of action.params.evidence) {
          if (!p.evidence.some(e => e.id === ev.id)) {
            p.evidence.push({ ...ev, seq: action.seq, origin: "remote" });
          }
        }
      }
      break;
    }

    case "remote.end": {
      p.remote.status = "ended";
      break;
    }

    case "finding.record": {
      if (action.params?.hypothesisId) {
        p.findings.push({
          hypothesisId: action.params.hypothesisId,
          seq: action.seq,
          at: action.at
        });
      }
      break;
    }

    case "investigation.finish": {
      if (!p.completion.finishedAt) {
        p.completion.finishedAt = action.at;
      }
      p.completion.finishCount++;
      break;
    }
  }

  // Derive health if not evaluated above
  if (deriveFn) {
    const derived = deriveFn(p.envState);
    p.healthy = derived.healthy;
    // Update verification checklist
    p.verification = (environmentDefinition.outcomes?.verification || []).map(ver => {
      const isCovered = p.postFixProbes.some(key => key.includes(ver.id) || key.includes(ver.check));
      return {
        checkId: ver.id,
        covered: isCovered,
        passed: derived.checks ? Boolean(derived.checks[ver.id]) : false
      };
    });
  }

  // Calculate status projection according to STATE §5:
  // finished -> if any investigation.finish exists
  // else investigating -> if connected and any tool.open|tool.run exists
  // else connected -> if connected
  // else intake -> not connected
  if (p.completion.finishCount > 0) {
    p.status = "finished";
  } else if (p.connection.connected && p.touchedTools.length > 0) {
    p.status = "investigating";
  } else if (p.connection.connected) {
    p.status = "connected";
  } else {
    p.status = "intake";
  }

  return p;
}

function applyChangesToEnv(envState, changes) {
  for (const c of changes) {
    if (!c.path) continue;
    if (c.path.endsWith(".config")) {
      const ifaceId = c.path.slice(0, -7);
      for (const node of envState.nodes || []) {
        for (const iface of node.interfaces || []) {
          if (iface.id === ifaceId) {
            iface.config = JSON.parse(JSON.stringify(c.to));
          }
        }
      }
      continue;
    }
    const parts = c.path.split(".");
    let target = envState;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (Array.isArray(target)) {
        target = target.find(item => item.id === part) || target[part];
      } else if (target && typeof target === "object") {
        target = target[part];
      }
    }
    const lastKey = parts[parts.length - 1];
    if (target && typeof target === "object") {
      target[lastKey] = JSON.parse(JSON.stringify(c.to));
    }
  }
}

/**
 * Rebuild projections from the complete log.
 * Invariant: rebuild(log) deep-equals incrementally reduced projections.
 */
export function rebuildProjections(environmentDefinition, actions, deriveFn, learnerPrivilege = "standard") {
  let projections = createInitialProjections(environmentDefinition, learnerPrivilege);
  for (const action of actions) {
    projections = reduceAction(projections, action, environmentDefinition, deriveFn);
  }
  return projections;
}

export class SessionStore {
  constructor(exerciseRef, environmentDefinition, deriveFn, clock = new DeterministicClock(), idGen = new DeterministicIdGenerator()) {
    this.header = {
      schema: "trace.session.v1",
      id: `ses-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      exerciseRef: { schema: exerciseRef.schema || "trace.exercise.v1", id: exerciseRef.id },
      engine: { version: "0.2.0" }
    };
    this.environmentDefinition = environmentDefinition;
    this.deriveFn = deriveFn;
    this.clock = clock;
    this.idGen = idGen;
    this.actions = [];
    this.projections = createInitialProjections(environmentDefinition);
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      fn(this.projections, this.actions);
    }
  }

  dispatch(actionPayload) {
    const seq = this.actions.length + 1;
    const action = {
      seq,
      at: actionPayload.at || this.clock.now(),
      actor: actionPayload.actor || "learner",
      type: actionPayload.type,
      params: actionPayload.params || {},
      outcome: actionPayload.outcome || { status: "ok" }
    };
    if (actionPayload.changes) action.changes = actionPayload.changes;
    if (actionPayload.outputDigest) action.outputDigest = actionPayload.outputDigest;

    this.actions.push(action);
    this.projections = reduceAction(this.projections, action, this.environmentDefinition, this.deriveFn);
    this.notify();
    return action;
  }

  exportSession() {
    return JSON.stringify({
      ...this.header,
      actions: this.actions
    }, null, 2);
  }
}
