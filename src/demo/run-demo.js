const fs = require("node:fs");
const path = require("node:path");
const { runPipeline } = require("../engine/pipeline");

function runFixture(filename) {
  const fixturePath = path.resolve(__dirname, "../../examples", filename);
  const rawSignals = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const result = runPipeline(rawSignals);

  return {
    fixture: filename,
    ...result
  };
}

function printResult(result) {
  console.log(`\n=== ${result.fixture} ===`);
  for (const item of result.decisions) {
    console.log(`claim: ${item.candidate.claim}`);
    console.log(`type: ${item.candidate.memory_type}`);
    console.log(`score: ${item.candidate.scores.promotion_score}`);
    console.log(`decision: ${item.decision.decision}`);
    console.log(`reasons: ${item.decision.reason_codes.join(", ") || "none"}`);
    console.log("");
  }

  console.log(`accepted memories: ${result.memories.length}`);
  for (const memory of result.memories) {
    console.log(`- ${memory.claim} (${memory.memory_type}, confidence=${memory.confidence})`);
  }
}

function main() {
  const fixtures = [
    "user-preference-signals.json",
    "base-button-weak-signals.json",
    "base-button-signals.json"
  ];

  for (const fixture of fixtures) {
    const result = runFixture(fixture);
    printResult(result);
  }
}

main();
