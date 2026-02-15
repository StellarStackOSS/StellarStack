"use client";

import { motion } from "framer-motion";

/**
 * Hero section component with sophisticated entry animations for title and description.
 */
const Hero = () => {
  const textVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: custom * 0.15,
        duration: 0.6,
      },
    }),
  };

  const imageVariants = {
    hidden: { opacity: 0, x: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        delay: 0.4,
        duration: 0.7,
      },
    },
  };

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

  const wordVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className="flex h-screen w-full flex-col-reverse items-center justify-center text-white lg:h-[calc(100vh-4rem)] lg:flex-row">
      <div className="flex h-full flex-col justify-end gap-8 px-8 py-8 lg:w-1/2">
        <motion.h1
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-2 text-4xl leading-[0.9] lg:text-8xl"
        >
          <motion.div custom={0} variants={textVariants}>
            The infrastructure behind your
          </motion.div>
          <motion.div custom={1} variants={textVariants}>
            game servers, simplified.
          </motion.div>
        </motion.h1>
        <motion.span
          initial="hidden"
          animate="visible"
          custom={2}
          variants={textVariants}
          className="max-w-xl leading-relaxed font-light opacity-80"
        >
          A modern, open-source game server management panel designed for self-hosting on your own
          infrastructure
        </motion.span>
      </div>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={imageVariants}
        className="relative flex h-full flex-row items-center px-4 py-4 lg:w-1/2"
      >
        <motion.img
          src="/bg-orange.png"
          alt="bg-orange"
          className="h-full w-full object-cover"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        />
        {/*    PLACE THE HERO IMAGE WITH IT BEING CUT OFF ON THE RIGHT SIDE OF THE IMAGE*/}
        <motion.div
          className="absolute top-1/2 right-4 z-10 h-2/3 w-3/4 -translate-y-1/2 bg-orange-500/20 shadow-2xl shadow-black"
          style={{
            backgroundImage: "url(/screenshots/hero.png)",
            backgroundSize: "cover",
          }}
          whileHover={{ scale: 1.02, rotateY: 5 }}
          transition={{ duration: 0.4 }}
        />
      </motion.div>
    </div>
  );
};

export default Hero;
