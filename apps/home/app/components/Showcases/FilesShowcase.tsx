"use client";

import type { JSX } from "react";
import FeatureShowcase from "./FeatureShowcase";
import { MOCK_FILES, STORAGE_USED_GB, STORAGE_TOTAL_GB } from "./MockData";
import { BsChevronRight, BsFolder2, BsFileEarmark } from "react-icons/bs";

/**
 * Returns the appropriate icon for a file type.
 *
 * @param type - The file entry type
 * @returns Icon JSX element
 */
const FileIcon = ({ type }: { type: "folder" | "file" }): JSX.Element => {
  if (type === "folder") {
    return <BsFolder2 className="text-amber-400" size={16} />;
  }
  return <BsFileEarmark className="text-zinc-400" size={16} />;
};

/**
 * Files showcase section displaying a static file table, breadcrumb
 * navigation, and storage usage bar.
 *
 * @component
 * @returns Files showcase section
 */
const FilesShowcase = (): JSX.Element => {
  const storagePercentage = (STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100;

  return (
    <FeatureShowcase
      label="FILE MANAGEMENT"
      title="Your server files, beautifully organized"
      description="Browse, edit, and manage your server files with an intuitive file manager. Visual folder previews, inline editing, and drag-and-drop uploads make file management effortless."
      features={[
        { text: "Visual folder previews with file counts" },
        { text: "Drag-and-drop file uploads" },
        { text: "Built-in code and config editor" },
        { text: "SFTP integration for bulk transfers" },
        { text: "File permissions editor" },
      ]}
      reversed
      backgroundImage="/bg-purple.png"
    >
      <div className="flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-white/60 px-1">
          <span className="text-white/90">/</span>
          <BsChevronRight size={10} />
          <span className="text-white/90">home</span>
          <BsChevronRight size={10} />
          <span className="text-white/50">server</span>
        </div>

        {/* Storage bar */}
        <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/70">Storage</span>
            <span className="text-sm text-white/50">
              {STORAGE_USED_GB} GB / {STORAGE_TOTAL_GB} GB
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
        </div>

        {/* File table */}
        <div className="rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_100px] gap-4 px-4 py-2.5 text-xs text-white/40 uppercase tracking-wider border-b border-white/5">
            <span>Name</span>
            <span>Size</span>
            <span>Modified</span>
          </div>

          {/* Table rows */}
          {MOCK_FILES.map((file, index) => (
            <div
              key={file.id}
              className={`grid grid-cols-[1fr_80px_100px] gap-4 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                index < MOCK_FILES.length - 1 ? "border-b border-white/5" : ""
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileIcon type={file.type} />
                <span className="truncate text-white/90">{file.name}</span>
              </div>
              <span className="text-white/50">{file.size}</span>
              <span className="text-white/40 text-xs">{file.modified}</span>
            </div>
          ))}
        </div>
      </div>
    </FeatureShowcase>
  );
};

export default FilesShowcase;
