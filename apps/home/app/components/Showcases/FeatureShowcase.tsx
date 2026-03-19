"use client";

import { motion } from "framer-motion";
import type { JSX, ReactNode } from "react";

/**
 * A single bullet-point feature item.
 */
interface FeatureItem {
  /** Short feature description */
  text: string;
}

/**
 * Props for the FeatureShowcase layout wrapper.
 */
interface FeatureShowcaseProps {
  /** Small uppercase label above the title */
  label: string;
  /** Main section heading */
  title: string;
  /** Description paragraph below the title */
  description: string;
  /** Bullet-point feature list */
  features: FeatureItem[];
  /** Swap text and demo sides */
  reversed?: boolean;
  /** Background image URL for the demo panel */
  backgroundImage: string;
  /** Interactive demo content */
  children: ReactNode;
}

/**
 * Reusable half-screen showcase layout with text on one side and an interactive
 * demo on the other. Supports reversing sides for visual variety.
 *
 * @component
 * @example
 * ```tsx
 * <FeatureShowcase
 *   label="SERVER OVERVIEW"
 *   title="Complete visibility, at a glance"
 *   description="Monitor everything in real time."
 *   features={[{ text: "Drag-and-drop dashboard" }]}
 *   backgroundImage="/bg-orange.png"
 * >
 *   <DemoComponent />
 * </FeatureShowcase>
 * ```
 *
 * @param props - Showcase configuration
 * @returns Showcase section with text and demo panels
 */
const FeatureShowcase = ({
  label,
  title,
  description,
  features,
  reversed = false,
  backgroundImage,
  children,
}: FeatureShowcaseProps): JSX.Element => {
  const textVariants = {
    hidden: { opacity: 0, x: reversed ? 30 : -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  const demoVariants = {
    hidden: { opacity: 0, x: reversed ? -30 : 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: "easeOut" as const, delay: 0.2 },
    },
  };

  const featureStagger = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 },
    },
  };

  const featureItem = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" as const },
    },
  };

  return (
    <div className="w-full border-b border-white/20 px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className={`flex min-h-[50vh] flex-col gap-8 lg:gap-12 ${
          reversed ? "lg:flex-row-reverse" : "lg:flex-row"
        } items-center`}
      >
        {/* Text side */}
        <motion.div variants={textVariants} className="flex flex-col gap-6 lg:w-1/2">
          <span className="text-sm tracking-wider uppercase opacity-60">{label}</span>
          <h2 className="text-3xl leading-tight sm:text-4xl lg:text-5xl">{title}</h2>
          <p className="text-base leading-relaxed opacity-80 sm:text-lg">{description}</p>
          <motion.ul variants={featureStagger} className="mt-2 flex flex-col gap-3">
            {features.map((feat) => (
              <motion.li
                key={feat.text}
                variants={featureItem}
                className="flex items-center gap-3 text-sm opacity-70 sm:text-base"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                {feat.text}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Demo side — background image with floating dark panel */}
        <motion.div variants={demoVariants} className="relative w-full overflow-hidden lg:w-1/2">
          {/* Background image — no rounded corners */}
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Centered dark panel with rounded corners */}
          <div className="relative z-10 m-4 border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black sm:m-6">
            <div className="p-4 sm:p-6">{children}</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default FeatureShowcase;
