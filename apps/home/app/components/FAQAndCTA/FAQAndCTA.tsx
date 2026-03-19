"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { SiGitlab } from "react-icons/si";

interface FAQItemData {
  id: number;
  question: string;
  answer: string;
}

/**
 * Individual FAQ item with expandable answer.
 */
const FAQItem = ({
  item,
  isOpen,
  onClick,
}: {
  item: FAQItemData;
  isOpen: boolean;
  onClick: () => void;
}) => {
  const contentVariants = {
    collapsed: { height: 0, opacity: 0 },
    expanded: {
      height: "auto",
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
      viewport={{ once: true, margin: "-50px" }}
      variants={itemVariants}
      className="overflow-hidden border border-white/20 transition-colors hover:border-white/40"
    >
      <motion.button
        onClick={onClick}
        className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-white/5"
      >
        <span className="text-left text-lg font-medium">{item.question}</span>
        <motion.div
          variants={chevronVariants}
          initial="collapsed"
          animate={isOpen ? "expanded" : "collapsed"}
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
            <div className="border-t border-white/20 px-6 py-4 text-sm opacity-80">
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
      question: "What is StellarStack?",
      answer:
        "StellarStack is a modern, open-source game server management panel designed for self-hosting on your own infrastructure. It provides a user-friendly interface for managing game servers with complete control over your data and resources.",
    },
    {
      id: 2,
      question: "Is StellarStack free to use?",
      answer:
        "Yes, StellarStack is completely free and open source. You can download it, modify it, and deploy it on your own infrastructure without any licensing fees.",
    },
    {
      id: 3,
      question: "What games does StellarStack support?",
      answer:
        "StellarStack supports a wide variety of game servers. The extensible architecture allows you to add support for any game server type. Check our documentation for the full list of officially supported games.",
    },
    {
      id: 4,
      question: "Can I host StellarStack on my own server?",
      answer:
        "Absolutely! StellarStack is designed to be self-hosted. You have complete control over your infrastructure, data, and deployment. We provide documentation to help you get started with various hosting options.",
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
    <div className="w-full border-b border-white/20 px-4 py-8 sm:px-8 sm:py-12 lg:px-16 lg:py-16">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
        {/* FAQ Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
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
            Frequently Asked Questions
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
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
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="flex flex-col justify-center gap-8"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl leading-tight sm:text-4xl lg:text-6xl"
          >
            Ready to simplify your game server infrastructure?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-lg leading-relaxed opacity-80"
          >
            Join thousands of server administrators using StellarStack. Get started with
            self-hosting or contribute to the open-source project.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 flex flex-col gap-4"
          >
            <a
              href="https://gitlab.com/StellarStackOSS/stellarstack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-white/40 px-8 py-3 font-semibold transition-colors hover:bg-white/5"
            >
              <SiGitlab size={20} />
              <span>View on GitLab</span>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-8 border-t border-white/20 pt-8 text-sm opacity-60"
          >
            <p>No credit card required • Self-hosted • Fully open-source</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default FAQAndCTA;
