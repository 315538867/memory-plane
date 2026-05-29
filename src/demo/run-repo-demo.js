const { runPipeline } = require("../engine/pipeline");
const { collectSnapshotSignals } = require("../signals/from-repo");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    args[key] = value;
    i += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.repo) {
    throw new Error("Missing required argument: --repo /abs/path/to/repo");
  }

  const signals = collectSnapshotSignals({
    repoPath: args.repo,
    componentName: args.component || "BaseButton",
    userId: args.user || "u_local",
    project: args.project,
    repo: args.repoName,
    historyDays: args["history-days"] || "30",
    maxCommits: args["max-commits"] || "120"
  });

  const result = runPipeline(signals);
  const first = result.decisions[0];
  if (!first) {
    console.log("no candidates produced");
    return;
  }

  console.log(`component: ${args.component || "BaseButton"}`);
  console.log(`history window: ${args["history-days"] || "30"} days`);
  console.log(`history enabled: ${signals[1]?.source?.origin === "git-history-window" ? "yes" : "no"}`);
  console.log(`claim: ${first.candidate.claim}`);
  console.log(`score: ${first.candidate.scores.promotion_score}`);
  console.log(`decision: ${first.decision.decision}`);
  console.log(`reasons: ${first.decision.reason_codes.join(", ") || "none"}`);
  console.log(`accepted memories: ${result.memories.length}`);
}

main();
