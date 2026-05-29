const fs = require("node:fs");
const path = require("node:path");
const { collectSnapshotSignals } = require("../signals/from-repo");
const { runPipeline } = require("../engine/pipeline");

const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".mjs", ".cjs"]);
const IGNORE_SUFFIXES = [".test", ".spec", ".stories", ".story"];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.repo) {
    throw new Error("Missing required argument: --repo /abs/path/to/repo");
  }

  const repoPath = path.resolve(args.repo);
  const maxComponents = Number(args["max-components"] || 40);
  const historyDays = Number(args["history-days"] || 180);
  const maxCommits = Number(args["max-commits"] || 400);
  const include = (args.include || "button").toLowerCase();

  const componentNames = findComponentCandidates(repoPath, include).slice(0, maxComponents);
  if (componentNames.length === 0) {
    console.log("no component candidates found");
    return;
  }

  const rows = [];
  for (const componentName of componentNames) {
    const outcome = runForComponent({
      repoPath,
      componentName,
      historyDays,
      maxCommits
    });
    rows.push(outcome);
  }

  printSummary(rows, {
    repoPath,
    include,
    historyDays,
    maxCommits
  });
}

function findComponentCandidates(repoPath, include) {
  const files = walkFiles(repoPath);
  const names = new Set();

  for (const file of files) {
    const ext = path.extname(file);
    if (!CODE_EXTENSIONS.has(ext)) {
      continue;
    }
    const basename = path.basename(file, ext);
    const lower = basename.toLowerCase();
    if (!lower.includes(include)) {
      continue;
    }
    if (lower === "index") {
      continue;
    }
    if (IGNORE_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
      continue;
    }
    names.add(basename);
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function runForComponent({ repoPath, componentName, historyDays, maxCommits }) {
  try {
    const signals = collectSnapshotSignals({
      repoPath,
      componentName,
      userId: "u_scan",
      project: path.basename(repoPath),
      repo: path.basename(repoPath),
      historyDays: String(historyDays),
      maxCommits: String(maxCommits)
    });

    const result = runPipeline(signals);
    const first = result.decisions[0];
    if (!first) {
      return {
        componentName,
        status: "no-candidate",
        score: "",
        decision: "",
        reasons: ""
      };
    }

    return {
      componentName,
      status: "candidate",
      score: first.candidate.scores.promotion_score.toFixed(4),
      decision: first.decision.decision,
      reasons: first.decision.reason_codes.join(", ")
    };
  } catch (error) {
    return {
      componentName,
      status: "error",
      score: "",
      decision: "",
      reasons: String(error.message || error)
    };
  }
}

function printSummary(rows, meta) {
  console.log(`repo: ${meta.repoPath}`);
  console.log(`include: ${meta.include}`);
  console.log(`history window: ${meta.historyDays} days, max commits: ${meta.maxCommits}`);
  console.log("");

  const accepted = rows.filter((row) => row.decision === "accepted").length;
  const hold = rows.filter((row) => row.decision === "needs_confirmation").length;
  const rejected = rows.filter((row) => row.decision === "rejected").length;
  const noCandidate = rows.filter((row) => row.status === "no-candidate").length;
  const errors = rows.filter((row) => row.status === "error").length;

  console.log(`total components: ${rows.length}`);
  console.log(`accepted: ${accepted}`);
  console.log(`needs_confirmation: ${hold}`);
  console.log(`rejected: ${rejected}`);
  console.log(`no-candidate: ${noCandidate}`);
  console.log(`errors: ${errors}`);
  console.log("");

  for (const row of rows) {
    console.log(
      `${row.componentName} | ${row.status} | ${row.decision || "-"} | ${row.score || "-"} | ${row.reasons || "-"}`
    );
  }
}

main();

