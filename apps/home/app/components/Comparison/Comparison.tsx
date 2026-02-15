"use client";

import type { JSX } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@stellarUI/components/Table";

/**
 * Competitors displayed in the comparison table.
 */
const COMPETITORS = [
  "Pelican",
  "Pterodactyl",
  "PufferPanel",
  "Crafty Controller",
  "Multicraft",
  "TCAdmin",
  "AMP",
] as const;

type Competitor = (typeof COMPETITORS)[number];

/**
 * A single feature row with support flags per competitor.
 */
interface ComparisonFeature {
  /** Feature name displayed in the first column */
  name: string;
  /** Whether StellarStack supports this feature */
  stellarStack: boolean;
  /** Support flags keyed by competitor name */
  competitors: Record<Competitor, boolean>;
}

/**
 * Static comparison data for all features across all panels.
 */
const COMPARISON_DATA: ComparisonFeature[] = [
  {
    name: "File Manager",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: true,
      "Crafty Controller": true,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Scheduled Tasks",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: false,
      "Crafty Controller": true,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Free and Open Source",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: true,
      "Crafty Controller": true,
      Multicraft: false,
      TCAdmin: false,
      AMP: false,
    },
  },
  {
    name: "Multilingual",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: true,
      "Crafty Controller": true,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Database Management",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "OAuth",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: true,
      "Crafty Controller": true,
      Multicraft: false,
      TCAdmin: false,
      AMP: true,
    },
  },
  {
    name: "Webhooks",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: false,
      "Crafty Controller": true,
      Multicraft: false,
      TCAdmin: false,
      AMP: true,
    },
  },
  {
    name: "Roles & Permissions",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: false,
      "Crafty Controller": true,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Announcements",
    stellarStack: true,
    competitors: {
      Pelican: false,
      Pterodactyl: false,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: false,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Themes",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: true,
      "Crafty Controller": false,
      Multicraft: true,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Plugins",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: false,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Self Update",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: false,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: false,
      TCAdmin: true,
      AMP: true,
    },
  },
  {
    name: "Captcha Login",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: false,
      TCAdmin: false,
      AMP: false,
    },
  },
  {
    name: "Remote Backups",
    stellarStack: true,
    competitors: {
      Pelican: true,
      Pterodactyl: true,
      PufferPanel: false,
      "Crafty Controller": false,
      Multicraft: false,
      TCAdmin: false,
      AMP: true,
    },
  },
];

/**
 * Renders a check or cross icon for a feature cell.
 *
 * @param props - Whether the feature is supported
 * @returns Check or X icon element
 */
const FeatureIcon = ({ supported }: { supported: boolean }): JSX.Element => {
  if (supported) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
        <Check size={14} className="text-emerald-400" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20">
      <X size={14} className="text-red-400" />
    </span>
  );
};

/**
 * Comparison section showcasing StellarStack features vs 7 competitors
 * in a horizontally scrollable table.
 *
 * @component
 * @returns Comparison table section
 */
const Comparison = (): JSX.Element => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="w-full border-b border-white/20 px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
        className="flex flex-col gap-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <span className="text-sm tracking-wider uppercase opacity-60">Comparison</span>
          <h2 className="text-3xl sm:text-4xl lg:text-6xl">How StellarStack Stacks Up</h2>
          <p className="max-w-2xl text-lg opacity-80">
            See how StellarStack compares to other game server management solutions
          </p>
        </motion.div>

        <div className="overflow-hidden border border-white/20">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="border-b-2 border-white/20 hover:bg-transparent">
                <TableHead className="min-w-[180px] px-6 py-4 text-left font-semibold text-white">
                  Feature
                </TableHead>
                <TableHead className="border-l border-white/20 bg-white/5 px-4 py-4 text-center font-semibold text-white">
                  StellarStack
                </TableHead>
                {COMPETITORS.map((name) => (
                  <TableHead
                    key={name}
                    className="border-l border-white/20 px-4 py-4 text-center font-semibold text-white/60"
                  >
                    {name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON_DATA.map((feature, index) => (
                <motion.tr
                  key={feature.name}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-30px" }}
                  variants={rowVariants}
                  transition={{ delay: index * 0.03, duration: 0.4 }}
                  className="border-b border-white/20 transition-colors hover:bg-white/5"
                >
                  <TableCell className="px-6 py-3 text-left font-medium text-white/90">
                    {feature.name}
                  </TableCell>
                  <TableCell className="border-l border-white/20 bg-white/5 px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <FeatureIcon supported={feature.stellarStack} />
                    </div>
                  </TableCell>
                  {COMPETITORS.map((name) => (
                    <TableCell
                      key={name}
                      className="border-l border-white/20 px-4 py-3 text-center"
                    >
                      <div className="flex items-center justify-center">
                        <FeatureIcon supported={feature.competitors[name]} />
                      </div>
                    </TableCell>
                  ))}
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
};

export default Comparison;
