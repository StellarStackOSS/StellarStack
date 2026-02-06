'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowRight, Github } from 'lucide-react';

interface FAQItemData {
  id: number;
  question: string;
  answer: string;
}

/**
 * Individual FAQ item with expandable answer.
 */
const FAQItem = ({ item, isOpen, onClick }: { item: FAQItemData; isOpen: boolean; onClick: () => void }) => {
  const contentVariants = {
    collapsed: { height: 0, opacity: 0 },
    expanded: {
      height: 'auto',
      opacity: 1,
      transition: {
        height: { duration: 0.3 },
        opacity: { duration: 0.25, delay: 0.05 },
      },
    },
  };

  const chevronVariants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180, transition: { duration: 0.3 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={itemVariants}
      className="border border-white/20 overflow-hidden hover:border-white/40 transition-colors"
    >
      <motion.button
        onClick={onClick}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
      >
        <span className="text-lg font-medium text-left">{item.question}</span>
        <motion.div
          variants={chevronVariants}
          initial="collapsed"
          animate={isOpen ? 'expanded' : 'collapsed'}
        >
          <ChevronDown size={20} className="flex-shrink-0" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={contentVariants}
            className="overflow-hidden"
          >
            <div className="px-6 py-4 border-t border-white/20 text-sm opacity-80">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * FAQ and CTA section displayed side by side.
 */
const FAQAndCTA = () => {
  const [openId, setOpenId] = useState<number | null>(null);

  const faqs: FAQItemData[] = [
    {
      id: 1,
      question: 'What is StellarStack?',
      answer:
        'StellarStack is a modern, open-source game server management panel designed for self-hosting on your own infrastructure. It provides a user-friendly interface for managing game servers with complete control over your data and resources.',
    },
    {
      id: 2,
      question: 'Is StellarStack free to use?',
      answer:
        'Yes, StellarStack is completely free and open source. You can download it, modify it, and deploy it on your own infrastructure without any licensing fees.',
    },
    {
      id: 3,
      question: 'What games does StellarStack support?',
      answer:
        'StellarStack supports a wide variety of game servers. The extensible architecture allows you to add support for any game server type. Check our documentation for the full list of officially supported games.',
    },
    {
      id: 4,
      question: 'Can I host StellarStack on my own server?',
      answer:
        'Absolutely! StellarStack is designed to be self-hosted. You have complete control over your infrastructure, data, and deployment. We provide documentation to help you get started with various hosting options.',
    },
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

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05, transition: { duration: 0.2 } },
  };

  const arrowVariants = {
    rest: { x: 0 },
    hover: { x: 4, transition: { duration: 0.3 } },
  };

  return (
    <div className="w-full border-b border-white/20 px-16 py-16">
      <div className="grid grid-cols-2 gap-16">
        {/* FAQ Section */}
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
            Frequently Asked Questions
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={containerVariants}
            className="flex flex-col gap-4"
          >
            {faqs.map((faq) => (
              <FAQItem
                key={faq.id}
                item={faq}
                isOpen={openId === faq.id}
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={containerVariants}
          className="flex flex-col gap-8 justify-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-6xl leading-tight"
          >
            Ready to simplify your game server infrastructure?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-lg opacity-80 leading-relaxed"
          >
            Join thousands of server administrators using StellarStack. Get started with self-hosting or contribute to the open-source project.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex flex-col gap-4 mt-6"
          >
            <motion.a
              href="#"
              whileHover="hover"
              initial="rest"
              variants={buttonVariants}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-black font-semibold hover:bg-white/90 transition-colors"
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
              className="flex items-center justify-center gap-2 px-8 py-3 border border-white/40 font-semibold hover:bg-white/5 transition-colors"
            >
              <Github size={20} />
              <span>View on GitHub</span>
            </motion.a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-8 pt-8 border-t border-white/20 text-sm opacity-60"
          >
            <p>No credit card required • Self-hosted • Fully open-source</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQAndCTA;
