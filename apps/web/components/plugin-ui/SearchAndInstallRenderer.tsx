"use client";

import { useState } from "react";
import type { SearchAndInstallSchema } from "@stellarstack/plugin-sdk";
import { usePluginAction } from "@/hooks/queries/use-plugin-actions";
import { pluginsApi } from "@/lib/api";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import { Badge } from "@stellarUI/components/Badge/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@stellarUI/components/Dialog/Dialog";
import { cn } from "@stellarUI/lib/utils";
import { BsSearch, BsArrowClockwise, BsExclamationTriangle } from "react-icons/bs";

// ============================================
// Props
// ============================================

interface SearchAndInstallRendererProps {
  schema: SearchAndInstallSchema;
  pluginId: string;
  serverId: string;
  pluginConfig?: Record<string, unknown>;
}

interface SearchResult {
  id: string | number;
  [key: string]: unknown;
}

// ============================================
// Component
// ============================================

export function SearchAndInstallRenderer({
  schema,
  pluginId,
  serverId,
  pluginConfig,
}: SearchAndInstallRendererProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const installMutation = usePluginAction(pluginId, schema.installAction);

  // ============================================
  // Search Handler
  // ============================================

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await pluginsApi.executeAction(pluginId, schema.searchAction, {
        serverId,
        inputs: { query },
      });

      if (response.success && response.data) {
        const searchData = response.data as { items: SearchResult[] };
        setResults(searchData.items || []);
      } else {
        setError(response.error || "Search failed");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // Detail Handler
  // ============================================

  const handleViewDetails = async (item: SearchResult) => {
    if (schema.detailAction) {
      setIsLoading(true);
      try {
        const response = await pluginsApi.executeAction(pluginId, schema.detailAction, {
          serverId,
          inputs: { id: item.id },
        });

        if (response.success && response.data) {
          setSelectedItem({ ...item, ...response.data } as SearchResult);
        } else {
          setSelectedItem(item);
        }
      } catch (err) {
        setError(String(err));
        setSelectedItem(item);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSelectedItem(item);
    }
  };

  // ============================================
  // Install Handler
  // ============================================

  const handleInstall = async () => {
    if (!selectedItem) return;

    installMutation.mutate({
      serverId,
      inputs: selectedItem,
    });
  };

  // ============================================
  // Render
  // ============================================

  const resultCard = schema.fields.resultCard as any;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <Input
          placeholder={schema.fields.searchInput.placeholder || "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
          className="flex-1"
        />
        <TextureButton onClick={() => handleSearch(searchQuery)} disabled={isLoading}>
          {isLoading ? <BsArrowClockwise className="h-4 w-4 animate-spin" /> : <BsSearch className="h-4 w-4" />}
        </TextureButton>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600">
          <BsExclamationTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((item) => (
          <div
            key={item.id}
            className="cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20 hover:bg-white/10"
            onClick={() => handleViewDetails(item)}
          >
            {resultCard.image && item[resultCard.image] && (
              <div className="mb-2 aspect-video overflow-hidden rounded bg-gray-900">
                <img
                  src={String(item[resultCard.image])}
                  alt="Item"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <h3 className="line-clamp-2 font-semibold text-white">
              {String(item[resultCard.title])}
            </h3>
            {resultCard.subtitle && item[resultCard.subtitle] && (
              <p className="line-clamp-1 text-xs text-gray-400">
                {String(item[resultCard.subtitle])}
              </p>
            )}
            {resultCard.description && item[resultCard.description] && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                {String(item[resultCard.description])}
              </p>
            )}
            {resultCard.metadata && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(resultCard.metadata as any[]).map((meta: any) => (
                  <Badge key={meta.field} variant="secondary" className="text-xs">
                    {meta.label}: {formatMetadataValue(item[meta.field], meta.format)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{String(selectedItem[resultCard.title])}</DialogTitle>
              <DialogDescription>
                {String(selectedItem[resultCard.subtitle] || "Item details")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-4">
              {resultCard.image && selectedItem[resultCard.image] && (
                <div className="aspect-video overflow-hidden rounded bg-gray-900">
                  <img
                    src={String(selectedItem[resultCard.image])}
                    alt="Item"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {resultCard.description && selectedItem[resultCard.description] && (
                <p className="text-sm text-gray-300">
                  {String(selectedItem[resultCard.description])}
                </p>
              )}

              {resultCard.metadata && (
                <div className="space-y-2">
                  {(resultCard.metadata as any[]).map((meta: any) => (
                    <div key={meta.field} className="flex items-center justify-between rounded bg-white/5 p-2">
                      <span className="text-sm text-gray-400">{meta.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {formatMetadataValue(selectedItem[meta.field], meta.format)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <TextureButton
                onClick={handleInstall}
                disabled={installMutation.isPending}
                className="w-full"
              >
                {installMutation.isPending ? (
                  <>
                    <BsArrowClockwise className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  "Install"
                )}
              </TextureButton>

              {installMutation.isError && (
                <div className="rounded bg-red-500/10 p-3 text-sm text-red-600">
                  Installation failed: {String(installMutation.error)}
                </div>
              )}

              {installMutation.isSuccess && (
                <div className="rounded bg-green-500/10 p-3 text-sm text-green-600">
                  Installation started successfully!
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function formatMetadataValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) {
    return "—";
  }

  switch (format) {
    case "date":
      return new Date(String(value)).toLocaleDateString();
    case "number":
      return Number(value).toLocaleString();
    default:
      return String(value);
  }
}
