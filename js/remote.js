/**
 * TRACE — Remote Support Provider (rev 2)
 *
 * Implements CONTRACTS §2:
 *  - Provider interface: { id, channels, start(ctx), send(message), end() }
 *  - Scripted-text provider matching responses[] deterministically.
 */

export class ScriptedTextRemoteProvider {
  constructor(definition) {
    this.definition = definition;
    this.id = definition.id;
    this.channels = definition.channels || ["text"];
    this.active = false;
  }

  async start() {
    this.active = true;
    return {
      opening: this.definition.opening || null
    };
  }

  async send(userMessage) {
    if (!this.active) {
      throw new Error("Remote provider is not active");
    }

    const lower = (userMessage || "").toLowerCase();
    const responses = this.definition.responses || [];

    for (const resp of responses) {
      if (resp.match?.any && Array.isArray(resp.match.any)) {
        const matches = resp.match.any.some(phrase => lower.includes(phrase.toLowerCase()));
        if (matches) {
          return {
            responseId: resp.id,
            reply: resp.reply,
            answers: resp.answers || [],
            grants: resp.grants || [],
            evidence: resp.evidence || []
          };
        }
      }
    }

    return {
      responseId: "fallback",
      reply: this.definition.fallback || "I'm not sure how to answer that.",
      answers: [],
      grants: [],
      evidence: []
    };
  }

  async end() {
    this.active = false;
  }
}
