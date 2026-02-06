'use client';

import { motion } from 'framer-motion';

interface StatItemProps {
  value: string;
  label: string;
  index: number;
}

/**
 * Individual stat item with animated counter effect.
 */
const StatItem = ({ value, label, index }: StatItemProps) => {
  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={variants}
      className="flex flex-col gap-2 items-center"
    >
      <motion.div
        className="text-5xl font-bold text-white"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 + 0.2, duration: 0.6 }}
      >
        {value}
      </motion.div>
      <div className="text-sm opacity-80 text-center">{label}</div>
    </motion.div>
  );
};

/**
 * Stats section showcasing StellarStack metrics and achievements.
 */
const Stats = () => {
  const stats = [
    {
      value: '100%',
      label: 'Open Source',
    },
    {
      value: '∞',
      label: 'Customizable',
    },
    {
      value: '24/7',
      label: 'Community Support',
    },
    {
      value: '0',
      label: 'License Cost',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0,
      },
    },
  };

  return (
    <div className="w-full border-b border-white/20 px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={containerVariants}
        className="flex flex-col gap-12"
      >
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl lg:text-6xl"
        >
          Built by the Community
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <StatItem key={stat.label} value={stat.value} label={stat.label} index={index} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Stats;
