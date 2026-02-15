/**
 * StellarStack Plugin Installer
 *
 * Handles installation, updates, and uninstallation of plugins from Git repositories.
 * Includes validation, security analysis, and trust level assignment.
 */

import { promises as fs } from "fs";
import path from "path";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./Db";
import type { PluginManifest } from "./PluginManager";

// ============================================
// Types
// ============================================

export interface InstallOptions {
  repoUrl: string;
  branch?: string;
  trustLevel?: "official" | "community";
}

export interface SecurityReport {
  score: number; // 0-100
  issues: SecurityIssue[];
  warnings: string[];
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
}

interface SecurityIssue {
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  file?: string;
  line?: number;
}

// ============================================
// Plugin Installer
// ============================================

export class PluginInstaller {
  private tempDir = "/tmp/stellarstack-plugins";
  private pluginDir = "/var/lib/stellarstack/plugins";

  /**
   * Install a plugin from a Git repository.
   * Clones the repo, validates the manifest, runs security analysis,
   * and registers the plugin in the database.
   */
  async installFromGit(options: InstallOptions): Promise<unknown> {
    const { repoUrl, branch = "main", trustLevel = "community" } = options;

    // Validate Git URL
    this.validateGitUrl(repoUrl);

    // Generate temp directory
    const tempPluginDir = path.join(this.tempDir, randomUUID());

    try {
      // 1. Clone repository
      console.log(`[PluginInstaller] Cloning ${repoUrl}...`);
      this.cloneRepository(repoUrl, branch, tempPluginDir);

      // 2. Load and validate manifest
      console.log(`[PluginInstaller] Validating manifest...`);
      const manifest = await this.loadAndValidateManifest(tempPluginDir);

      // 3. Run security analysis
      console.log(`[PluginInstaller] Running security analysis...`);
      const securityReport = await this.analyzeSecurityAsync(tempPluginDir);

      // 4. Determine trust level
      const finalTrustLevel = this.determineTrustLevel(repoUrl, trustLevel, securityReport);

      // 5. Check if plugin already exists
      const existing = await db.plugin.findUnique({
        where: { pluginId: manifest.id },
      });

      if (existing && existing.isBuiltIn) {
        throw new Error("Cannot override built-in plugins");
      }

      // 6. Move plugin to permanent location
      const pluginPath = path.join(this.pluginDir, manifest.id);
      await this.moveDirectory(tempPluginDir, pluginPath);

      // 7. Register in database
      const plugin = existing
        ? await this.updatePlugin(manifest, pluginPath, finalTrustLevel, repoUrl, securityReport)
        : await this.createPlugin(manifest, pluginPath, finalTrustLevel, repoUrl, securityReport);

      console.log(`[PluginInstaller] Plugin ${manifest.id} installed successfully`);
      return plugin;
    } catch (error) {
      // Clean up temp directory
      try {
        await fs.rm(tempPluginDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to clean up temp directory:", e);
      }
      throw error;
    }
  }

  /**
   * Update an installed plugin to the latest version from its Git repository.
   */
  async update(pluginId: string): Promise<unknown> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.isBuiltIn) {
      throw new Error("Cannot update built-in plugins this way");
    }

    const pluginRecord = plugin as unknown as Record<string, unknown>;
    const gitRepoUrl = pluginRecord.gitRepoUrl as string | undefined;
    if (!gitRepoUrl) {
      throw new Error("Plugin was not installed from Git repository");
    }

    // Install with update flag (will overwrite existing)
    return await this.installFromGit({
      repoUrl: gitRepoUrl,
      branch: (pluginRecord.gitBranch as string) || "main",
      trustLevel: (pluginRecord.trustLevel as "official" | "community") || "community",
    });
  }

  /**
   * Uninstall a plugin.
   * Only non-built-in plugins can be uninstalled.
   */
  async uninstall(pluginId: string): Promise<void> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId },
    });

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.isBuiltIn) {
      throw new Error("Cannot uninstall built-in plugins");
    }

    // Disable if enabled
    if (plugin.status === "enabled") {
      await db.plugin.update({
        where: { id: plugin.id },
        data: { status: "disabled" },
      });
    }

    // Delete from database
    await db.plugin.delete({
      where: { id: plugin.id },
    });

    // Delete files
    const pluginPath = path.join(this.pluginDir, pluginId);
    try {
      await fs.rm(pluginPath, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete plugin directory: ${pluginPath}`, e);
    }

    console.log(`[PluginInstaller] Plugin ${pluginId} uninstalled`);
  }

  // ============================================
  // Private Methods
  // ============================================

  private validateGitUrl(url: string): void {
    // Allow GitHub, GitLab, Gitea, and other common Git hosting services
    const validPatterns = [
      /^https?:\/\/github\.com\//,
      /^https?:\/\/gitlab\.com\//,
      /^https?:\/\/gitea\.io\//,
      /^https?:\/\/.*\.github\.com\//,
      /^https?:\/\/.*\.gitlab\.com\//,
      /^git@github\.com:/,
      /^git@gitlab\.com:/,
    ];

    const isValid = validPatterns.some((pattern) => pattern.test(url));

    if (!isValid) {
      throw new Error(
        `Invalid Git repository URL. Must be from GitHub, GitLab, or similar Git hosting service.`
      );
    }

    // Reject URLs with dangerous patterns
    if (url.includes("..") || url.includes("//") || url.match(/;|&|\||`|\$/)) {
      throw new Error("Invalid characters in Git URL");
    }
  }

  private cloneRepository(repoUrl: string, branch: string, targetDir: string): void {
    try {
      // Create parent directory
      const parentDir = path.dirname(targetDir);
      execSync(`mkdir -p "${parentDir}"`);

      // Clone with depth limit to reduce bandwidth
      execSync(
        `git clone --depth 1 --branch ${branch} --single-branch "${repoUrl}" "${targetDir}"`,
        { timeout: 60000 }
      );
    } catch (error) {
      throw new Error(
        `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async loadAndValidateManifest(pluginDir: string): Promise<PluginManifest> {
    const manifestPath = path.join(pluginDir, "stellarstack.json");

    try {
      const content = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content) as PluginManifest;

      // Validate required fields
      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error("Missing required fields: id, name, or version");
      }

      // Validate plugin ID format (alphanumeric, hyphens, underscores only)
      if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
        throw new Error(
          "Invalid plugin ID. Must contain only lowercase letters, numbers, hyphens, and underscores."
        );
      }

      // Validate version format (semver)
      if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
        throw new Error("Invalid version. Must follow semantic versioning (e.g., 1.0.0)");
      }

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid stellarstack.json: Invalid JSON");
      }
      throw error;
    }
  }

  private async analyzeSecurityAsync(pluginDir: string): Promise<SecurityReport> {
    const { PluginSecurityAnalyzer } = await import("./PluginSecurity");
    const analyzer = new PluginSecurityAnalyzer();
    return analyzer.analyze(pluginDir);
  }

  private determineTrustLevel(
    repoUrl: string,
    userTrustLevel: string,
    securityReport: SecurityReport
  ): "official" | "community" {
    // Check if this is an official StellarStack repository
    const officialRepos = ["gitlab.com/StellarStackOSS/"];

    const isOfficial = officialRepos.some((repo) => repoUrl.includes(repo));

    if (isOfficial) {
      return "official";
    }

    // For community repos, check security risk level
    if (securityReport.riskLevel === "critical" || securityReport.riskLevel === "high") {
      console.warn(`[PluginInstaller] Security warning: ${securityReport.riskLevel} risk detected`);
    }

    return "community";
  }

  private async moveDirectory(source: string, dest: string): Promise<void> {
    try {
      // Create parent directory if needed
      await fs.mkdir(path.dirname(dest), { recursive: true });

      // Remove existing if present
      try {
        await fs.rm(dest, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }

      // Move directory
      await fs.rename(source, dest);
    } catch (error) {
      throw new Error(
        `Failed to move plugin directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createPlugin(
    manifest: PluginManifest,
    pluginPath: string,
    trustLevel: string,
    gitRepoUrl: string,
    securityReport: SecurityReport
  ): Promise<unknown> {
    return await db.plugin.create({
      data: {
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license || "MIT",
        category: manifest.category || "other",
        icon: manifest.icon,
        homepage: manifest.homepage,
        repository: manifest.repository,
        status: "installed",
        isBuiltIn: false,
        gameTypes: manifest.gameTypes || ["*"],
        permissions: manifest.permissions || [],
        manifest: manifest as unknown as Prisma.InputJsonValue,
        config: (manifest.defaultConfig || {}) as unknown as Prisma.InputJsonValue,
        defaultConfig: (manifest.defaultConfig || {}) as unknown as Prisma.InputJsonValue,
        configSchema: manifest.configSchema
          ? (manifest.configSchema as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        trustLevel,
        securityScore: securityReport.score,
        securityReport: securityReport as unknown as Prisma.InputJsonValue,
        gitRepoUrl,
        gitBranch: "main",
        lastChecked: new Date(),
      },
    });
  }

  private async updatePlugin(
    manifest: PluginManifest,
    pluginPath: string,
    trustLevel: string,
    gitRepoUrl: string,
    securityReport: SecurityReport
  ): Promise<unknown> {
    const plugin = await db.plugin.findUnique({
      where: { pluginId: manifest.id },
    });

    if (!plugin) {
      return this.createPlugin(manifest, pluginPath, trustLevel, gitRepoUrl, securityReport);
    }

    return await db.plugin.update({
      where: { id: plugin.id },
      data: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license || "MIT",
        category: manifest.category || "other",
        icon: manifest.icon,
        homepage: manifest.homepage,
        repository: manifest.repository,
        gameTypes: manifest.gameTypes || ["*"],
        permissions: manifest.permissions || [],
        manifest: manifest as unknown as Prisma.InputJsonValue,
        configSchema: manifest.configSchema
          ? (manifest.configSchema as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        trustLevel,
        securityScore: securityReport.score,
        securityReport: securityReport as unknown as Prisma.InputJsonValue,
        gitRepoUrl,
        lastChecked: new Date(),
      },
    });
  }
}

export const pluginInstaller = new PluginInstaller();
