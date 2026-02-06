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
        className={`flex flex-col gap-8 lg:gap-12 min-h-[50vh] ${
          reversed ? "lg:flex-row-reverse" : "lg:flex-row"
        } items-center`}
      >
        {/* Text side */}
        <motion.div
          variants={textVariants}
          className="lg:w-1/2 flex flex-col gap-6"
        >
          <span className="text-sm opacity-60 uppercase tracking-wider">
            {label}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl leading-tight">
            {title}
          </h2>
          <p className="text-base sm:text-lg opacity-80 leading-relaxed">
            {description}
          </p>
          <motion.ul
            variants={featureStagger}
            className="flex flex-col gap-3 mt-2"
          >
            {features.map((feat) => (
              <motion.li
                key={feat.text}
                variants={featureItem}
                className="flex items-center gap-3 text-sm sm:text-base opacity-70"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                {feat.text}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Demo side — background image with floating dark panel */}
        <motion.div
          variants={demoVariants}
          className="lg:w-1/2 w-full relative overflow-hidden"
        >
          {/* Background image — no rounded corners */}
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Centered dark panel with rounded corners */}
          <div className="relative z-10 m-4 sm:m-6 bg-[#0a0a0a] border border-white/10 shadow-2xl shadow-black">
            <div className="p-4 sm:p-6">
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default FeatureShowcase;
