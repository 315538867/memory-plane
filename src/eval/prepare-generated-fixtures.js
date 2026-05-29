const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

function prepareGeneratedFixtures() {
  const generatedRoot = path.resolve(__dirname, "../../examples/.generated");
  ensureDir(generatedRoot);
  prepareRepoFixtureHistory(path.join(generatedRoot, "repo-fixture-history"));
}

function prepareRepoFixtureHistory(repoPath) {
  fs.rmSync(repoPath, { recursive: true, force: true });
  ensureDir(repoPath);

  // Commit 1: local raw button usage.
  writeFile(
    repoPath,
    "src/pages/home/HomePage.vue",
    [
      "<template>",
      "  <button>Home</button>",
      "</template>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/pages/dashboard/DashboardPage.vue",
    [
      "<template>",
      "  <button>Dashboard</button>",
      "</template>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/pages/settings/SettingsPage.vue",
    [
      "<template>",
      "  <button>Settings</button>",
      "</template>",
      ""
    ].join("\n")
  );

  runGit(["init", "-b", "main"], repoPath);
  runGit(["config", "user.name", "fixture-bot"], repoPath);
  runGit(["config", "user.email", "fixture-bot@example.com"], repoPath);
  runGit(["add", "."], repoPath);
  runGit(["commit", "-m", "feat: seed raw button pages"], repoPath);

  // Commit 2: introduce BaseButton and replace existing pages.
  writeFile(
    repoPath,
    "src/shared/ui/BaseButton.vue",
    [
      "<template>",
      "  <button class=\"base-btn\">",
      "    <slot />",
      "  </button>",
      "</template>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/shared/ui/index.ts",
    "export { default as BaseButton } from \"./BaseButton.vue\";\n"
  );

  writeFile(
    repoPath,
    "src/pages/home/HomePage.vue",
    [
      "<template>",
      "  <BaseButton>Home</BaseButton>",
      "</template>",
      "",
      "<script setup>",
      "import { BaseButton } from \"../../shared/ui\";",
      "</script>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/pages/dashboard/DashboardPage.vue",
    [
      "<template>",
      "  <BaseButton>Dashboard</BaseButton>",
      "</template>",
      "",
      "<script setup>",
      "import { BaseButton } from \"../../shared/ui\";",
      "</script>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/pages/settings/SettingsPage.vue",
    [
      "<template>",
      "  <BaseButton>Settings</BaseButton>",
      "</template>",
      "",
      "<script setup>",
      "import { BaseButton } from \"../../shared/ui\";",
      "</script>",
      ""
    ].join("\n")
  );

  runGit(["add", "."], repoPath);
  runGit(["commit", "-m", "refactor: replace raw button with BaseButton"], repoPath);

  // Commit 3: expand reuse footprint.
  writeFile(
    repoPath,
    "src/pages/reports/ReportsPage.vue",
    [
      "<template>",
      "  <BaseButton>Reports</BaseButton>",
      "</template>",
      "",
      "<script setup>",
      "import { BaseButton } from \"../../shared/ui\";",
      "</script>",
      ""
    ].join("\n")
  );
  writeFile(
    repoPath,
    "src/pages/messages/MessagesPage.vue",
    [
      "<template>",
      "  <BaseButton>Messages</BaseButton>",
      "</template>",
      "",
      "<script setup>",
      "import { BaseButton } from \"../../shared/ui\";",
      "</script>",
      ""
    ].join("\n")
  );
  runGit(["add", "."], repoPath);
  runGit(["commit", "-m", "feat: extend BaseButton adoption"], repoPath);
}

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  ensureDir(path.dirname(absolutePath));
  fs.writeFileSync(absolutePath, content, "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runGit(args, cwd) {
  childProcess.execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

module.exports = {
  prepareGeneratedFixtures
};

