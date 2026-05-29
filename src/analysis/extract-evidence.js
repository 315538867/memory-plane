const { nextId } = require("../engine/id");

const PREFERENCE_PATTERNS = [
  {
    regex: /中文/,
    claim_hint: "用户偏好中文回复",
    strength: 0.95,
    normalized_claim: "默认使用中文回复。"
  },
  {
    regex: /先审方案.*再动代码|先审方案再动代码/,
    claim_hint: "用户偏好先审方案再动代码",
    strength: 0.95,
    normalized_claim: "涉及实现或重构时，默认先审方案再动代码。"
  }
];

function buildExplicitEvidence(signal) {
  if (signal.kind !== "user_message") {
    return [];
  }

  const text = signal.content.text || "";
  return PREFERENCE_PATTERNS.filter((pattern) => pattern.regex.test(text)).map(
    (pattern) => ({
      evidence_id: nextId("evidence"),
      type: "explicit",
      scope: signal.scope,
      topic_key: pattern.normalized_claim,
      claim_hint: pattern.claim_hint,
      signals: [signal.signal_id],
      payload: {
        text,
        normalized_claim: pattern.normalized_claim
      },
      strength: pattern.strength,
      timestamp: signal.timestamp
    })
  );
}

function buildStructuralEvidence(signal) {
  if (!["code_snapshot", "code_change"].includes(signal.kind)) {
    return [];
  }

  const content = signal.content || {};
  if (!content.componentName) {
    return [];
  }

  const evidence = [];
  if (content.layer || content.exportedFrom || content.wrapsPrimitive || content.supportingAssets) {
    evidence.push({
      evidence_id: nextId("evidence"),
      type: "structural",
      scope: signal.scope,
      topic_key: `component:${content.componentName}`,
      claim_hint: `${content.componentName} 具有公共层结构特征`,
      signals: [signal.signal_id],
      payload: {
        componentName: content.componentName,
        path: content.path,
        layer: content.layer,
        exportedFrom: content.exportedFrom,
        wrapsPrimitive: content.wrapsPrimitive,
        supportingAssets: content.supportingAssets || []
      },
      strength: computeStructuralStrength(content),
      timestamp: signal.timestamp
    });
  }

  return evidence;
}

function buildBehavioralEvidence(signal) {
  if (signal.kind !== "code_change") {
    return [];
  }

  const content = signal.content || {};
  if (!content.componentName) {
    return [];
  }

  return [
    {
      evidence_id: nextId("evidence"),
      type: "behavioral",
      scope: signal.scope,
      topic_key: `component:${content.componentName}`,
      claim_hint: `${content.componentName} 出现持续复用和替换收敛`,
      signals: [signal.signal_id],
      payload: {
        componentName: content.componentName,
        newUsageCount: content.newUsageCount || 0,
        replacementCount: content.replacementCount || 0,
        referenceCount: content.referenceCount || 0,
        referenceSpread: content.referenceSpread || 0,
        reuseTrendScore: content.reuseTrendScore || 0,
        convergenceTrendScore: content.convergenceTrendScore || 0
      },
      strength: computeBehavioralStrength(content),
      timestamp: signal.timestamp
    }
  ];
}

function computeStructuralStrength(content) {
  let score = 0;
  if (String(content.layer || "").includes("shared")) {
    score += 0.35;
  }
  if (content.exportedFrom) {
    score += 0.25;
  }
  if (content.wrapsPrimitive) {
    score += 0.2;
  }
  if ((content.supportingAssets || []).length > 0) {
    score += 0.1;
  }
  return Math.min(1, score);
}

function computeBehavioralStrength(content) {
  let score = 0;
  if ((content.newUsageCount || 0) >= 5) {
    score += 0.35;
  }
  if ((content.replacementCount || 0) >= 2) {
    score += 0.2;
  }
  score += Math.min(0.25, (content.referenceSpread || 0) * 0.25);
  score += Math.min(0.2, (content.reuseTrendScore || 0) * 0.1 + (content.convergenceTrendScore || 0) * 0.1);
  return Math.min(1, score);
}

function extractEvidence(signals) {
  return signals.flatMap((signal) => [
    ...buildExplicitEvidence(signal),
    ...buildStructuralEvidence(signal),
    ...buildBehavioralEvidence(signal)
  ]);
}

module.exports = {
  extractEvidence
};

