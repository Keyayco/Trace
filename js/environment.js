/**
 * TRACE — Environment Engine, Access Gate & Module Registry (rev 2)
 *
 * Implements ARCHITECTURE §3 & §5:
 *  - Gate order: Policy lookup -> Customer Authorization (E_UNAUTHORIZED)
 *                -> Technical Privilege (E_PRIVILEGE)
 *                -> Module Validate (E_INVALID)
 *                -> Apply changes.
 *  - Module registry.
 */

import { networkingModule } from "./modules/networking.js";

const moduleRegistry = new Map();
moduleRegistry.set("networking", networkingModule);

export function registerModule(mod) {
  moduleRegistry.set(mod.id, mod);
}

export function getModule(id) {
  return moduleRegistry.get(id);
}

export class EnvironmentEngine {
  constructor(environmentDefinition) {
    this.definition = environmentDefinition;
    this.module = getModule(environmentDefinition.module);
    if (!this.module) {
      throw new Error(`Module '${environmentDefinition.module}' not found in registry`);
    }
  }

  getDeriveFn() {
    return this.module.derive;
  }

  /**
   * Evaluates an action through the access gate against current projections.
   * Gate order per ARCHITECTURE §5 & STATE §5:
   * 1. Policy lookup
   * 2. Customer authorization (E_UNAUTHORIZED)
   * 3. Technical privilege (E_PRIVILEGE)
   * 4. Module validate (E_INVALID)
   * 5. Apply changes
   */
  evaluateConfigAction(intent, projections) {
    const actionName = intent.params?.action || intent.type;
    const policy = this.definition.permissions?.policies?.[actionName];
    const targetNode = (intent.params?.target || "ws01").split(".")[0];

    // 1. Policy authorization check
    if (policy?.authorization) {
      const hasAuth = (projections.authorizations || []).some(
        a => a.scope === policy.authorization
      );
      if (!hasAuth) {
        return {
          outcome: {
            status: "denied",
            code: "E_UNAUTHORIZED",
            message: `authorization scope ${policy.authorization} not held`
          }
        };
      }
    }

    // 2. Technical privilege check
    if (policy?.privilege) {
      const currentLevel = projections.privilege?.[targetNode] || "standard";
      const allowedCaps = this.definition.permissions?.levels?.[currentLevel] || [];
      if (!allowedCaps.includes(policy.privilege)) {
        return {
          outcome: {
            status: "denied",
            code: "E_PRIVILEGE",
            message: `${policy.privilege} required on ${targetNode}`
          }
        };
      }
    }

    // 3. Module validation
    const actionHandler = this.module.actions?.[actionName];
    if (!actionHandler) {
      return {
        outcome: {
          status: "error",
          code: "E_INVALID",
          message: `No handler registered for action ${actionName}`
        }
      };
    }

    const validation = actionHandler.validate(projections.envState, intent.params);
    if (!validation.ok) {
      return {
        outcome: {
          status: "error",
          code: validation.code || "E_INVALID",
          message: validation.message
        }
      };
    }

    // 4. Apply changes
    const changes = actionHandler.apply(projections.envState, intent.params);
    return {
      outcome: { status: "ok" },
      changes
    };
  }

  evaluateElevation(intent, projections) {
    const target = intent.params?.target || "ws01";
    const toLevel = intent.params?.to || "admin";
    const elevationRule = this.definition.permissions?.elevation;

    if (!elevationRule || elevationRule.to !== toLevel) {
      return {
        outcome: {
          status: "denied",
          code: "E_ELEVATION_UNAVAILABLE",
          message: `Elevation to ${toLevel} is not permitted on this machine`
        }
      };
    }

    return {
      outcome: { status: "ok" }
    };
  }

  runTool(toolId, command, args, envState) {
    const toolDef = (this.definition.tools || []).find(t => t.id === toolId);
    if (!toolDef) {
      return { text: `Tool '${toolId}' not found on node.`, data: { probes: [] } };
    }

    const toolImpl = this.module.tools?.[toolId];
    if (!toolImpl) {
      return { text: `Tool '${toolId}' not implemented in module.`, data: { probes: [] } };
    }

    const runner = toolImpl.commands?.[command] || toolImpl.commands?.[toolId];
    if (!runner) {
      return { text: `Command '${command}' not found for tool '${toolId}'.`, data: { probes: [] } };
    }

    return runner(envState, args?.target || args?.name);
  }

  getFaultChanges(faultId) {
    const fault = (this.definition.faults || []).find(f => f.id === faultId);
    if (!fault) return [];

    const changes = [];
    if (fault.set?.config) {
      changes.push({
        path: `${fault.target}.config`,
        from: { mode: "dhcp" },
        to: fault.set.config
      });
    }
    return changes;
  }
}
