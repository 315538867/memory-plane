const { nextId } = require("../engine/id");

function buildCandidates(evidenceItems) {
  const groups = groupEvidence(evidenceItems);
  return Object.values(groups).map(buildCandidateFromGroup).filter(Boolean);
}

function groupEvidence(evidenceItems) {
  return evidenceItems.reduce((acc, evidence) => {
    const key = evidence.topic_key;
    acc[key] = acc[key] || [];
    acc[key].push(evidence);
    return acc;
  }, {});
}

function buildCandidateFromGroup(group) {
  const scope = group[0].scope;
  const explicit = group.filter((item) => item.type === "explicit");
  const structural = group.filter((item) => item.type === "structural");
  const behavioral = group.filter((item) => item.type === "behavioral");

  if (explicit.length > 0) {
    return buildPreferenceCandidate(group, scope, explicit, structural, behavioral);
  }

  if (structural.length > 0 || behavioral.length > 0) {
    return buildComponentConventionCandidate(group, scope, structural, behavioral);
  }

  return null;
}

function buildPreferenceCandidate(group, scope, explicit, structural, behavioral) {
  const strongest = explicit.sort((a, b) => b.strength - a.strength)[0];
  const claim = strongest.payload.normalized_claim;
  return {
    candidate_id: nextId("candidate"),
    memory_type: "user_preference",
    claim,
    scope,
    why_store: buildPreferenceWhyStore(claim),
    evidence_ids: group.map((item) => item.evidence_id),
    features: {
      explicit_support: averageStrength(explicit),
      structural_support: averageStrength(structural),
      behavioral_support: averageStrength(behavioral),
      cross_source_count: countSourceKinds(group),
      reuse_span: 0,
      replacement_count: 0,
      speculation_risk: 0,
      sensitivity_risk: 0
    },
    status: "candidate",
    first_seen_at: strongest.timestamp,
    last_seen_at: strongest.timestamp
  };
}

function buildComponentConventionCandidate(group, scope, structural, behavioral) {
  const structuralPayload = structural[0] ? structural[0].payload : {};
  const behavioralPayload = behavioral[0] ? behavioral[0].payload : {};
  const componentName = structuralPayload.componentName || behavioralPayload.componentName;
  if (!componentName) {
    return null;
  }

  const structuralSupport = averageStrength(structural);
  const behavioralSupport = averageStrength(behavioral);
  const shouldTreatAsProjectConvention =
    /button$/i.test(componentName) &&
    (structuralSupport >= 0.55 ||
      behavioralSupport >= 0.6 ||
      (behavioralPayload.newUsageCount || 0) >= 5);

  if (!shouldTreatAsProjectConvention) {
    return null;
  }

  return {
    candidate_id: nextId("candidate"),
    memory_type: "project_constraint",
    claim: `项目默认按钮抽象应优先复用 ${componentName}。`,
    scope,
    why_store: "保持 UI 一致性，避免重复封装和样式漂移。",
    evidence_ids: group.map((item) => item.evidence_id),
    features: {
      explicit_support: 0,
      structural_support: structuralSupport,
      behavioral_support: behavioralSupport,
      cross_source_count: countSourceKinds(group),
      reuse_span: behavioralPayload.newUsageCount || 0,
      replacement_count: behavioralPayload.replacementCount || 0,
      speculation_risk: 0,
      sensitivity_risk: 0
    },
    status: "candidate",
    first_seen_at: group[0].timestamp,
    last_seen_at: group[group.length - 1].timestamp
  };
}

function buildPreferenceWhyStore(claim) {
  if (claim.includes("中文")) {
    return "避免未来重复确认沟通语言。";
  }
  return "避免未来重复确认协作流程，并降低走错工作流的概率。";
}

function averageStrength(items) {
  if (!items || items.length === 0) {
    return 0;
  }
  return items.reduce((sum, item) => sum + item.strength, 0) / items.length;
}

function countSourceKinds(items) {
  return new Set(items.map((item) => item.type)).size;
}

module.exports = {
  buildCandidates
};
