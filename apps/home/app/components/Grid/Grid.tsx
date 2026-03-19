"use client";

import { motion } from "framer-motion";

interface GridCardProps {
  backgroundImage: string;
  title: string;
  description: string;
  index: number;
}

/**
 * Individual grid card component with animation and hover effects.
 */
const GridCard = ({ backgroundImage, title, description, index }: GridCardProps) => {
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

  const borderVariants = {
    rest: {},
    hover: {},
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={cardVariants}
      whileHover="hover"
      className="group flex flex-col gap-4 overflow-hidden border border-white/20 bg-[#141414]"
    >
      <motion.div variants={hoverVariants} className="w-full">
        <div className="relative h-72 w-full overflow-hidden bg-orange-500/20">
          <motion.img
            src={backgroundImage}
            alt="background"
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
          />
          <div
            className="absolute bottom-0 left-1/2 z-10 h-3/4 w-3/4 -translate-x-1/2 bg-orange-500/20 shadow-2xl shadow-black"
            style={{
              backgroundImage: "url(/screenshots/hero.png)",
              backgroundSize: "cover",
            }}
          />
        </div>
      </motion.div>
      <motion.div variants={borderVariants} className="flex flex-col gap-2 px-4 py-4">
        <span className="text-xl">{title}</span>
        <span className="text-sm opacity-80">{description}</span>
      </motion.div>
    </motion.div>
  );
};

/**
 * Grid component displaying feature cards with staggered animations.
 */
const Grid = () => {
  const cards = [
    {
      backgroundImage: "/bg-purple.png",
      title: "Open Source",
      description:
        "StellarStack is open source, allowing you to customize and extend it to fit your specific needs.",
    },
    {
      backgroundImage: "/bg-orange.png",
      title: "Self-Hosted",
      description:
        "Deploy on your own infrastructure with complete control over your data and resources",
    },
    {
      backgroundImage: "/bg-green.png",
      title: "Powerful API",
      description:
        "Full REST API access to automate server management and integrate with your tools",
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
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={containerVariants}
      className="grid w-full grid-cols-1 gap-8 border-y border-white/20 px-4 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-6"
    >
      {cards.map((card, index) => (
        <GridCard
          key={card.title}
          backgroundImage={card.backgroundImage}
          title={card.title}
          description={card.description}
          index={index}
        />
      ))}
    </motion.div>
  );
};

export default Grid;
