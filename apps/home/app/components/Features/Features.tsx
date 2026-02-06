'use client';

import { motion } from 'framer-motion';
import { Smartphone, Shield, Zap } from 'lucide-react';
import React from 'react';

interface FeatureCardProps {
  icon: React.ReactNode;
  backgroundImage: string;
  title: string;
  description: string;
  index: number;
}

/**
 * Individual feature card styled to match Grid cards with centered icon.
 */
const FeatureCard = ({
  icon,
  backgroundImage,
  title,
  description,
  index,
}: FeatureCardProps) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  const hoverVariants = {
    rest: { y: 0 },
    hover: {
      y: -8,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={cardVariants}
      whileHover="hover"
      initial_="rest"
      className="flex flex-col gap-4 group bg-[#141414] border border-white/20 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-white/10"
    >
      <motion.div variants={hoverVariants} className="w-full">
        <div className="w-full h-72 bg-orange-500/20 relative flex items-center justify-center overflow-hidden">
          <motion.img
            src={backgroundImage}
            alt="background"
            className="w-full h-full object-cover absolute"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
          />
          <div className="w-20 h-20 bg-black/60 flex items-center justify-center z-10 text-3xl text-white">
            {icon}
          </div>
        </div>
      </motion.div>
      <div className="flex flex-col gap-2 px-4 py-4">
        <span className="text-xl">{title}</span>
        <span className="opacity-80 text-sm">{description}</span>
      </div>
    </motion.div>
  );
};

/**
 * Features section showcasing key benefits matching Grid card styling.
 */
const Features = () => {
  const features = [
    {
      icon: <Smartphone size={32} className="text-white" />,
      backgroundImage: '/bg-purple.png',
      title: 'Mobile Responsive',
      description:
        'Check your servers anywhere, anytime on phone, tablet, or desktop.',
    },
    {
      icon: <Shield size={32} className="text-white" />,
      backgroundImage: '/bg-orange.png',
      title: 'Bank-Level Security',
      description:
        'Protected with 256-bit encryption and industry-standard protocols. Track with peace of mind.',
    },
    {
      icon: <Zap size={32} className="text-white" />,
      backgroundImage: '/bg-green.png',
      title: 'Lightweight & Fast',
      description:
        'No bloated downloads or slow loading. Access your servers instantly through web browser.',
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
          <span className="text-sm opacity-60 uppercase tracking-wider">Benefits</span>
          <h2 className="text-6xl">The benefits that matter most to you</h2>
        </motion.div>
        <div className="grid grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              backgroundImage={feature.backgroundImage}
              title={feature.title}
              description={feature.description}
              index={index}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Features;
