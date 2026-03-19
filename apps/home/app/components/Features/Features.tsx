"use client";

import { motion } from "framer-motion";
import { Smartphone, Shield, Zap } from "lucide-react";
import React from "react";

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
const FeatureCard = ({ icon, backgroundImage, title, description, index }: FeatureCardProps) => {
  const cardVariants = {
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

  const hoverVariants = {
    rest: { y: 0 },
    hover: {
      y: -8,
      transition: {
        duration: 0.3,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={cardVariants}
      whileHover="hover"
      className="group flex flex-col gap-4 overflow-hidden border border-white/20 bg-[#141414] transition-shadow hover:shadow-lg hover:shadow-white/10"
    >
      <motion.div variants={hoverVariants} className="w-full">
        <div className="relative flex h-72 w-full items-center justify-center overflow-hidden bg-orange-500/20">
          <motion.img
            src={backgroundImage}
            alt="background"
            className="absolute h-full w-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
          />
          <div className="z-10 flex h-20 w-20 items-center justify-center bg-black/60 text-3xl text-white">
            {icon}
          </div>
        </div>
      </motion.div>
      <div className="flex flex-col gap-2 px-4 py-4">
        <span className="text-xl">{title}</span>
        <span className="text-sm opacity-80">{description}</span>
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
      backgroundImage: "/bg-purple.png",
      title: "Mobile Responsive",
      description: "Check your servers anywhere, anytime on phone, tablet, or desktop.",
    },
    {
      icon: <Shield size={32} className="text-white" />,
      backgroundImage: "/bg-orange.png",
      title: "Bank-Level Security",
      description:
        "Protected with 256-bit encryption and industry-standard protocols. Track with peace of mind.",
    },
    {
      icon: <Zap size={32} className="text-white" />,
      backgroundImage: "/bg-green.png",
      title: "Lightweight & Fast",
      description:
        "No bloated downloads or slow loading. Access your servers instantly through web browser.",
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
          <span className="text-sm tracking-wider uppercase opacity-60">Benefits</span>
          <h2 className="text-3xl sm:text-4xl lg:text-6xl">The benefits that matter most to you</h2>
        </motion.div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
