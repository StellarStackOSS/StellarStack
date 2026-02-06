'use client';

import { motion } from 'framer-motion';

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
    rest: { borderColor: 'rgba(255, 255, 255, 0.2)' },
    hover: {
      borderColor: 'rgba(255, 255, 255, 0.4)',
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
      viewport={{ once: true, margin: '-50px' }}
      variants={cardVariants}
      whileHover="hover"
      className="flex flex-col gap-4 group bg-[#141414] border border-white/20  overflow-hidden transition-shadow hover:shadow-lg hover:shadow-white/10"
    >
      <motion.div variants={hoverVariants} className="w-full">
        <div className="w-full h-72 bg-orange-500/20 relative overflow-hidden">
          <motion.img
            src={backgroundImage}
            alt="background"
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
          />
          <div
            className="w-3/4 h-3/4 bg-orange-500/20 absolute bottom-0 left-1/2 -translate-x-1/2 z-10  shadow-2xl shadow-black"
            style={{
              backgroundImage: 'url(/screenshots/hero.png)',
              backgroundSize: 'cover',
            }}
          />
        </div>
      </motion.div>
      <motion.div variants={borderVariants} className="flex flex-col gap-2 px-4 py-4">
        <span className="text-xl">{title}</span>
        <span className="opacity-80 text-sm">{description}</span>
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
      backgroundImage: '/bg-purple.png',
      title: 'Open Source',
      description:
        'StellarStack is open source, allowing you to customize and extend it to fit your specific needs.',
    },
    {
      backgroundImage: '/bg-orange.png',
      title: 'Self-Hosted',
      description:
        'Deploy on your own infrastructure with complete control over your data and resources',
    },
    {
      backgroundImage: '/bg-green.png',
      title: 'Powerful API',
      description:
        'Full REST API access to automate server management and integrate with your tools',
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
      viewport={{ once: true, margin: '-100px' }}
      variants={containerVariants}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-8 border-y border-white/20 py-6 px-4 sm:px-8 lg:px-6"
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