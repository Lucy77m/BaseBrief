#!/usr/bin/env node

const CACHE_READY_PATTERNS = [
  /prompt cache/i,
  /cache-ready/i,
  /稳定前缀/,
  /缓存代理实验/,
];

const FULL_PATTERNS = [
  /完整阶段基线/,
  /新窗口开场/,
  /Agent 任务说明/i,
  /风险红线/,
  /复杂项目归档/,
  /\bfull\b/i,
];

const LITE_PATTERNS = [
  /轻量接续/,
  /简短交接/,
  /只读接续/,
  /1\s*(?:-|到|至|–)\s*2\s*个文件/,
  /小范围任务/,
  /\blite\b/i,
];

const LITE_BLOCKERS = [
  /backend/i,
  /provider/i,
  /\.env/i,
  /api key/i,
  /部署/,
  /多文件大改/,
  /快速推进/,
  /真实\s*Agent\s*runtime/i,
  /frontend.*backend.*deploy/i,
  /backend.*frontend.*deploy/i,
  /\bstate\b/i,
  /\bmemory\b/i,
  /gateway/i,
  /runtime/i,
  /边界不清/,
  /帮我优化一下/,
];

function routeMode(input) {
  const text = String(input || "");
  if (CACHE_READY_PATTERNS.some((pattern) => pattern.test(text))) {
    return "cache-ready";
  }
  if (FULL_PATTERNS.some((pattern) => pattern.test(text))) {
    return "full";
  }
  if (LITE_BLOCKERS.some((pattern) => pattern.test(text))) {
    return "full";
  }
  if (LITE_PATTERNS.some((pattern) => pattern.test(text))) {
    return "lite";
  }
  return "needs-clarification";
}

function cli() {
  const input = process.argv.slice(2).join(" ").trim();
  if (!input) {
    console.error("Usage: node scripts/mode_router.js <request text>");
    process.exit(1);
  }
  console.log(routeMode(input));
}

if (require.main === module) {
  cli();
}

module.exports = { routeMode };
