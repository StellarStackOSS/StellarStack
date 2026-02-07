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
      icon: <FaWindows className="w-5 h-5" />,
      href: "/downloads/stellarstack-windows.exe",
      extension: ".exe",
    },
    {
      name: "macOS",
      icon: <FaApple className="w-5 h-5" />,
      href: "/downloads/stellarstack-macos.dmg",
      extension: ".dmg",
    },
    {
      name: "Linux",
      icon: <FaLinux className="w-5 h-5" />,
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
    <div className="w-full border-b border-white/20 px-4 py-16 sm:px-8 sm:py-20 lg:px-16 lg:py-24 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
        className="flex flex-col items-center text-center max-w-4xl mx-auto"
      >
        {/* Label */}
        <motion.span
          variants={itemVariants}
          className="text-sm opacity-60 uppercase tracking-wider mb-4"
        >
          Desktop App
        </motion.span>

        {/* Title */}
        <motion.h2
          variants={itemVariants}
          className="text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6"
        >
          All-in-one. No setup required.
        </motion.h2>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-base sm:text-lg opacity-80 leading-relaxed max-w-2xl mb-8"
        >
          Download the StellarStack desktop app and start managing game servers
          in minutes. Everything you need is bundled together - database, cache,
          daemon, and a beautiful interface. No Docker knowledge required, no
          terminal commands, no complex configuration.
        </motion.p>

        {/* Feature list */}
        <motion.ul
          variants={containerVariants}
          className="flex flex-col sm:flex-row flex-wrap justify-center gap-x-8 gap-y-3 mb-12"
        >
          {features.map((feature) => (
            <motion.li
              key={feature}
              variants={itemVariants}
              className="flex items-center gap-2 text-sm opacity-70"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {feature}
            </motion.li>
          ))}
        </motion.ul>

        {/* Download buttons */}
        <motion.div
          variants={containerVariants}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          {platforms.map((platform) => (
            <motion.a
              key={platform.name}
              href={platform.href}
              variants={buttonVariants}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              <span className="opacity-80 group-hover:opacity-100 transition-opacity">
                {platform.icon}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">{platform.name}</span>
                <span className="text-xs opacity-50">{platform.extension}</span>
              </span>
              <HiDownload className="w-4 h-4 opacity-40 group-hover:opacity-70 transition-opacity ml-2" />
            </motion.a>
          ))}
        </motion.div>

        {/* Secondary info */}
        <motion.p
          variants={itemVariants}
          className="mt-8 text-xs opacity-40"
        >
          Requires Docker Desktop (Windows/macOS) or Docker Engine (Linux)
        </motion.p>
      </motion.div>
    </div>
  );
};

export default DesktopShowcase;
