'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface ComparisonFeature {
  name: string;
  stellarStack: boolean;
  pterodactyl: boolean;
  other: boolean;
}

/**
 * Feature comparison row component.
 */
const ComparisonRow = ({ feature, index }: { feature: ComparisonFeature; index: number }) => {
  const variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 0.05,
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  };

  const FeatureCell = ({ hasFeature }: { hasFeature: boolean }) => (
    <div className="flex items-center justify-center py-4">
      {hasFeature ? (
        <Check size={20} className="text-white" />
      ) : (
        <X size={20} className="text-white/20" />
      )}
    </div>
  );

  return (
    <motion.tr
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={variants}
      className="border-b border-white/20 hover:bg-white/5 transition-colors"
    >
      <td className="px-6 py-4 text-left font-medium">{feature.name}</td>
      <td className="px-6 text-center border-l border-white/20">
        <FeatureCell hasFeature={feature.stellarStack} />
      </td>
      <td className="px-6 text-center border-l border-white/20">
        <FeatureCell hasFeature={feature.pterodactyl} />
      </td>
      <td className="px-6 text-center border-l border-white/20">
        <FeatureCell hasFeature={feature.other} />
      </td>
    </motion.tr>
  );
};

/**
 * Comparison section showcasing StellarStack features vs competitors.
 */
const Comparison = () => {
  const comparisonData: ComparisonFeature[] = [
    { name: 'Self-Hosted', stellarStack: true, pterodactyl: true, other: true },
    { name: 'Open Source', stellarStack: true, pterodactyl: true, other: false },
    { name: 'RESTful API', stellarStack: true, pterodactyl: true, other: true },
    { name: 'Multi-Server Support', stellarStack: true, pterodactyl: true, other: true },
    { name: 'Docker Integration', stellarStack: true, pterodactyl: true, other: true },
    { name: 'Modern UI', stellarStack: true, pterodactyl: false, other: true },
    { name: 'Mobile Responsive', stellarStack: true, pterodactyl: false, other: true },
    { name: 'Real-time Updates', stellarStack: true, pterodactyl: false, other: false },
    { name: 'Advanced Security', stellarStack: true, pterodactyl: true, other: false },
    { name: 'Database Backup', stellarStack: true, pterodactyl: true, other: true },
    { name: 'Zero Licensing Cost', stellarStack: true, pterodactyl: true, other: false },
    { name: 'Active Development', stellarStack: true, pterodactyl: true, other: false },
  ];

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

  return (
    <div className="w-full border-b border-white/20 px-16 py-16">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
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
          <span className="text-sm opacity-60 uppercase tracking-wider">Comparison</span>
          <h2 className="text-6xl">How StellarStack Stacks Up</h2>
          <p className="text-lg opacity-80 max-w-2xl">
            See how StellarStack compares to other game server management solutions
          </p>
        </motion.div>

        <div className="overflow-x-auto border border-white/20">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-white/20">
                <th className="px-6 py-4 text-left font-semibold">Feature</th>
                <th className="px-6 py-4 text-center font-semibold border-l border-white/20">
                  StellarStack
                </th>
                <th className="px-6 py-4 text-center font-semibold border-l border-white/20">
                  Pterodactyl
                </th>
                <th className="px-6 py-4 text-center font-semibold border-l border-white/20">
                  Other Panels
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((feature, index) => (
                <ComparisonRow key={feature.name} feature={feature} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Comparison;
