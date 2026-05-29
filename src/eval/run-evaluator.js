const fs = require("node:fs");
const path = require("node:path");
const { runPipeline } = require("../engine/pipeline");
const { collectSnapshotSignals } = require("../signals/from-repo");

function main() {
  const casesPath = path.resolve(__dirname, "evaluator-cases.json");
  const { cases } = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const summary = {
    totalCases: 0,
    passedCases: 0,
    failedCases: 0,
    acceptedMetrics: {
      tp: 0,
      fp: 0,
      fn: 0
    },
    holdMetrics: {
      tp: 0,
      fp: 0,
      fn: 0
    }
  };

  const caseResults = cases.map((testCase) => evaluateCase(testCase, summary));
  printReport(caseResults, summary);

  if (summary.failedCases > 0) {
    process.exitCode = 1;
  }
}

function evaluateCase(testCase, summary) {
  const rawSignals = loadSignals(testCase);
  const result = runPipeline(rawSignals);

  const predictions = result.decisions.map((item) => ({
    claim: item.candidate.claim,
    decision: item.decision.decision,
    score: item.candidate.scores.promotion_score
  }));
  const predictionByClaim = new Map(predictions.map((item) => [item.claim, item]));
  const expectationList = testCase.expectations || [];

  const mismatches = [];
  const matchedAcceptedClaims = new Set();
  let acceptedPredictions = predictions.filter((item) => item.decision === "accepted");

  for (const expectation of expectationList) {
    const predicted = predictionByClaim.get(expectation.claim);
    if (!predicted) {
      mismatches.push(`missing claim: ${expectation.claim}`);
      if (expectation.decision === "accepted") {
        summary.acceptedMetrics.fn += 1;
      } else if (expectation.decision === "needs_confirmation") {
        summary.holdMetrics.fn += 1;
      }
      continue;
    }

    if (predicted.decision !== expectation.decision) {
      mismatches.push(
        `decision mismatch for "${expectation.claim}": expected=${expectation.decision}, got=${predicted.decision}`
      );
    }

    if (expectation.decision === "accepted") {
      if (predicted.decision === "accepted") {
        summary.acceptedMetrics.tp += 1;
        matchedAcceptedClaims.add(expectation.claim);
      } else {
        summary.acceptedMetrics.fn += 1;
      }
    } else if (expectation.decision === "needs_confirmation") {
      if (predicted.decision === "needs_confirmation") {
        summary.holdMetrics.tp += 1;
      } else {
        summary.holdMetrics.fn += 1;
      }
    }
  }

  for (const predicted of acceptedPredictions) {
    const expected = expectationList.find((item) => item.claim === predicted.claim);
    if (!expected || expected.decision !== "accepted") {
      summary.acceptedMetrics.fp += 1;
      if (testCase.strictNoExtraAccepted) {
        mismatches.push(`unexpected accepted claim: ${predicted.claim}`);
      }
    }
  }

  for (const predicted of predictions.filter((item) => item.decision === "needs_confirmation")) {
    const expected = expectationList.find((item) => item.claim === predicted.claim);
    if (!expected || expected.decision !== "needs_confirmation") {
      summary.holdMetrics.fp += 1;
    }
  }

  if (testCase.strictNoCandidates && predictions.length > 0) {
    mismatches.push(`expected no candidates, got ${predictions.length}`);
  }

  const passed = mismatches.length === 0;
  summary.totalCases += 1;
  if (passed) {
    summary.passedCases += 1;
  } else {
    summary.failedCases += 1;
  }

  return {
    name: testCase.name,
    caseSource: describeCaseSource(testCase),
    passed,
    mismatches,
    predictions
  };
}

function loadSignals(testCase) {
  const type = testCase.type || "fixture";
  if (type === "fixture") {
    const fixturePath = path.resolve(__dirname, "../../examples", testCase.fixture);
    return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  }

  if (type === "repo") {
    const repoPath = path.resolve(__dirname, "../../examples", testCase.repoPath);
    return collectSnapshotSignals({
      repoPath,
      componentName: testCase.componentName || "BaseButton",
      userId: testCase.userId || "u_eval",
      project: testCase.project || "memory-plane",
      repo: testCase.repo || path.basename(repoPath),
      historyDays: String(testCase.historyDays || 30),
      maxCommits: String(testCase.maxCommits || 120)
    });
  }

  throw new Error(`Unsupported case type: ${type}`);
}

function describeCaseSource(testCase) {
  const type = testCase.type || "fixture";
  if (type === "fixture") {
    return `fixture:${testCase.fixture}`;
  }
  return `repo:${testCase.repoPath} component=${testCase.componentName || "BaseButton"}`;
}

function printReport(caseResults, summary) {
  console.log("=== Evaluator Report ===");
  for (const caseResult of caseResults) {
    console.log(`\n[${caseResult.passed ? "PASS" : "FAIL"}] ${caseResult.name}`);
    console.log(`source: ${caseResult.caseSource}`);
    if (caseResult.predictions.length === 0) {
      console.log("predictions: none");
    } else {
      for (const prediction of caseResult.predictions) {
        console.log(
          `prediction: claim="${prediction.claim}" decision=${prediction.decision} score=${prediction.score}`
        );
      }
    }
    for (const mismatch of caseResult.mismatches) {
      console.log(`mismatch: ${mismatch}`);
    }
  }

  const { tp, fp, fn } = summary.acceptedMetrics;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const hold = calcMetrics(summary.holdMetrics);

  console.log("\n=== Metrics (accepted class) ===");
  console.log(`tp=${tp} fp=${fp} fn=${fn}`);
  console.log(`precision=${precision.toFixed(4)}`);
  console.log(`recall=${recall.toFixed(4)}`);
  console.log(`f1=${f1.toFixed(4)}`);

  console.log("\n=== Metrics (needs_confirmation class) ===");
  console.log(`tp=${summary.holdMetrics.tp} fp=${summary.holdMetrics.fp} fn=${summary.holdMetrics.fn}`);
  console.log(`precision=${hold.precision.toFixed(4)}`);
  console.log(`recall=${hold.recall.toFixed(4)}`);
  console.log(`f1=${hold.f1.toFixed(4)}`);

  console.log("\n=== Summary ===");
  console.log(`total=${summary.totalCases} passed=${summary.passedCases} failed=${summary.failedCases}`);
}

function calcMetrics({ tp, fp, fn }) {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

main();
