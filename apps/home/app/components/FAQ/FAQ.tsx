'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FAQItemData {
  id: number;
  question: string;
  answer: string;
}

/**
 * Props for the FAQItem component.
 */
interface FAQItemProps {
  item: FAQItemData;
  isOpen: boolean;
  onClick: () => void;
}

/**
 * Individual FAQ item with expandable answer and animations.
 */
const FAQItem = ({ item, isOpen, onClick }: FAQItemProps) => {
  const contentVariants = {
    collapsed: {
      height: 0,
      opacity: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      transition: {
        height: { duration: 0.3, ease: 'easeInOut' },
        opacity: { duration: 0.25, delay: 0.05 },
      },
    },
  };

  const chevronVariants = {
    collapsed: { rotate: 0 },
    expanded: { rotate: 180, transition: { duration: 0.3, ease: 'easeInOut' } },
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
      className="border border-white/20  overflow-hidden hover:border-white/40 transition-colors"
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
 * FAQ section component displaying frequently asked questions with accordion functionality.
 */
const FAQ = () => {
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
    {
      id: 5,
      question: 'How does StellarStack compare to Pterodactyl?',
      answer:
        'While both are game server management panels, StellarStack offers a more modern approach with improved architecture, better API design, and enhanced user experience. Each project has its own strengths, and we recommend trying both to see which fits your needs best.',
    },
    {
      id: 6,
      question: 'What are the system requirements?',
      answer:
        'StellarStack requires Node.js 18+, Docker (optional but recommended), and a Unix-like operating system. For specific requirements based on your deployment scale, please refer to our detailed documentation.',
    },
    {
      id: 7,
      question: 'Is there a hosted version available?',
      answer:
        'Currently, StellarStack is designed for self-hosting. This gives you full control and ownership of your data. If you need managed hosting services, we recommend exploring partnership opportunities through our community.',
    },
    {
      id: 8,
      question: 'How do I contribute to StellarStack?',
      answer:
        'We welcome contributions from the community! You can contribute by submitting pull requests, reporting issues, improving documentation, or helping with translations. Please check our contributing guidelines on GitHub for more information.',
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

  return (
    <div className="w-full border-b border-white/20 px-16 py-16">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
        className="text-6xl mb-12"
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
    </div>
  );
};

export default FAQ;
