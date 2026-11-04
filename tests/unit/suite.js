/**
 * TRACE — Unit & Contract Invariant Test Suite
 */

import {
  validateTicket,
  validateEnvironment,
  validateExercise,
  validateRemote,
  crossValidateExercise
} from "../../js/contracts.js";
import {
  DeterministicClock,
  DeterministicIdGenerator,
  SessionStore,
  rebuildProjections,
  fnv1a
} from "../../js/session.js";
import { EnvironmentEngine } from "../../js/environment.js";
import { assessSession } from "../../js/assess.js";

export async function runUnitTests() {
  const results = [];
  function assert(name, condition, detail = "") {
    results.push({ name, passed: Boolean(condition), detail });
    if (!condition) console.error(`[FAIL] ${name}: ${detail}`);
  }

  // 1. Contract tests
  const [ticket, env, exercise, remote] = await Promise.all([
    fetch("/data/exercises/ns-voip-01/ticket.json").then(r => r.json()),
    fetch("/data/exercises/ns-voip-01/environment.json").then(r => r.json()),
    fetch("/data/exercises/ns-voip-01/exercise.json").then(r => r.json()),
    fetch("/data/exercises/ns-voip-01/remote.json").then(r => r.json())
  ]);

  const vTicket = validateTicket(ticket);
  assert("Contract: ticket.json valid", vTicket.ok, JSON.stringify(vTicket.errors));

  const vEnv = validateEnvironment(env);
  assert("Contract: environment.json valid", vEnv.ok, JSON.stringify(vEnv.errors));

  const vEx = validateExercise(exercise);
  assert("Contract: exercise.json valid", vEx.ok, JSON.stringify(vEx.errors));

  const vRem = validateRemote(remote);
  assert("Contract: remote.json valid", vRem.ok, JSON.stringify(vRem.errors));

  const vCross = crossValidateExercise(exercise, ticket, env, remote);
  assert("Contract: Cross-validation passes", vCross.ok, JSON.stringify(vCross.errors));

  // 2. Engine and derivation tests
  const engine = new EnvironmentEngine(env);
  const deriveFn = engine.getDeriveFn();

  // Baseline with fault active
  const faultedEnv = JSON.parse(JSON.stringify(env));
  const faultChanges = engine.getFaultChanges("fault-static-ip");
  assert("Engine: Fault changes generated for fault-static-ip", faultChanges.length > 0);

  // Apply fault changes
  faultedEnv.nodes[0].interfaces[0].config = faultChanges[0].to;
  const derivedFaulted = deriveFn(faultedEnv);
  assert("Simulation: Faulted state is unhealthy", derivedFaulted.healthy === false);
  assert("Simulation: Gateway unreachable in faulted state", derivedFaulted.checks["v-gw"] === false);
  assert("Simulation: DNS unresolved in faulted state", derivedFaulted.checks["v-dns"] === false);
  assert("Simulation: SIP unregistered in faulted state", derivedFaulted.checks["v-sip"] === false);

  // Solvability test (CONTRACTS §3): Apply fix to faulted model
  const fixedEnv = JSON.parse(JSON.stringify(faultedEnv));
  fixedEnv.nodes[0].interfaces[0].config = { mode: "dhcp" };
  const derivedFixed = deriveFn(fixedEnv);
  assert("Simulation Solvability: Fixed state is healthy", derivedFixed.healthy === true);
  assert("Simulation Solvability: Gateway reachable when fixed", derivedFixed.checks["v-gw"] === true);
  assert("Simulation Solvability: DNS resolves when fixed", derivedFixed.checks["v-dns"] === true);
  assert("Simulation Solvability: SIP registers when fixed", derivedFixed.checks["v-sip"] === true);

  // 3. Access Gate Enforcement tests (ARCHITECTURE §5)
  const clock = new DeterministicClock("2026-10-19T09:41:00Z");
  const idGen = new DeterministicIdGenerator();
  const session = new SessionStore(exercise, env, deriveFn, clock, idGen);

  session.dispatch({ actor: "system", type: "session.start" });
  session.dispatch({ actor: "system", type: "env.fault.apply", params: { faultId: "fault-static-ip" }, changes: faultChanges });

  // Attempt config change without customer authorization
  const unauthIntent = {
    actor: "learner",
    type: "env.config.set",
    params: { action: "net.config.set", target: "ws01.eth0", set: { config: { mode: "dhcp" } } }
  };
  const gateRes1 = engine.evaluateConfigAction(unauthIntent, session.projections);
  assert("Access Gate: Denies change without customer authorization (E_UNAUTHORIZED)",
    gateRes1.outcome.status === "denied" && gateRes1.outcome.code === "E_UNAUTHORIZED");

  session.dispatch({ ...unauthIntent, outcome: gateRes1.outcome });

  // Grant customer authorization, but stay standard user
  session.dispatch({
    actor: "customer",
    type: "auth.grant",
    params: { authorizationId: "auth-network-change", scope: "network-change", targets: ["ws01"], source: "simulated" }
  });

  const gateRes2 = engine.evaluateConfigAction(unauthIntent, session.projections);
  assert("Access Gate: Denies change without technical privilege (E_PRIVILEGE)",
    gateRes2.outcome.status === "denied" && gateRes2.outcome.code === "E_PRIVILEGE");

  session.dispatch({ ...unauthIntent, outcome: gateRes2.outcome });

  // Elevate privilege to admin
  session.dispatch({
    actor: "learner",
    type: "priv.elevate",
    params: { target: "ws01", to: "admin" }
  });

  const gateRes3 = engine.evaluateConfigAction(unauthIntent, session.projections);
  assert("Access Gate: Permits change with authorization and privilege",
    gateRes3.outcome.status === "ok" && Array.isArray(gateRes3.changes));

  session.dispatch({ ...unauthIntent, outcome: gateRes3.outcome, changes: gateRes3.changes });
  assert("Session: Projections update to healthy after applying fix", session.projections.healthy === true);

  // 4. Invariant: rebuild(log) === incrementally reduced projections (STATE §4)
  const rebuilt = rebuildProjections(env, session.actions, deriveFn);
  const jsonReduced = JSON.stringify(session.projections);
  const jsonRebuilt = JSON.stringify(rebuilt);
  assert("Invariant: rebuild(log) deep-equals reduced projections", jsonReduced === jsonRebuilt);

  // 5. Tool hashing
  const testDigest = fnv1a("test output string");
  assert("Integrity: fnv1a produces 8-char hex string", typeof testDigest === "string" && testDigest.length === 8);

  // 6. Assessment evaluation
  session.dispatch({ actor: "learner", type: "nav.view", params: { item: "ticket" } });
  session.dispatch({ actor: "learner", type: "nav.view", params: { item: "communication" } });
  session.dispatch({ actor: "learner", type: "tool.run", params: { tool: "ping", command: "ping", probes: [{ check: "reach", target: "192.168.1.1", passed: true, key: "ping:192.168.1.1" }] } });
  session.dispatch({ actor: "learner", type: "tool.run", params: { tool: "dns", command: "nslookup", probes: [{ check: "resolve", name: "voice.example.test", passed: true, key: "dns" }] } });
  session.dispatch({ actor: "learner", type: "finding.record", params: { hypothesisId: "static-ip" } });
  session.dispatch({ actor: "learner", type: "investigation.finish" });

  const result = assessSession(exercise.assessment, session.projections, exercise, session.actions);
  assert("Assessment: Result produced with schema trace.result.v1", result.schema === "trace.result.v1");
  assert("Assessment: Outcome resolved", result.outcome === "resolved");
  assert("Assessment: Score percentage computed", result.score.percent > 0);

  return results;
}
