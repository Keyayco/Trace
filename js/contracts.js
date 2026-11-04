/**
 * TRACE — Contract Validators and Cross-Validation (rev 2)
 *
 * Implements validation for:
 *  - trace.ticket.v1
 *  - trace.environment.v1
 *  - trace.exercise.v1
 *  - trace.remote.v1
 *  - trace.session.v1
 *  - trace.result.v1
 */

const ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

export function validateTicket(t) {
  const errors = [];
  const warnings = [];

  if (!t || typeof t !== "object") {
    return { ok: false, errors: [{ path: "", code: "E_TYPE", message: "Ticket must be an object" }], warnings };
  }
  if (t.schema !== "trace.ticket.v1") {
    errors.push({ path: "schema", code: "E_SCHEMA", message: `Expected trace.ticket.v1, got ${t.schema}` });
  }
  if (!t.id || !ID_REGEX.test(t.id)) {
    errors.push({ path: "id", code: "E_REQUIRED", message: "Valid id is required" });
  }
  if (typeof t.title !== "string" || !t.title.trim()) {
    errors.push({ path: "title", code: "E_REQUIRED", message: "title is required" });
  }
  if (!["open", "in_progress", "resolved", "closed"].includes(t.initialStatus)) {
    errors.push({ path: "initialStatus", code: "E_ENUM", message: `Invalid initialStatus: ${t.initialStatus}` });
  }
  if (!t.report || typeof t.report.text !== "string" || !t.report.sourceId) {
    errors.push({ path: "report", code: "E_REQUIRED", message: "report {text, sourceId} is required" });
  }
  if (!Array.isArray(t.facts)) {
    errors.push({ path: "facts", code: "E_REQUIRED", message: "facts[] is required" });
  }
  if (!Array.isArray(t.unknowns)) {
    errors.push({ path: "unknowns", code: "E_REQUIRED", message: "unknowns[] is required" });
  }
  if (!Array.isArray(t.sources)) {
    errors.push({ path: "sources", code: "E_REQUIRED", message: "sources[] is required" });
  } else {
    const sourceIds = new Set();
    t.sources.forEach((s, idx) => {
      if (!s.id || !ID_REGEX.test(s.id)) errors.push({ path: `sources[${idx}].id`, code: "E_REQUIRED", message: "Valid source id required" });
      if (sourceIds.has(s.id)) errors.push({ path: `sources[${idx}].id`, code: "E_DUP_ID", message: `Duplicate source id: ${s.id}` });
      sourceIds.add(s.id);
    });
    if (t.report && !sourceIds.has(t.report.sourceId)) {
      errors.push({ path: "report.sourceId", code: "E_REF", message: `Unresolved sourceId: ${t.report.sourceId}` });
    }
  }

  if (!t.requirements || typeof t.requirements !== "object") {
    errors.push({ path: "requirements", code: "E_REQUIRED", message: "requirements object is required" });
  } else {
    const req = t.requirements;
    if (!req.remote || !["none", "optional", "required"].includes(req.remote.mode)) {
      errors.push({ path: "requirements.remote.mode", code: "E_ENUM", message: "remote mode must be none, optional, or required" });
    }
    if (!Array.isArray(req.authorizations)) {
      errors.push({ path: "requirements.authorizations", code: "E_REQUIRED", message: "authorizations[] is required" });
    }
    if (!req.environment || typeof req.environment.module !== "string") {
      errors.push({ path: "requirements.environment.module", code: "E_REQUIRED", message: "environment.module is required" });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateEnvironment(env, registeredModules = new Set(["networking"])) {
  const errors = [];
  const warnings = [];

  if (!env || typeof env !== "object") {
    return { ok: false, errors: [{ path: "", code: "E_TYPE", message: "Environment must be an object" }], warnings };
  }
  if (env.schema !== "trace.environment.v1") {
    errors.push({ path: "schema", code: "E_SCHEMA", message: `Expected trace.environment.v1, got ${env.schema}` });
  }
  if (!env.id || !ID_REGEX.test(env.id)) {
    errors.push({ path: "id", code: "E_REQUIRED", message: "Valid id required" });
  }
  if (!env.module || !registeredModules.has(env.module)) {
    errors.push({ path: "module", code: "E_MODULE", message: `Unregistered module: ${env.module}` });
  }
  if (!Array.isArray(env.nodes)) {
    errors.push({ path: "nodes", code: "E_REQUIRED", message: "nodes[] is required" });
  }
  if (!Array.isArray(env.links)) {
    errors.push({ path: "links", code: "E_REQUIRED", message: "links[] is required" });
  }
  if (!env.permissions || typeof env.permissions !== "object") {
    errors.push({ path: "permissions", code: "E_REQUIRED", message: "permissions is required" });
  }
  if (!Array.isArray(env.tools)) {
    errors.push({ path: "tools", code: "E_REQUIRED", message: "tools[] is required" });
  }
  if (!env.outcomes || typeof env.outcomes !== "object") {
    errors.push({ path: "outcomes", code: "E_REQUIRED", message: "outcomes is required" });
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateExercise(ex) {
  const errors = [];
  const warnings = [];

  if (!ex || typeof ex !== "object") {
    return { ok: false, errors: [{ path: "", code: "E_TYPE", message: "Exercise must be an object" }], warnings };
  }
  if (ex.schema !== "trace.exercise.v1") {
    errors.push({ path: "schema", code: "E_SCHEMA", message: `Expected trace.exercise.v1, got ${ex.schema}` });
  }
  if (!ex.id || !ID_REGEX.test(ex.id)) {
    errors.push({ path: "id", code: "E_REQUIRED", message: "Valid exercise id required" });
  }
  if (!ex.ticket || ex.ticket.schema !== "trace.ticket.v1") {
    errors.push({ path: "ticket", code: "E_REF", message: "Valid ticket ref required" });
  }
  if (!ex.environment || ex.environment.schema !== "trace.environment.v1") {
    errors.push({ path: "environment", code: "E_REF", message: "Valid environment ref required" });
  }
  if (!ex.assessment || typeof ex.assessment !== "object") {
    errors.push({ path: "assessment", code: "E_REQUIRED", message: "assessment definition is required" });
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateRemote(rem) {
  const errors = [];
  const warnings = [];

  if (!rem || typeof rem !== "object") {
    return { ok: false, errors: [{ path: "", code: "E_TYPE", message: "Remote must be an object" }], warnings };
  }
  if (rem.schema !== "trace.remote.v1") {
    errors.push({ path: "schema", code: "E_SCHEMA", message: `Expected trace.remote.v1, got ${rem.schema}` });
  }
  if (!rem.id || !ID_REGEX.test(rem.id)) {
    errors.push({ path: "id", code: "E_REQUIRED", message: "Valid id required" });
  }
  if (!Array.isArray(rem.responses)) {
    errors.push({ path: "responses", code: "E_REQUIRED", message: "responses[] is required" });
  }
  if (typeof rem.fallback !== "string") {
    errors.push({ path: "fallback", code: "E_REQUIRED", message: "fallback string is required" });
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Cross-validation per ARCHITECTURE §4 and CONTRACTS §4
 */
export function crossValidateExercise(exercise, ticket, environment, remote = null) {
  const errors = [];
  const warnings = [];

  // 1. Module match
  if (environment.module !== ticket.requirements.environment.module) {
    errors.push({
      path: "environment.module",
      code: "E_REQUIREMENT_UNMET",
      message: `Environment module '${environment.module}' does not match ticket requirement '${ticket.requirements.environment.module}'`
    });
  }

  // 2. Component types
  const envCompTypes = new Set(environment.nodes.map(n => n.type));
  for (const ct of ticket.requirements.environment.componentTypes) {
    if (!envCompTypes.has(ct)) {
      errors.push({
        path: "requirements.environment.componentTypes",
        code: "E_REQUIREMENT_UNMET",
        message: `Environment lacks required component type: ${ct}`
      });
    }
  }

  // 3. Service types
  const envServiceTypes = new Set((environment.services || []).map(s => s.type));
  for (const st of ticket.requirements.environment.serviceTypes) {
    if (!envServiceTypes.has(st)) {
      errors.push({
        path: "requirements.environment.serviceTypes",
        code: "E_REQUIREMENT_UNMET",
        message: `Environment lacks required service type: ${st}`
      });
    }
  }

  // 4. Tools
  const envToolIds = new Set(environment.tools.map(t => t.id));
  for (const tid of ticket.requirements.environment.toolIds) {
    if (!envToolIds.has(tid)) {
      errors.push({
        path: "requirements.environment.toolIds",
        code: "E_REQUIREMENT_UNMET",
        message: `Environment lacks required tool: ${tid}`
      });
    }
  }

  // 5. Customer authorization scopes declared in ticket
  const ticketAuthScopes = new Set(ticket.requirements.authorizations.map(a => a.scope));
  const policies = environment.permissions.policies || {};
  for (const [actionName, policy] of Object.entries(policies)) {
    if (policy.authorization && !ticketAuthScopes.has(policy.authorization)) {
      errors.push({
        path: `permissions.policies.${actionName}.authorization`,
        code: "E_AUTH_UNDECLARED",
        message: `Authorization scope '${policy.authorization}' for action '${actionName}' not declared by ticket`
      });
    }
  }

  // 6. Remote constraints
  if (ticket.requirements.remote.mode === "required" && !remote) {
    errors.push({
      path: "remote",
      code: "E_REQUIREMENT_UNMET",
      message: "Ticket requires remote access, but exercise defines no remote provider"
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}
