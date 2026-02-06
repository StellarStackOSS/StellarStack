'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import React from 'react';

interface TestimonialProps {
  name: string;
  role: string;
  content: string;
  avatar: string;
  index: number;
}

/**
 * Individual testimonial card with animation.
 */
const TestimonialCard = ({ name, role, content, avatar, index }: TestimonialProps) => {
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
      viewport={{ once: true, margin: '-50px' }}
      variants={variants}
      whileHover={{ y: -4 }}
      className="flex flex-col gap-4 p-6 border border-white/20 hover:border-white/40 transition-colors"
    >
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={16} className="fill-white/40 text-white/40" />
        ))}
      </div>
      <p className="text-sm opacity-90 leading-relaxed">{content}</p>
      <div className="flex items-center gap-3 pt-2">
        <div className="w-10 h-10 bg-white/20 flex items-center justify-center font-semibold text-sm">
          {avatar}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs opacity-60">{role}</p>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Community section showcasing user testimonials and feedback.
 */
const Community = () => {
  const testimonials: TestimonialProps[] = [
    {
      name: 'Alex Chen',
      role: 'Server Admin',
      content:
        'StellarStack has completely transformed how I manage my game servers. The interface is intuitive and the API is powerful.',
      avatar: 'AC',
      index: 0,
    },
    {
      name: 'Sarah Martinez',
      role: 'Game Developer',
      content:
        'Finally, a game server management panel that actually respects my data and privacy. Being self-hosted is a game changer.',
      avatar: 'SM',
      index: 1,
    },
    {
      name: 'Jordan Williams',
      role: 'Community Manager',
      content:
        'The team behind StellarStack is incredibly responsive. They listen to community feedback and continuously improve the platform.',
      avatar: 'JW',
      index: 2,
    },
    {
      name: 'Casey Rodriguez',
      role: 'DevOps Engineer',
      content:
        'I was skeptical about another panel, but the architecture and extensibility of StellarStack won me over immediately.',
      avatar: 'CR',
      index: 3,
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
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-6xl"
        >
          Loved by the Community
        </motion.h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.name} {...testimonial} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Community;
