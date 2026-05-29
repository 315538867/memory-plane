function scoreCandidate(candidate) {
  const explicit = candidate.features.explicit_support;
  const structural = candidate.features.structural_support;
  const behavioral = candidate.features.behavioral_support;

  const stability = scoreStability(candidate.memory_type, explicit, structural, behavioral);
  const reusability = scoreReusability(candidate.memory_type, explicit, structural, behavioral);
  const actionability = scoreActionability(candidate.memory_type, explicit, structural, behavioral);
  const evidence_strength = scoreEvidenceStrength(explicit, structural, behavioral, candidate.features.cross_source_count);
  const novelty = 0.8;
  const recurrence = scoreRecurrence(candidate.memory_type, candidate.features);

  const wrong_if_false_cost =
    candidate.memory_type === "project_constraint" ? 0.4 : 0.3;
  const sensitivity_risk = candidate.features.sensitivity_risk || 0;

  const promotion_score = clamp(
    stability * 0.2 +
      reusability * 0.2 +
      actionability * 0.2 +
      evidence_strength * 0.2 +
      novelty * 0.1 +
      recurrence * 0.1 -
      wrong_if_false_cost * 0.15 -
      sensitivity_risk * 0.25
  );

  return {
    stability,
    reusability,
    actionability,
    evidence_strength,
    novelty,
    recurrence,
    wrong_if_false_cost,
    sensitivity_risk,
    promotion_score
  };
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function scoreStability(memoryType, explicit, structural, behavioral) {
  if (memoryType === "user_preference") {
    return clamp(Math.max(explicit, behavioral * 0.9));
  }

  return clamp(Math.max(structural * 0.95, behavioral * 0.9, explicit * 0.8));
}

function scoreReusability(memoryType, explicit, structural, behavioral) {
  if (memoryType === "user_preference") {
    return clamp(Math.max(explicit * 0.95, behavioral * 0.9, 0.7));
  }

  return clamp(Math.max(structural * 0.95, behavioral * 0.95, 0.65));
}

function scoreActionability(memoryType, explicit, structural, behavioral) {
  if (memoryType === "user_preference") {
    return clamp(Math.max(explicit * 0.95, 0.88));
  }

  if (memoryType === "project_constraint") {
    return clamp(Math.max(structural * 0.9, behavioral * 0.9, 0.9));
  }

  return clamp(Math.max(explicit * 0.85, structural * 0.8, behavioral * 0.8, 0.75));
}

function scoreEvidenceStrength(explicit, structural, behavioral, crossSourceCount) {
  const maxSupport = Math.max(explicit, structural, behavioral);
  return clamp(maxSupport + Math.min(0.1, crossSourceCount * 0.05));
}

function scoreRecurrence(memoryType, features) {
  if (memoryType === "user_preference") {
    return clamp(Math.max(features.explicit_support * 0.75, features.behavioral_support));
  }

  return clamp(
    Math.min(1, features.reuse_span / 8) * 0.6 +
      Math.min(1, features.replacement_count / 3) * 0.4
  );
}

module.exports = {
  scoreCandidate
};
