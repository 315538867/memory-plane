const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".mjs", ".cjs"]);
const INDEX_CANDIDATES = new Set(["index.ts", "index.js", "index.mjs", "index.cjs"]);
const SHARED_SEGMENTS = ["shared", "ui", "components/base", "base"];

function collectSnapshotSignals(options) {
  const repoPath = path.resolve(options.repoPath);
  const componentName = options.componentName || "BaseButton";
  const scope = buildScope(options, path.basename(repoPath));

  const allFiles = listFiles(repoPath);
  const codeFiles = allFiles.filter((file) => CODE_EXTENSIONS.has(path.extname(file)));

  const componentFile = findComponentFile(codeFiles, componentName);
  if (!componentFile) {
    throw new Error(`Cannot find component file for ${componentName} under ${repoPath}`);
  }

  const relativeComponentPath = path.relative(repoPath, componentFile).replaceAll("\\", "/");
  const exportFile = findExportFile(codeFiles, componentName);
  const relativeExportFile = exportFile
    ? path.relative(repoPath, exportFile).replaceAll("\\", "/")
    : null;

  const referenceStats = collectReferenceStats({
    codeFiles,
    repoPath,
    componentName,
    componentFile,
    exportFile
  });
  const historyStats = collectHistoryStats({
    repoPath,
    componentName,
    historyDays: Number(options.historyDays || 30),
    maxCommits: Number(options.maxCommits || 120)
  });

  const structuralSignal = {
    kind: "code_snapshot",
    scope,
    content: {
      componentName,
      path: relativeComponentPath,
      layer: inferLayer(relativeComponentPath),
      exportedFrom: relativeExportFile,
      wrapsPrimitive: inferWrappedPrimitive(componentFile),
      supportingAssets: findSupportingAssets(componentFile)
    },
    source: {
      origin: "filesystem",
      ref: relativeComponentPath
    },
    timestamp: new Date().toISOString()
  };

  const behavioralSignal = {
    kind: "code_change",
    scope,
    content: {
      componentName,
      newUsageCount: Math.max(referenceStats.usageFiles.length, historyStats.newUsageAdds),
      replacementCount: historyStats.replacementCount,
      referenceCount: referenceStats.referenceFiles.length,
      referenceSpread: referenceStats.referenceSpread,
      reuseTrendScore: Math.max(referenceStats.reuseTrendScore, historyStats.reuseTrendScore),
      convergenceTrendScore: historyStats.convergenceTrendScore
    },
    source: {
      origin: historyStats.historyEnabled ? "git-history-window" : "filesystem-snapshot",
      ref: historyStats.historyEnabled
        ? `${repoPath} (last ${historyStats.historyDays} days)`
        : repoPath
    },
    timestamp: new Date().toISOString()
  };

  return [structuralSignal, behavioralSignal];
}

function collectHistoryStats({ repoPath, componentName, historyDays, maxCommits }) {
  const empty = {
    historyEnabled: false,
    historyDays,
    newUsageAdds: 0,
    replacementCount: 0,
    reuseTrendScore: 0,
    convergenceTrendScore: 0
  };

  if (!isGitRepository(repoPath)) {
    return empty;
  }

  const commitIds = listRecentCommits(repoPath, historyDays, maxCommits);
  if (commitIds.length === 0) {
    return { ...empty, historyEnabled: true };
  }

  let newUsageAdds = 0;
  let replacementCount = 0;
  let commitsWithUsage = 0;
  let commitsWithReplacement = 0;

  for (const commitId of commitIds) {
    const diff = readCommitDiff(repoPath, commitId);
    const stats = analyzeDiffForComponent(diff, componentName);
    newUsageAdds += stats.newUsageAdds;
    replacementCount += stats.replacementCount;
    if (stats.newUsageAdds > 0) {
      commitsWithUsage += 1;
    }
    if (stats.replacementCount > 0) {
      commitsWithReplacement += 1;
    }
  }

  const reuseTrendScore = clamp(
    Math.min(1, newUsageAdds / 12) * 0.7 +
      Math.min(1, commitsWithUsage / Math.max(1, commitIds.length)) * 0.3
  );
  const convergenceTrendScore = clamp(
    Math.min(1, replacementCount / 6) * 0.7 +
      Math.min(1, commitsWithReplacement / Math.max(1, commitIds.length)) * 0.3
  );

  return {
    historyEnabled: true,
    historyDays,
    newUsageAdds,
    replacementCount,
    reuseTrendScore,
    convergenceTrendScore
  };
}

function buildScope(options, repoName) {
  return {
    user_id: options.userId || "u_local",
    project: options.project || repoName,
    repo: options.repo || repoName
  };
}

function listFiles(rootPath) {
  const files = [];
  const stack = [rootPath];
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

function findComponentFile(codeFiles, componentName) {
  return codeFiles.find((file) => path.basename(file).startsWith(componentName));
}

function findExportFile(codeFiles, componentName) {
  return codeFiles.find((file) => {
    if (!INDEX_CANDIDATES.has(path.basename(file))) {
      return false;
    }
    const content = safeRead(file);
    return content.includes(componentName);
  });
}

function collectReferenceStats({ codeFiles, repoPath, componentName, componentFile, exportFile }) {
  const referenceFiles = [];
  const usageFiles = [];
  const moduleBuckets = new Set();

  for (const file of codeFiles) {
    if (file === componentFile || file === exportFile) {
      continue;
    }
    const content = safeRead(file);
    if (!content.includes(componentName)) {
      continue;
    }
    referenceFiles.push(file);
    if (hasUsagePattern(content, componentName)) {
      usageFiles.push(file);
      moduleBuckets.add(firstSegment(path.relative(repoPath, file)));
    }
  }

  const referenceCount = referenceFiles.length;
  const spreadBase = Math.max(1, usageFiles.length);
  const referenceSpread = clamp(moduleBuckets.size / spreadBase);
  const reuseTrendScore = clamp(Math.min(1, usageFiles.length / 8));

  return {
    referenceFiles,
    usageFiles,
    referenceCount,
    referenceSpread,
    reuseTrendScore
  };
}

function hasUsagePattern(content, componentName) {
  return content.includes(`<${componentName}`) || content.includes(`from '${componentName}`) || content.includes(`from "${componentName}`);
}

function firstSegment(relativePath) {
  return relativePath.replaceAll("\\", "/").split("/")[0] || "root";
}

function inferLayer(relativePath) {
  const normalized = relativePath.toLowerCase();
  for (const segment of SHARED_SEGMENTS) {
    if (normalized.includes(segment)) {
      return "shared-ui";
    }
  }
  return "feature-local";
}

function inferWrappedPrimitive(componentFile) {
  const content = safeRead(componentFile);
  if (content.includes("<button") || content.includes("button")) {
    return "button";
  }
  return null;
}

function findSupportingAssets(componentFile) {
  const dir = path.dirname(componentFile);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const assets = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const lower = entry.name.toLowerCase();
    if (lower.includes("story")) {
      assets.push("story");
    }
    if (lower.includes("test") || lower.includes("spec")) {
      assets.push("test");
    }
    if (lower.includes("token")) {
      assets.push("tokens");
    }
    if (lower.endsWith(".md")) {
      assets.push("doc");
    }
  }
  return Array.from(new Set(assets));
}

function isGitRepository(repoPath) {
  try {
    childProcess.execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

function listRecentCommits(repoPath, historyDays, maxCommits) {
  try {
    const output = childProcess.execFileSync(
      "git",
      [
        "log",
        "--pretty=format:%H",
        `--since=${historyDays}.days`,
        "-n",
        String(maxCommits)
      ],
      {
        cwd: repoPath,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readCommitDiff(repoPath, commitId) {
  try {
    return childProcess.execFileSync(
      "git",
      ["show", "--pretty=format:", "--unified=0", commitId],
      {
        cwd: repoPath,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }
    );
  } catch {
    return "";
  }
}

function analyzeDiffForComponent(diffText, componentName) {
  if (!diffText) {
    return { newUsageAdds: 0, replacementCount: 0 };
  }

  const lines = diffText.split("\n");
  let addedUsage = 0;
  let replacementCount = 0;
  let hunkAddedComponent = 0;
  let hunkRemovedPrimitive = 0;

  function flushHunk() {
    replacementCount += Math.min(hunkAddedComponent, hunkRemovedPrimitive);
    hunkAddedComponent = 0;
    hunkRemovedPrimitive = 0;
  }

  for (const line of lines) {
    if (line.startsWith("diff --git") || line.startsWith("@@")) {
      flushHunk();
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (isComponentTemplateAdd(line, componentName)) {
        addedUsage += 1;
        hunkAddedComponent += 1;
      } else if (isComponentImportAdd(line, componentName)) {
        addedUsage += 1;
      }
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      if (isPrimitiveTemplateRemove(line)) {
        hunkRemovedPrimitive += 1;
      }
    }
  }
  flushHunk();

  return {
    newUsageAdds: addedUsage,
    replacementCount
  };
}

function isComponentTemplateAdd(line, componentName) {
  const templateRegex = new RegExp(`^\\+\\s*<\\s*${escapeRegex(componentName)}\\b`);
  return templateRegex.test(line);
}

function isComponentImportAdd(line, componentName) {
  const importRegex = new RegExp(`^\\+\\s*import\\b[^\\n]*\\b${escapeRegex(componentName)}\\b`);
  return importRegex.test(line);
}

function isPrimitiveTemplateRemove(line) {
  return /^-\s*<\s*button\b/i.test(line);
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeRead(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

module.exports = {
  collectSnapshotSignals
};
