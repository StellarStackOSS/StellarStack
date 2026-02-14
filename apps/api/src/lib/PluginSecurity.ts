/**
 * StellarStack Plugin Security Analyzer
 *
 * Performs static analysis and security checks on plugins before installation.
 * Looks for suspicious patterns, vulnerable dependencies, and code issues.
 */

import { promises as fs } from "fs";
import path from "path";

// ============================================
// Types
// ============================================

interface SecurityIssue {
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  file?: string;
  line?: number;
}

export interface SecurityReport {
  score: number; // 0-100
  issues: SecurityIssue[];
  warnings: string[];
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
}

// ============================================
// Plugin Security Analyzer
// ============================================

export class PluginSecurityAnalyzer {
  /**
   * Analyze a plugin directory for security issues.
   */
  async analyze(pluginDir: string): Promise<SecurityReport> {
    const issues: SecurityIssue[] = [];
    const warnings: string[] = [];

    try {
      // 1. Analyze manifest
      await this.analyzeManifest(pluginDir, issues);

      // 2. Scan for suspicious code patterns
      await this.scanForSuspiciousPatterns(pluginDir, issues);

      // 3. Check package.json for vulnerable dependencies
      await this.checkDependencies(pluginDir, issues);

      // 4. Check file permissions
      await this.checkFilePermissions(pluginDir, issues);

      // 5. Look for secrets in files
      await this.lookForSecrets(pluginDir, issues);
    } catch (error) {
      warnings.push(`Security analysis incomplete: ${String(error)}`);
    }

    // Calculate risk level and score
    const { score, riskLevel } = this.calculateRiskLevel(issues);

    return {
      score,
      issues,
      warnings,
      riskLevel,
    };
  }

  // ============================================
  // Analysis Methods
  // ============================================

  private async analyzeManifest(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    try {
      const manifestPath = path.join(pluginDir, "stellarstack.json");
      const content = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);

      // Check for excessive permissions
      if (manifest.permissions) {
        const perms = manifest.permissions as string[];
        if (perms.includes("*")) {
          issues.push({
            severity: "critical",
            message: "Plugin requests all permissions (*)",
            file: "stellarstack.json",
          });
        }
        if (perms.length > 10) {
          issues.push({
            severity: "warning",
            message: `Plugin requests many permissions (${perms.length})`,
            file: "stellarstack.json",
          });
        }
      }

      // Check if author is verified
      if (!manifest.author || manifest.author === "") {
        issues.push({
          severity: "warning",
          message: "Plugin has no author specified",
          file: "stellarstack.json",
        });
      }

      // Check license
      if (!manifest.license) {
        issues.push({
          severity: "info",
          message: "Plugin has no license specified",
          file: "stellarstack.json",
        });
      }

      // Check version is reasonable
      if (!manifest.version) {
        issues.push({
          severity: "error",
          message: "Plugin has no version",
          file: "stellarstack.json",
        });
      }
    } catch (error) {
      issues.push({
        severity: "error",
        message: `Failed to analyze manifest: ${String(error)}`,
        file: "stellarstack.json",
      });
    }
  }

  private async scanForSuspiciousPatterns(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    const jsFiles = await this.findFiles(pluginDir, /\.(js|ts|jsx|tsx)$/);

    for (const file of jsFiles) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const relativePath = path.relative(pluginDir, file);

        // Check for dangerous patterns
        const patterns = [
          {
            pattern: /eval\s*\(/g,
            severity: "critical" as const,
            message: "Use of eval() detected",
          },
          {
            pattern: /Function\s*\(/g,
            severity: "critical" as const,
            message: "Use of Function() constructor detected",
          },
          {
            pattern: /require\s*\(\s*['"]/g,
            severity: "warning" as const,
            message: "Dynamic require() detected",
          },
          {
            pattern: /child_process|spawn|exec/g,
            severity: "warning" as const,
            message: "Process spawning detected",
          },
          {
            pattern: /password|secret|key|token/gi,
            severity: "warning" as const,
            message: "Hardcoded secret detected (review manually)",
          },
          {
            pattern: /http:\/\//g,
            severity: "info" as const,
            message: "Unencrypted HTTP connection",
          },
        ];

        for (const { pattern, severity, message } of patterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const line = content.substring(0, match.index).split("\n").length;
            issues.push({
              severity,
              message,
              file: relativePath,
              line,
            });
            // Limit issues per file
            if (issues.length > 50) break;
          }
          if (issues.length > 50) break;
        }

        if (issues.length > 50) break;
      } catch (error) {
        // Skip unreadable files
      }
    }
  }

  private async checkDependencies(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    try {
      const packagePath = path.join(pluginDir, "package.json");
      const content = await fs.readFile(packagePath, "utf-8");
      const pkg = JSON.parse(content);

      // Check for outdated/vulnerable packages
      const knownVulnerable = [
        "lodash@<4.17.21",
        "serialize-javascript@<3.1.0",
        "yargs-parser@<13.1.2",
      ];

      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const [name, version] of Object.entries(deps)) {
        for (const vuln of knownVulnerable) {
          if (vuln.includes(name)) {
            issues.push({
              severity: "warning",
              message: `Potentially vulnerable dependency: ${name}@${version}`,
              file: "package.json",
            });
          }
        }
      }

      // Check for many dependencies
      const depCount = Object.keys(deps).length;
      if (depCount > 50) {
        issues.push({
          severity: "info",
          message: `Plugin has many dependencies (${depCount})`,
          file: "package.json",
        });
      }
    } catch (error) {
      // No package.json or invalid JSON - not necessarily an issue
    }
  }

  private async checkFilePermissions(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    try {
      // Check for potentially dangerous files
      const dangerousPatterns = [
        /\.env$/,
        /\.env\.\w+$/,
        /credentials\.json$/,
        /secrets\.json$/,
        /private_key/,
        /\.pem$/,
      ];

      const files = await this.findAllFiles(pluginDir);

      for (const file of files) {
        const basename = path.basename(file);
        for (const pattern of dangerousPatterns) {
          if (pattern.test(basename)) {
            issues.push({
              severity: "critical",
              message: `Dangerous file detected: ${basename}`,
              file: path.relative(pluginDir, file),
            });
          }
        }
      }
    } catch (error) {
      // Skip if we can't read directory
    }
  }

  private async lookForSecrets(
    pluginDir: string,
    issues: SecurityIssue[]
  ): Promise<void> {
    try {
      const jsFiles = await this.findFiles(pluginDir, /\.(js|ts|json)$/);

      for (const file of jsFiles) {
        try {
          const content = await fs.readFile(file, "utf-8");

          // Look for hardcoded secrets
          const secretPatterns = [
            /(['\"])(?:.*)?(?:api[_-]?key|password|secret|token)(?:.*)?['\"]\s*:\s*['\"][^'\"]{20,}/gi,
            /(?:api[_-]?key|password|secret|token|auth)\s*=\s*['"][^'\"]{20,}['\"]/gi,
          ];

          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              issues.push({
                severity: "critical",
                message: "Potential hardcoded secret detected",
                file: path.relative(pluginDir, file),
              });
              break;
            }
          }
        } catch (error) {
          // Skip unreadable files
        }
      }
    } catch (error) {
      // Skip if we can't enumerate files
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async findFiles(
    dir: string,
    pattern: RegExp,
    maxFiles = 500
  ): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentPath: string) => {
      if (results.length >= maxFiles) return;

      try {
        const entries = await fs.readdir(currentPath);

        for (const entry of entries) {
          if (results.length >= maxFiles) return;

          // Skip common directories
          if (["node_modules", ".git", "dist", "build"].includes(entry)) {
            continue;
          }

          const fullPath = path.join(currentPath, entry);
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            await walk(fullPath);
          } else if (pattern.test(entry)) {
            results.push(fullPath);
          }
        }
      } catch (error) {
        // Skip if we can't read directory
      }
    };

    await walk(dir);
    return results;
  }

  private async findAllFiles(
    dir: string,
    maxFiles = 1000
  ): Promise<string[]> {
    const results: string[] = [];

    const walk = async (currentPath: string) => {
      if (results.length >= maxFiles) return;

      try {
        const entries = await fs.readdir(currentPath);

        for (const entry of entries) {
          if (results.length >= maxFiles) return;

          // Skip common directories
          if (["node_modules", ".git", "dist", "build"].includes(entry)) {
            continue;
          }

          const fullPath = path.join(currentPath, entry);
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            await walk(fullPath);
          } else {
            results.push(fullPath);
          }
        }
      } catch (error) {
        // Skip if we can't read directory
      }
    };

    await walk(dir);
    return results;
  }

  private calculateRiskLevel(
    issues: SecurityIssue[]
  ): { score: number; riskLevel: "safe" | "low" | "medium" | "high" | "critical" } {
    // Count issues by severity
    const critical = issues.filter((i) => i.severity === "critical").length;
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const infos = issues.filter((i) => i.severity === "info").length;

    // Calculate score (100 = safe, 0 = critical)
    let score = 100;
    score -= critical * 40; // Critical issues are very bad
    score -= errors * 20; // Errors are bad
    score -= warnings * 5; // Warnings are minor
    score -= infos * 1; // Info is just for awareness

    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    let riskLevel: "safe" | "low" | "medium" | "high" | "critical";

    if (critical > 0 || score < 20) {
      riskLevel = "critical";
    } else if (errors > 0 || score < 40) {
      riskLevel = "high";
    } else if (warnings > 0 || score < 60) {
      riskLevel = "medium";
    } else if (infos > 0 || score < 80) {
      riskLevel = "low";
    } else {
      riskLevel = "safe";
    }

    return { score, riskLevel };
  }
}
