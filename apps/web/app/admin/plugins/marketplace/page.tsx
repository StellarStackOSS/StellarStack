"use client";

import { useState } from "react";
import Button from "@stellarUI/components/Button/Button";
import Input from "@stellarUI/components/Input/Input";
import Card, {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@stellarUI/components/Card/Card";
import Badge from "@stellarUI/components/Badge/Badge";
import Dialog, {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stellarUI/components/Dialog/Dialog";
import { BsDownload, BsCheckCircle, BsExclamationTriangle, BsShield, BsX } from "react-icons/bs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "@/lib/Api";
import type { PluginInfo } from "@/lib/Api";

interface SecurityReport {
  score: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  issues: Array<{
    severity: "info" | "warning" | "error" | "critical";
    message: string;
    file?: string;
  }>;
  warnings: string[];
}

interface PluginInstallResponse {
  success: boolean;
  plugin: {
    pluginId: string;
    name: string;
    version: string;
    trustLevel: string;
    securityScore: number;
    securityReport: SecurityReport;
  };
  message: string;
}

export default function PluginMarketplacePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<{
    pluginId: string;
    name: string;
    securityReport: SecurityReport;
  } | null>(null);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const queryClient = useQueryClient();

  // Fetch list of installed plugins
  const { data: installedPlugins = [] } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => pluginsApi.listPlugins(),
  });

  // Install plugin mutation
  const installMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: url, branch: "main" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to install plugin");
      }

      return (await response.json()) as PluginInstallResponse;
    },
    onSuccess: (data) => {
      setSelectedPlugin({
        pluginId: data.plugin.pluginId,
        name: data.plugin.name,
        securityReport: data.plugin.securityReport,
      });
      setShowSecurityDetails(true);
      setRepoUrl("");
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
    },
  });

  const handleInstall = async () => {
    if (!repoUrl.trim()) {
      alert("Please enter a repository URL");
      return;
    }
    await installMutation.mutateAsync(repoUrl);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "safe":
        return "bg-green-100 text-green-800 border-green-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSecurityIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case "safe":
        return <BsCheckCircle className="mr-2 inline" />;
      case "critical":
        return <BsX className="mr-2 inline" />;
      default:
        return <BsExclamationTriangle className="mr-2 inline" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plugin Marketplace</h1>
        <p className="mt-2 text-gray-600">
          Install plugins from Git repositories to extend StellarStack functionality.
        </p>
      </div>

      {/* Installation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Install Plugin from Git Repository</CardTitle>
          <CardDescription>
            Enter the URL of a public Git repository containing a StellarStack plugin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Repository URL</label>
            <Input
              placeholder="https://gitlab.com/username/stellarstack-plugin-name"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={installMutation.isPending}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleInstall();
              }}
            />
            <p className="text-xs text-gray-500">
              Example: https://gitlab.com/StellarStackOSS/example-mod-installer
            </p>
          </div>

          {installMutation.error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {String(installMutation.error)}
            </div>
          )}

          <Button
            onClick={handleInstall}
            disabled={installMutation.isPending || !repoUrl.trim()}
            className="w-full"
          >
            {installMutation.isPending ? (
              <>
                <BsDownload className="mr-2 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <BsDownload className="mr-2" />
                Install Plugin
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Security Analysis Results */}
      {selectedPlugin && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <BsShield className="mr-2" />
                  Security Analysis: {selectedPlugin.name}
                </CardTitle>
                <CardDescription>
                  Automated security scan results for the installed plugin
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPlugin(null);
                  setShowSecurityDetails(false);
                }}
              >
                <BsX />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Risk Level Badge */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Risk Level:</span>
              <Badge className={getRiskColor(selectedPlugin.securityReport.riskLevel)}>
                {getSecurityIcon(selectedPlugin.securityReport.riskLevel)}
                {selectedPlugin.securityReport.riskLevel.toUpperCase()}
              </Badge>
            </div>

            {/* Security Score */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Security Score:</span>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-48 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      selectedPlugin.securityReport.score >= 80
                        ? "bg-green-500"
                        : selectedPlugin.securityReport.score >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${selectedPlugin.securityReport.score}%` }}
                  />
                </div>
                <span className="font-bold">{selectedPlugin.securityReport.score}/100</span>
              </div>
            </div>

            {/* Issues/Warnings */}
            {selectedPlugin.securityReport.issues.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 font-medium">Issues Found:</h4>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {selectedPlugin.securityReport.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="rounded border-l-4 border-orange-400 bg-white p-2 text-sm"
                    >
                      <div className="font-medium">
                        {issue.severity === "critical" && "🔴"}
                        {issue.severity === "error" && "🟠"}
                        {issue.severity === "warning" && "🟡"}
                        {issue.severity === "info" && "🔵"} {issue.severity.toUpperCase()}
                      </div>
                      <div className="text-gray-700">{issue.message}</div>
                      {issue.file && <div className="text-xs text-gray-500">{issue.file}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPlugin.securityReport.warnings.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 font-medium">Warnings:</h4>
                <div className="space-y-1">
                  {selectedPlugin.securityReport.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start text-sm text-yellow-800">
                      <span className="mr-2">⚠️</span>
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPlugin.securityReport.issues.length === 0 &&
              selectedPlugin.securityReport.warnings.length === 0 && (
                <div className="flex items-center rounded border border-green-300 bg-green-50 p-4 text-green-800">
                  <BsCheckCircle className="mr-2 flex-shrink-0" />
                  <span>No issues detected. This plugin appears to be safe.</span>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Installed Plugins List */}
      <Card>
        <CardHeader>
          <CardTitle>Installed Plugins ({installedPlugins.length})</CardTitle>
          <CardDescription>
            Community and official plugins installed on this instance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {installedPlugins.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No plugins installed yet. Install one from a Git repository above.
            </p>
          ) : (
            <div className="grid gap-4">
              {installedPlugins.map((plugin: PluginInfo) => (
                <div
                  key={plugin.pluginId}
                  className="rounded-lg border p-4 transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-lg font-medium">{plugin.name}</div>
                      <p className="text-sm text-gray-600">{plugin.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">{plugin.version}</Badge>
                        <Badge
                          variant={plugin.isBuiltIn ? "default" : "secondary"}
                          className={
                            plugin.isBuiltIn
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {plugin.isBuiltIn ? "✓ Official" : "Community"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={plugin.status === "enabled" ? "default" : "secondary"}>
                        {plugin.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Official Plugins Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BsCheckCircle className="mr-2 text-blue-600" />
            About Plugin Trust Levels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-medium text-blue-900">Official Plugins</h4>
            <p className="text-sm text-blue-800">
              Maintained by the StellarStack team. Fully tested and regularly updated.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-blue-900">Community Plugins</h4>
            <p className="text-sm text-blue-800">
              Created by community developers. Automatically analyzed for common security issues.
              Always review the security report before installing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
