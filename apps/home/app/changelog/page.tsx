'use client';

import { motion } from 'framer-motion';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';

interface ChangelogSection {
  version: string;
  date: string;
  theme: string;
  changes: string[];
  status: 'released' | 'upcoming';
}

/**
 * Changelog page showcasing version history and features.
 */
const ChangelogPage = () => {
  const changelog: ChangelogSection[] = [
    {
      version: 'v1.3.9',
      date: 'February 6, 2026',
      theme: 'Landing Page Redesign & Code Quality',
      status: 'released',
      changes: [
        'Complete landing page redesign with modern animations',
        'Responsive mobile-first design implementation',
        'Migrated UI library to @stellarUI with PascalCase conventions',
        'Removed all remaining index.ts re-export files',
        'Eliminated 52+ any type violations for full TypeScript safety',
        'Fixed component imports and path mappings',
        'Fixed build errors with lucide-react icons',
        'Removed duplicate component files',
      ],
    },
    {
      version: 'v1.3.0 - v1.3.8',
      date: 'January 20-28, 2026',
      theme: 'UI Redesign & Optimization',
      status: 'released',
      changes: [
        'STE-17: Complete UI redesign with new visual language',
        'STE-20: Removed dark/light mode for simplification',
        'Improved file upload limits and NGINX configuration',
        'Added webhook utility features',
        'Enhanced Docker container operations',
        'Fixed case-sensitive file system compatibility',
        'Resolved build errors and dependencies',
      ],
    },
    {
      version: 'v1.2.0',
      date: 'January 14, 2026',
      theme: 'File Handling & Webhooks',
      status: 'released',
      changes: [
        'STE-16: NGINX upload limit configuration',
        'STE-13: Webhook utility additions',
        'STE-19: Security improvements',
        'Increased file upload limits for better support',
        'Improved request handling',
      ],
    },
    {
      version: 'v1.1.2',
      date: 'January 12, 2026',
      theme: 'Daemon Stability',
      status: 'released',
      changes: [
        'Fixed daemon startup detection',
        'Improved error handling for running instances',
        'Updated documentation and guides',
        'Added Linear ticket integration to changelog',
      ],
    },
    {
      version: 'v1.0.0',
      date: 'January 2026',
      theme: 'Initial Release',
      status: 'released',
      changes: [
        'Multi-server dashboard',
        'Real-time console access',
        'File manager with editing',
        'SFTP support',
        'Scheduled backups',
        'User management with 45+ permissions',
        'OAuth authentication',
        ' 2FA support (TOTP + Passkeys)',
        'Plugin system (Phase 1-4)',
        'REST API',
        'WebSocket real-time features',
      ],
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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#101010] text-white py-16 px-4 sm:px-8 lg:px-16">
        <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4">Changelog</h1>
          <p className="text-lg opacity-80">
            Complete version history and feature releases for StellarStack
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-12"
        >
          {changelog.map((section) => (
            <motion.div
              key={section.version}
              variants={itemVariants}
              className="border border-white/20 p-8"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{section.version}</h2>
                  <p className="text-sm opacity-60 mt-1">{section.date}</p>
                </div>
                <span
                  className={`px-3 py-1 text-sm font-medium ${
                    section.status === 'released'
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/60'
                  }`}
                >
                  {section.status === 'released' ? 'Released' : 'Upcoming'}
                </span>
              </div>

              <p className="text-lg font-semibold text-white mb-6">{section.theme}</p>

              <ul className="space-y-3">
                {section.changes.map((change, idx) => (
                  <li key={idx} className="flex gap-3 text-sm opacity-80">
                    <span className="text-white/40 mt-1">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 p-8 border border-white/20 bg-white/5"
        >
          <h3 className="text-xl font-bold mb-4">Current Status</h3>
          <p className="opacity-80 mb-4">
            StellarStack is currently in <strong>Alpha</strong> (v1.3.9) and not recommended for production use.
          </p>
          <ul className="space-y-2 text-sm opacity-80">
            <li>✅ Core features fully implemented</li>
            <li>✅ 100% TypeScript with zero any types</li>
            <li>✅ Plugin system complete (Phase 1-4)</li>
            <li>⏳ Performance optimization in progress</li>
            <li>⏳ Enterprise features planned for v2.0</li>
          </ul>
        </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ChangelogPage;
