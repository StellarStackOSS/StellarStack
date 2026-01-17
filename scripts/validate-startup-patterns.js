#!/usr/bin/env node

/**
 * Validate Pterodactyl egg startup patterns through StellarStack transformation pipeline
 * Usage: node scripts/validate-startup-patterns.js <path-to-egg.json>
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("❌ Usage: node scripts/validate-startup-patterns.js <path-to-egg.json>");
  console.error("");
  console.error("Example:");
  console.error("  node scripts/validate-startup-patterns.js minecraft-vanilla.json");
  console.error("  node scripts/validate-startup-patterns.js ~/downloads/pterodactyl-egg.json");
  process.exit(1);
}

const eggFile = args[0];

if (!fs.existsSync(eggFile)) {
  console.error(`❌ Error: File not found: ${eggFile}`);
  process.exit(1);
}

// Parse egg JSON
let egg;
try {
  const content = fs.readFileSync(eggFile, "utf-8");
  egg = JSON.parse(content);
} catch (error) {
  console.error(`❌ Error parsing JSON: ${error.message}`);
  process.exit(1);
}

// Extract basic info
const name = egg.name || "Unknown";
const author = egg.author || "Unknown";
const description = egg.description || "N/A";

console.log("━".repeat(80));
console.log(`🔍 Analyzing Pterodactyl Egg: ${path.basename(eggFile)}`);
console.log("━".repeat(80));
console.log("");

console.log("📦 Egg Info:");
console.log(`  Name: ${name}`);
console.log(`  Author: ${author}`);
console.log(`  Description: ${description}`);
console.log("");

// Extract startup config
console.log("📋 Raw Pterodactyl Config:");
console.log("");

const startupConfigStr = egg.config?.startup || "{}";
let startupConfig = {};

try {
  startupConfig = JSON.parse(startupConfigStr);
} catch {
  console.log(`  ⚠️  Could not parse config.startup as JSON`);
  startupConfig = {};
}

console.log("  config.startup:");
console.log(
  JSON.stringify(startupConfig, null, 4)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
);
console.log("");

// Extract done patterns
const donePatterns = Array.isArray(startupConfig.done)
  ? startupConfig.done
  : startupConfig.done
    ? [startupConfig.done]
    : [];

if (donePatterns.length === 0) {
  console.log("⚠️  Warning: No 'done' patterns found in startup config");
  console.log("");
} else {
  console.log(`✓ Found ${donePatterns.length} startup pattern(s):`);
  console.log("");
  donePatterns.forEach((pattern, i) => {
    console.log(`    ${String(i + 1).padStart(2, " ")}. ${pattern}`);
  });
  console.log("");
}

// Show transformation stages
console.log("━".repeat(80));
console.log("🔄 Transformation Pipeline");
console.log("━".repeat(80));
console.log("");

// Stage 1: Pterodactyl Input
console.log("1️⃣  Pterodactyl Input Format");
console.log('   Format: { "done": ["pattern1", "pattern2"], ... }');
console.log("   Data:");
console.log("   {");
console.log('     "done": [');
if (donePatterns.length > 0) {
  donePatterns.forEach((p, i) => {
    const comma = i < donePatterns.length - 1 ? "," : "";
    console.log(`       "${p}"${comma}`);
  });
} else {
  console.log("       (no patterns)");
}
console.log("     ]");
console.log("   }");
console.log("");

// Stage 2: StellarStack Blueprint Storage
console.log("2️⃣  StellarStack Blueprint Storage (Native Pterodactyl Format)");
console.log('   Format: { "done": ["pattern1", "pattern2"], ... } (stored as JSON string in config.startup)');
console.log("   Data:");
console.log("   {");
console.log('     "done": [');
if (donePatterns.length > 0) {
  donePatterns.forEach((p, i) => {
    const comma = i < donePatterns.length - 1 ? "," : "";
    console.log(`       "${p}"${comma}`);
  });
} else {
  console.log("       (no patterns)");
}
console.log("     ],");
console.log('     "user_interaction": []');
console.log("   }");
console.log("");

// Stage 3: Daemon Request Format
console.log("3️⃣  Daemon Request Format (process_configuration.startup.done)");
console.log('   Format: ["pattern1", "pattern2"]');
console.log("   Data:");
console.log("   [");
if (donePatterns.length > 0) {
  donePatterns.forEach((p, i) => {
    const comma = i < donePatterns.length - 1 ? "," : "";
    console.log(`     "${p}"${comma}`);
  });
} else {
  console.log("     (no patterns)");
}
console.log("   ]");
console.log("");

// Stage 4: Daemon Processing
console.log("4️⃣  Daemon Processing");
console.log("   The daemon receives the array and:");
console.log("   - Iterates through each pattern");
console.log("   - Tries to compile as regex");
console.log("   - Falls back to literal string match if regex fails");
console.log("   - Watches console output for matches");
console.log("");

if (donePatterns.length > 0) {
  console.log("   Pattern Compilation Results:");
  donePatterns.forEach((pattern) => {
    try {
      new RegExp(pattern);
      console.log(`   ✓ Pattern compiles as regex: ${pattern}`);
    } catch {
      console.log(`   ⚠️  Falls back to literal match: ${pattern}`);
    }
  });
  console.log("");
}

// Stage 5: Export back to Pterodactyl
console.log("5️⃣  Export Back to Pterodactyl Format (No Transformation Needed!)");
console.log("   Since StellarStack stores native Pterodactyl format, export returns it as-is:");
console.log("   {");
console.log('     "done": [');
if (donePatterns.length > 0) {
  donePatterns.forEach((p, i) => {
    const comma = i < donePatterns.length - 1 ? "," : "";
    console.log(`       "${p}"${comma}`);
  });
} else {
  console.log("       (no patterns)");
}
console.log("     ],");
console.log('     "user_interaction": []');
console.log("   }");
console.log("");

// Validation
console.log("━".repeat(80));
console.log("✅ Validation Results");
console.log("━".repeat(80));
console.log("");

let issues = 0;

// Check 1: Has startup config
if (!startupConfig || Object.keys(startupConfig).length === 0) {
  console.log("⚠️  No startup config found - server will be marked as RUNNING immediately");
  issues++;
} else {
  console.log("✓ Has startup config");
}

// Check 2: Has done patterns
if (donePatterns.length === 0) {
  console.log("⚠️  No 'done' patterns found - server will be marked as RUNNING immediately");
  issues++;
} else {
  console.log(`✓ Has ${donePatterns.length} done pattern(s)`);
}

// Check 3: Patterns not empty
if (donePatterns.length > 0) {
  const emptyCount = donePatterns.filter((p) => !p || p.trim() === "").length;
  if (emptyCount > 0) {
    console.log(`⚠️  ${emptyCount} pattern(s) are empty strings`);
    issues++;
  } else {
    console.log("✓ All patterns are non-empty");
  }
}

// Check 4: Valid JSON
try {
  JSON.parse(JSON.stringify(egg));
  console.log("✓ Valid JSON format");
} catch {
  console.log("❌ Invalid JSON format in egg file");
  issues++;
}

// Check 5: Regex compilation
if (donePatterns.length > 0) {
  const regexIssues = donePatterns.filter((p) => {
    try {
      new RegExp(p);
      return false;
    } catch {
      return true;
    }
  }).length;

  if (regexIssues > 0) {
    console.log(`ℹ️  ${regexIssues} pattern(s) will use literal matching (not regex)`);
  } else {
    console.log("✓ All patterns are valid regex");
  }
}

console.log("");
console.log("━".repeat(80));
if (issues === 0) {
  console.log("✅ All checks passed - egg should import correctly");
} else {
  console.log(`⚠️  Found ${issues} issue(s) - review above`);
}
console.log("━".repeat(80));
console.log("");
