"use client";

import { motion } from "framer-motion";
import type { JSX } from "react";
import { FaWindows, FaApple, FaLinux } from "react-icons/fa";
import { HiDownload } from "react-icons/hi";

/**
 * Platform download button configuration.
 */
interface PlatformButton {
  /** Platform name */
  name: string;
  /** Platform icon component */
  icon: JSX.Element;
  /** Download URL */
  href: string;
  /** File extension label */
  extension: string;
}

/**
 * Desktop app showcase section highlighting the all-in-one desktop solution
 * with download buttons for Windows, macOS, and Linux.
 *
 * @component
 * @returns Desktop showcase section with platform download buttons
 */
const DesktopShowcase = (): JSX.Element => {
  const platforms: PlatformButton[] = [
    {
      name: "Windows",
      icon: <FaWindows className="h-5 w-5" />,
      href: "/downloads/stellarstack-windows.exe",
      extension: ".exe",
    },
    {
      name: "macOS",
      icon: <FaApple className="h-5 w-5" />,
      href: "/downloads/stellarstack-macos.dmg",
      extension: ".dmg",
    },
    {
      name: "Linux",
      icon: <FaLinux className="h-5 w-5" />,
      href: "/downloads/stellarstack-linux.AppImage",
      extension: ".AppImage",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.4, ease: "easeOut" as const },
    },
  };

  const features = [
    "Zero configuration required - just download and run",
    "Built-in PostgreSQL, Redis, and Docker management",
    "Native performance with system tray integration",
    "Automatic updates and seamless upgrades",
  ];

  return (
    <div className="w-full border-b border-white/20 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent px-4 py-16 sm:px-8 sm:py-20 lg:px-16 lg:py-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
        className="mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        {/* Label */}
        <motion.span
          variants={itemVariants}
          className="mb-4 text-sm tracking-wider uppercase opacity-60"
        >
          Desktop App
        </motion.span>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          className="mb-6 text-3xl leading-tight sm:text-4xl lg:text-5xl"
        >
          All-in-one. No setup required.
        </motion.h2>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="mb-8 max-w-2xl text-base leading-relaxed opacity-80 sm:text-lg"
        >
          Download the StellarStack desktop app and start managing game servers in minutes.
          Everything you need is bundled together - database, cache, daemon, and a beautiful
          interface. No Docker knowledge required, no terminal commands, no complex configuration.
        </motion.p>

        {/* Feature list */}
        <motion.ul
          variants={containerVariants}
          className="mb-12 flex flex-col flex-wrap justify-center gap-x-8 gap-y-3 sm:flex-row"
        >
          {features.map((feature) => (
            <motion.li
              key={feature}
              variants={itemVariants}
              className="flex items-center gap-2 text-sm opacity-70"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {feature}
            </motion.li>
          ))}
        </motion.ul>

        {/* Download buttons */}
        <motion.div
          variants={containerVariants}
          className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row"
        >
          {platforms.map((platform) => (
            <motion.div
              key={platform.name}
              variants={buttonVariants}
              className="group flex cursor-not-allowed items-center justify-center gap-3 border border-white/10 bg-white/5 px-6 py-4 opacity-50 select-none"
            >
              <span className="opacity-60">{platform.icon}</span>
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">{platform.name}</span>
                <span className="text-xs opacity-50">Coming Soon</span>
              </span>
              <HiDownload className="ml-2 h-4 w-4 opacity-30" />
            </motion.div>
          ))}
        </motion.div>

        {/* Secondary info */}
        <motion.p variants={itemVariants} className="mt-8 text-xs opacity-40">
          Requires Docker Desktop (Windows/macOS) or Docker Engine (Linux)
        </motion.p>
      </motion.div>
    </div>
  );
};

export default DesktopShowcase;
