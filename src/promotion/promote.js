const { THRESHOLDS } = require("../engine/constants");
const { nextId } = require("../engine/id");

function promoteCandidate(candidate, matchResult) {
  if (violatesHardRules(candidate)) {
    return buildDecision(candidate, "rejected", ["insufficient_evidence"]);
  }

  if (matchResult.kind === "reinforce_memory") {
    return buildDecision(candidate, "reinforce_existing", [
      "reinforces_existing_memory"
    ], matchResult.matchedMemory.memory_id);
  }

  if (
    candidate.scores.promotion_score >= THRESHOLDS.ACCEPT &&
    candidate.scores.evidence_strength >= THRESHOLDS.MIN_EVIDENCE_STRENGTH &&
    candidate.scores.sensitivity_risk < THRESHOLDS.MAX_SENSITIVITY_RISK
  ) {
    return buildDecision(candidate, "accepted", inferReasonCodes(candidate));
  }

  if (candidate.scores.promotion_score >= THRESHOLDS.HOLD) {
    return buildDecision(candidate, "needs_confirmation", [
      "insufficient_evidence"
    ]);
  }

  return buildDecision(candidate, "rejected", ["insufficient_evidence"]);
}

function violatesHardRules(candidate) {
  return !candidate.why_store || candidate.evidence_ids.length === 0;
}

function inferReasonCodes(candidate) {
  const reasonCodes = [];
  if (candidate.features.explicit_support >= 0.8) {
    reasonCodes.push("strong_explicit_support");
  }
  if (candidate.features.structural_support >= 0.75) {
    reasonCodes.push("strong_structural_support");
  }
  if (candidate.features.behavioral_support >= 0.75) {
    reasonCodes.push("strong_behavioral_support");
  }
  if (candidate.features.cross_source_count >= 2) {
    reasonCodes.push("cross_source_confirmed");
  }
  if (candidate.features.reuse_span >= 5) {
    reasonCodes.push("reuse_trend_confirmed");
  }
  if (candidate.features.replacement_count >= 2) {
    reasonCodes.push("replacement_trend_confirmed");
  }
  return reasonCodes;
}

function buildDecision(candidate, decision, reasonCodes, matchedMemoryId = null) {
  return {
    decision_id: nextId("decision"),
    candidate_id: candidate.candidate_id,
    decision,
    reason_codes: reasonCodes,
    matched_memory_id: matchedMemoryId,
    matched_candidate_id: null,
    score_snapshot: {
      promotion_score: candidate.scores.promotion_score,
      evidence_strength: candidate.scores.evidence_strength
    },
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  promoteCandidate
};

