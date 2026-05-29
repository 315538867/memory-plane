function createRegistry() {
  return {
    candidates: [],
    memories: [],
    decisions: []
  };
}

function applyDecision(candidate, decision, registry) {
  registry.decisions.push(decision);

  if (decision.decision === "accepted") {
    registry.memories.push({
      memory_id: `mem_${candidate.candidate_id}`,
      memory_type: candidate.memory_type,
      claim: candidate.claim,
      scope: candidate.scope,
      why_store: candidate.why_store,
      evidence_ids: candidate.evidence_ids,
      confidence: candidate.scores.promotion_score,
      status: "accepted",
      first_seen_at: candidate.first_seen_at,
      last_seen_at: candidate.last_seen_at,
      supersedes: [],
      conflicts_with: [],
      expires_at: null
    });
    return;
  }

  if (decision.decision === "reinforce_existing") {
    const target = registry.memories.find(
      (memory) => memory.memory_id === decision.matched_memory_id
    );
    if (target) {
      target.evidence_ids = Array.from(
        new Set([...target.evidence_ids, ...candidate.evidence_ids])
      );
      target.last_seen_at = candidate.last_seen_at;
      target.confidence = Math.min(
        1,
        Number((target.confidence + 0.03).toFixed(4))
      );
    }
    return;
  }

  registry.candidates.push({
    ...candidate,
    status: decision.decision
  });
}

module.exports = {
  createRegistry,
  applyDecision
};

