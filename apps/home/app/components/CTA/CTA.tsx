"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SiGitlab } from "react-icons/si";

/**
 * Call-to-Action section encouraging users to get started with StellarStack.
 */
const CTA = () => {
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
        delayChildren: 0,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
  };

  const arrowVariants = {
    rest: { x: 0 },
    hover: {
      x: 4,
      transition: { duration: 0.3 },
    },
  };

  return (
    <div className="w-full border-b border-white/20 px-16 py-20">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
        className="flex flex-col items-center gap-8 text-center"
      >
        <motion.h2 variants={itemVariants} className="max-w-3xl text-3xl sm:text-4xl lg:text-6xl">
          Ready to simplify your game server infrastructure?
        </motion.h2>

        <motion.p variants={itemVariants} className="max-w-2xl text-lg leading-relaxed opacity-80">
          Join thousands of server administrators using StellarStack. Get started with self-hosting
          or contribute to the open-source project.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-6 flex flex-col gap-6 sm:flex-row">
          <motion.a
            href="#"
            whileHover="hover"
            initial="rest"
            variants={buttonVariants}
            className="flex items-center justify-center gap-2 bg-white px-8 py-3 font-semibold text-black transition-colors hover:bg-white/90"
          >
            <span>Get Started</span>
            <motion.div variants={arrowVariants}>
              <ArrowRight size={20} />
            </motion.div>
          </motion.a>

          <motion.a
            href="https://gitlab.com/StellarStackOSS/stellarstack"
            target="_blank"
            rel="noopener noreferrer"
            whileHover="hover"
            initial="rest"
            variants={buttonVariants}
            className="flex items-center justify-center gap-2 border border-white/40 px-8 py-3 font-semibold transition-colors hover:bg-white/5"
          >
            <SiGitlab size={20} />
            <span>View on GitLab</span>
          </motion.a>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 border-t border-white/20 pt-8 text-sm opacity-60"
        >
          <p>No credit card required • Self-hosted • Fully open-source</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CTA;
