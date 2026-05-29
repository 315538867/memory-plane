const fs = require("node:fs");
const path = require("node:path");

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
      newUsageCount: referenceStats.usageFiles.length,
      replacementCount: 0,
      referenceCount: referenceStats.referenceFiles.length,
      referenceSpread: referenceStats.referenceSpread,
      reuseTrendScore: referenceStats.reuseTrendScore,
      convergenceTrendScore: 0
    },
    source: {
      origin: "filesystem-snapshot",
      ref: repoPath
    },
    timestamp: new Date().toISOString()
  };

  return [structuralSignal, behavioralSignal];
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

function safeRead(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

module.exports = {
  collectSnapshotSignals
};

