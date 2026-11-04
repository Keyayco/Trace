/**
 * TRACE — Assessment & Rubric Engine (rev 2)
 *
 * Implements CONTRACTS §4 & §6:
 *  - Pure function: assess(assessment, projections, exerciseManifest, actions)
 *  - Rubric check catalogue `legacy-1`
 *  - Action classification for learner actions
 *  - Emits immutable trace.result.v1
 */

export function assessSession(assessment, projections, exerciseManifest, actions = []) {
  const categories = [];
  let totalPoints = 0;
  const maxPerCategory = assessment.maxPerCategory || 2;
  const maxPoints = (assessment.categories || []).length * maxPerCategory;

  for (const cat of assessment.categories || []) {
    let pts = 0;
    let explanation = "";

    switch (cat.check) {
      case "viewed": {
        const required = cat.params?.items || ["ticket", "communication"];
        const matchCount = required.filter(item => (projections.viewed || []).includes(item)).length;
        pts = Math.min(maxPerCategory, matchCount * (cat.perItem || 1));
        if (pts === 2) {
          explanation = "Both incident ticket and customer communication reviewed.";
        } else if (pts === 1) {
          explanation = "Ticket reviewed; customer communication not reviewed.";
        } else {
          explanation = "Incident ticket details were not thoroughly reviewed before action.";
        }
        break;
      }

      case "toolsTouched": {
        const targetTools = cat.params?.tools || ["ipconfig", "ping", "dns", "voip"];
        const touched = targetTools.filter(t => (projections.touchedTools || []).includes(t));
        const count = touched.length;
        if (count >= 3) pts = 2;
        else if (count >= 1) pts = 1;
        else pts = 0;
        explanation = `${count} of ${targetTools.length} diagnostic tools used (${touched.join(", ") || "none"}).`;
        break;
      }

      case "finding": {
        const latestFinding = projections.findings?.[projections.findings.length - 1];
        const hypothesis = latestFinding?.hypothesisId || "none";
        const rule = cat.params?.[hypothesis];
        if (typeof rule === "number") {
          pts = rule;
        } else if (rule && typeof rule === "object") {
          const reqMin = rule.requiresToolsTouchedMin || 0;
          if ((projections.touchedTools || []).length >= reqMin) {
            pts = rule.points;
          } else {
            pts = 0;
          }
        } else {
          pts = 0;
        }

        if (hypothesis === "static-ip") {
          explanation = "Recorded finding matched the actual fault (off-subnet static IP configuration).";
        } else if (hypothesis === "dns-failure" || hypothesis === "isp-outage") {
          explanation = `Recorded finding (${hypothesis}) was a symptom of routing failure rather than root cause.`;
        } else if (hypothesis === "cabling-nic") {
          explanation = "Recorded physical cabling fault contradicted active link status.";
        } else {
          explanation = "No hypothesis was recorded during the investigation.";
        }
        break;
      }

      case "deniedActions": {
        const denied = projections.deniedCount || 0;
        if (denied === 0) {
          pts = 2;
          explanation = "No unauthorized or unprivileged actions attempted.";
        } else {
          pts = 1;
          explanation = `${denied} action(s) attempted before customer authorization or privilege were in place.`;
        }
        break;
      }

      case "fixState": {
        if (projections.fixApplied && projections.healthy) {
          pts = 2;
          explanation = "DHCP restored through authorized, elevated configuration change.";
        } else if (projections.fixAttempted) {
          pts = 1;
          explanation = "Configuration change attempted but not successfully applied or did not resolve the issue.";
        } else {
          pts = 0;
          explanation = "No corrective configuration change applied.";
        }
        break;
      }

      case "postFixProbes": {
        const count = (projections.postFixProbes || []).length;
        if (count >= 2) {
          pts = 2;
          explanation = `${count} post-fix verification probes confirmed operational state.`;
        } else if (count >= 1) {
          pts = 1;
          explanation = "1 post-fix probe confirmed; additional verification needed.";
        } else {
          explanation = "No post-fix verification probes recorded while healthy.";
        }
        break;
      }

      default:
        pts = 0;
        explanation = "Check evaluated.";
    }

    totalPoints += pts;
    categories.push({
      id: cat.id,
      points: pts,
      max: maxPerCategory,
      explanation
    });
  }

  // Outcome evaluation
  let outcome = "unresolved";
  for (const rule of assessment.outcomeRules || []) {
    if (rule.when === "else") {
      outcome = rule.outcome;
      break;
    }
    let matched = true;
    if (rule.when.fixApplied !== undefined && Boolean(rule.when.fixApplied) !== Boolean(projections.fixApplied && projections.healthy)) {
      matched = false;
    }
    if (rule.when.postFixProbesMin !== undefined && (projections.postFixProbes || []).length < rule.when.postFixProbesMin) {
      matched = false;
    }
    if (matched) {
      outcome = rule.outcome;
      break;
    }
  }

  // Classification of learner actions
  const classificationCounts = {
    helpful: 0,
    inconclusive: 0,
    blocked: 0,
    incorrect: 0,
    unnecessary: 0
  };

  const learnerActions = actions.filter(a => a.actor === "learner");
  for (const a of learnerActions) {
    if (a.outcome?.status === "denied") {
      classificationCounts.blocked++;
    } else if (a.type === "finding.record" && a.params?.hypothesisId === "cabling-nic") {
      classificationCounts.incorrect++;
    } else if (a.type === "finding.record" && ["dns-failure", "isp-outage"].includes(a.params?.hypothesisId)) {
      classificationCounts.inconclusive++;
    } else if (a.type === "tool.run" && !projections.healthy) {
      // Diagnostic tool run while faulty provides inconclusive symptoms
      classificationCounts.inconclusive++;
    } else if (a.type === "nav.blocked") {
      classificationCounts.unnecessary++;
    } else {
      classificationCounts.helpful++;
    }
  }

  const latestFinding = projections.findings?.[projections.findings.length - 1] || null;

  return {
    schema: "trace.result.v1",
    id: `res-${Date.now()}`,
    sessionRef: { schema: "trace.session.v1", id: exerciseManifest.id },
    exerciseRef: { schema: "trace.exercise.v1", id: exerciseManifest.id },
    assessedThroughSeq: actions.length,
    engine: { version: "0.2.0" },
    rubricVersion: assessment.rubricVersion || "legacy-1",
    generatedAt: new Date().toISOString(),
    outcome,
    score: {
      points: totalPoints,
      max: maxPoints,
      percent: Math.round((totalPoints / maxPoints) * 100)
    },
    categories,
    finalFinding: latestFinding ? { hypothesisId: latestFinding.hypothesisId, seq: latestFinding.seq } : null,
    correctiveAction: {
      applied: Boolean(projections.fixApplied && projections.healthy)
    },
    verification: projections.verification || [],
    classification: classificationCounts
  };
}
