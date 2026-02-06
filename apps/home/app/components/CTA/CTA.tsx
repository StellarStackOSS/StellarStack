'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github } from 'lucide-react';

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
        ease: 'easeOut',
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
        ease: 'easeOut',
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
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className="flex flex-col gap-8 items-center text-center"
      >
        <motion.h2 variants={itemVariants} className="text-6xl max-w-3xl">
          Ready to simplify your game server infrastructure?
        </motion.h2>

        <motion.p
          variants={itemVariants}
          className="text-lg opacity-80 max-w-2xl leading-relaxed"
        >
          Join thousands of server administrators using StellarStack. Get started with self-hosting
          or contribute to the open-source project.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-6 mt-6"
        >
          <motion.a
            href="#"
            whileHover="hover"
            initial="rest"
            variants={buttonVariants}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-black  font-semibold hover:bg-white/90 transition-colors"
          >
            <span>Get Started</span>
            <motion.div variants={arrowVariants}>
              <ArrowRight size={20} />
            </motion.div>
          </motion.a>

          <motion.a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            whileHover="hover"
            initial="rest"
            variants={buttonVariants}
            className="flex items-center justify-center gap-2 px-8 py-3 border border-white/40  font-semibold hover:bg-white/5 transition-colors"
          >
            <Github size={20} />
            <span>View on GitHub</span>
          </motion.a>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 pt-8 border-t border-white/20 text-sm opacity-60"
        >
          <p>No credit card required • Self-hosted • Fully open-source</p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CTA;
