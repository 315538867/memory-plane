const { resetIds } = require("./id");
const { normalizeSignals } = require("../signals/normalize");
const { extractEvidence } = require("../analysis/extract-evidence");
const { buildCandidates } = require("../candidates/build-candidates");
const { matchCandidate } = require("../matching/match-candidate");
const { scoreCandidate } = require("../scoring/score-candidate");
const { promoteCandidate } = require("../promotion/promote");
const { createRegistry, applyDecision } = require("../state/registry");

function runPipeline(rawSignals, registry = createRegistry()) {
  resetIds();

  const signals = normalizeSignals(rawSignals);
  const evidence = extractEvidence(signals);
  const candidates = buildCandidates(evidence).map((candidate) => ({
    ...candidate,
    scores: scoreCandidate(candidate)
  }));

  const decisions = candidates.map((candidate) => {
    const matchResult = matchCandidate(candidate, registry);
    const decision = promoteCandidate(candidate, matchResult);
    applyDecision(candidate, decision, registry);
    return {
      candidate,
      decision
    };
  });

  return {
    signals,
    evidence,
    decisions,
    memories: registry.memories
  };
}

module.exports = {
  runPipeline
};

