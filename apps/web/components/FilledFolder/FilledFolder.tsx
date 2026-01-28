"use client";

import { motion } from "framer-motion";
import React, { useMemo } from "react";

interface FilledFolderProps {
  folderName: string;
  folderQuantity: number;
}

const FilledFolder: React.FC<FilledFolderProps> = ({ folderName, folderQuantity }) => {
  // One random rotation per render (symmetrical)
  const sideRotation = useMemo(() => {
    return Math.random() * 12 + 12;
  }, []);

  return (
    <motion.div
      whileHover="hover"
      initial="rest"
      animate="rest"
      className="{/* TODO: FIGURE OUT THE SIZING ISSUES FOR MOBILES?*/} /* responsive sizing */ relative flex h-40 w-32 cursor-pointer flex-col items-center justify-between rounded-lg border border-transparent p-4 text-center transition-all duration-300 hover:border-white/10 hover:bg-white/5 sm:h-48 sm:w-48 md:h-56 md:w-56 lg:h-64 lg:w-64"
      style={{
        // single scale source of truth
        // tweak if you want tighter/looser stacks
        // @ts-expect-error CSS custom property
        "--folder-scale": "1",
      }}
    >
      {/* Folder visual */}
      <div
        className="relative aspect-square"
        style={{
          width: "calc(11rem * var(--folder-scale))",
        }}
      >
        {/* Folder line */}
        <img
          src="/custom/folder_line.png"
          alt="folder-line"
          className="absolute bottom-[35%] left-1/2 z-50 w-[90%] -translate-x-1/2 opacity-75"
        />

        {/* Folder back */}
        <img
          src="/custom/folder_back.png"
          alt="folder-back"
          className="absolute inset-0 z-10 w-full"
        />

        {/* Left sheet */}
        <motion.img
          src="/custom/folder_sheet.png"
          alt="folder-sheet-left"
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
          style={{
            width: "calc(5rem * var(--folder-scale))",
            x: "-18%",
          }}
          variants={{
            rest: {
              y: "22%",
              scale: 0.96,
              rotate: 0,
            },
            hover: {
              y: "-12%",
              scale: 1,
              rotate: -sideRotation,
            },
          }}
          transition={{
            duration: 0.15,
            delay: 0.08,
            ease: "easeOut",
          }}
        />

        {/* Center sheet */}
        <motion.img
          src="/custom/folder_sheet_text.png"
          alt="folder-sheet-center"
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{
            width: "calc(5rem * var(--folder-scale))",
          }}
          variants={{
            rest: {
              y: "22%",
              scale: 0.96,
            },
            hover: {
              y: "-26%",
              scale: 1,
            },
          }}
          transition={{
            duration: 0.15,
            ease: "easeOut",
          }}
        />

        {/* Right sheet */}
        <motion.img
          src="/custom/folder_sheet.png"
          alt="folder-sheet-right"
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
          style={{
            width: "calc(5rem * var(--folder-scale))",
            x: "18%",
          }}
          variants={{
            rest: {
              y: "22%",
              scale: 0.96,
              rotate: 0,
            },
            hover: {
              y: "-12%",
              scale: 1,
              rotate: sideRotation,
            },
          }}
          transition={{
            duration: 0.15,
            delay: 0.12,
            ease: "easeOut",
          }}
        />

        {/* Folder front */}
        <img
          src="/custom/folder_front.png"
          alt="folder-front"
          className="absolute inset-0 z-40 w-full translate-y-[4%] scale-120"
        />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1">
        <p className="leading-tight font-semibold">{folderName}</p>
        <p className="text-sm text-white/50">
          {folderQuantity} {folderQuantity === 1 ? "file" : "files"}
        </p>
      </div>
    </motion.div>
  );
};

export default FilledFolder;
