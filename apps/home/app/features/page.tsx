'use client';

import { motion } from 'framer-motion';

interface Feature {
  category: string;
  title: string;
  description: string;
  items: string[];
  status: 'implemented' | 'planned' | 'inprogress';
}

/**
 * Features page showcasing all StellarStack capabilities.
 */
const FeaturesPage = () => {
  const features: Feature[] = [
    {
      category: 'Server Management',
      title: 'Multi-Server Dashboard',
      description: 'Unified interface to manage all your game servers across multiple nodes',
      items: [
        'Real-time server status',
        'Quick action buttons (start, stop, restart)',
        'Server filtering and searching',
        'Bulk operations support',
        'Favorite/pin important servers',
      ],
      status: 'implemented',
    },
    {
      category: 'Server Management',
      title: 'Power Controls',
      description: 'Complete lifecycle management for game server instances',
      items: [
        'Start, stop, restart operations',
        'Graceful shutdown with timeout',
        'Force stop option',
        'Scheduled power operations',
        'Automatic status monitoring',
      ],
      status: 'implemented',
    },
    {
      category: 'Server Management',
      title: 'Real-time Console',
      description: 'Live command-line interface to interact with running servers',
      items: [
        'Real-time output streaming',
        'Command execution with history',
        'Color-coded output',
        'Console filtering and searching',
        'Mobile-friendly interface',
      ],
      status: 'implemented',
    },
    {
      category: 'File Management',
      title: 'File Manager',
      description: 'Browse, manage, and edit server files directly',
      items: [
        'Full file browser',
        'Create/delete files and directories',
        'Drag & drop file upload',
        'Text file editing with syntax highlighting',
        'Compression support (ZIP, TAR.GZ)',
      ],
      status: 'implemented',
    },
    {
      category: 'File Management',
      title: 'SFTP Support',
      description: 'Secure File Transfer Protocol for programmatic access',
      items: [
        'Standard SFTP protocol (RFC 4253)',
        'SSH key authentication',
        'Batch file operations',
        'Automated deployment support',
        'Plugin installation automation',
      ],
      status: 'implemented',
    },
    {
      category: 'Monitoring',
      title: 'Resource Monitoring',
      description: 'Real-time tracking of server performance metrics',
      items: [
        'CPU and memory usage',
        'Disk I/O monitoring',
        'Network traffic tracking',
        'Player count statistics',
        'TPS (Ticks Per Second) monitoring',
      ],
      status: 'implemented',
    },
    {
      category: 'User Management',
      title: 'Subuser System',
      description: 'Invite players and staff with granular permissions',
      items: [
        '45+ individual permissions',
        'Role templates',
        'Time-limited invitations',
        'Permission inheritance',
        'Audit logging of actions',
      ],
      status: 'implemented',
    },
    {
      category: 'User Management',
      title: 'Authentication',
      description: 'Multiple secure authentication methods',
      items: [
        'Email/password with bcrypt',
        'OAuth (Google, GitHub, Discord)',
        'Two-Factor Authentication (TOTP + Passkeys)',
        'Session management',
        'Device tracking',
      ],
      status: 'implemented',
    },
    {
      category: 'Backup & Automation',
      title: 'Scheduled Backups',
      description: 'Automatic, scheduled backups with retention policies',
      items: [
        'Cron-based scheduling',
        'Custom retention policies',
        'Backup compression',
        'Full and incremental backups',
        'Cloud storage support (S3-compatible)',
      ],
      status: 'implemented',
    },
    {
      category: 'Backup & Automation',
      title: 'One-Click Restore',
      description: 'Restore from backups with minimal effort',
      items: [
        'Browse backup history',
        'Selective file restoration',
        'Time-point recovery',
        'Automatic verification',
        'Rollback capability',
      ],
      status: 'implemented',
    },
    {
      category: 'Backup & Automation',
      title: 'Webhooks',
      description: 'Integrate external services via webhooks (Planned)',
      items: [
        'Server start/stop events',
        'Player join/leave notifications',
        'Backup completion alerts',
        'Discord/Slack integration',
        'Custom webhook endpoints',
      ],
      status: 'planned',
    },
    {
      category: 'Developer Features',
      title: 'REST API',
      description: 'Full-featured REST API with complete endpoint coverage',
      items: [
        'Authentication endpoints',
        'Server management API',
        'Console command execution',
        'File operations',
        'Backup management',
      ],
      status: 'implemented',
    },
    {
      category: 'Developer Features',
      title: 'WebSocket Events',
      description: 'Real-time event streaming for live updates',
      items: [
        'Console output events',
        'Server status changes',
        'Player join/leave events',
        'Resource usage updates',
        'Backup completion notifications',
      ],
      status: 'implemented',
    },
    {
      category: 'Developer Features',
      title: 'Plugin SDK',
      description: 'Complete SDK for building custom plugins',
      items: [
        'TypeScript type definitions',
        'Server lifecycle hooks',
        'Event system',
        'Data persistence',
        'Configuration management',
      ],
      status: 'implemented',
    },
    {
      category: 'Infrastructure',
      title: 'Node Management',
      description: 'Manage physical servers running the daemon',
      items: [
        'Register new nodes',
        'Monitor node health',
        'Dynamic load balancing',
        'Node failover',
        'Maintenance mode',
      ],
      status: 'implemented',
    },
    {
      category: 'Infrastructure',
      title: 'Blueprint System',
      description: 'Pre-configured templates for quick deployment',
      items: [
        'Minecraft Java & Bedrock',
        'Terraria, Valheim',
        'Custom templates',
        'One-click server creation',
        'Version management',
      ],
      status: 'implemented',
    },
    {
      category: 'Security',
      title: 'Advanced Security',
      description: 'Enterprise-grade security features',
      items: [
        'AES-256-CBC encryption',
        'bcrypt password hashing',
        'Rate limiting',
        'CSRF protection',
        'Audit logging',
      ],
      status: 'implemented',
    },
  ];

  const getStatusColor = (status: Feature['status']) => {
    switch (status) {
      case 'implemented':
        return 'bg-green-500/20 text-green-300';
      case 'inprogress':
        return 'bg-blue-500/20 text-blue-300';
      case 'planned':
        return 'bg-yellow-500/20 text-yellow-300';
    }
  };

  const getStatusText = (status: Feature['status']) => {
    switch (status) {
      case 'implemented':
        return 'Implemented';
      case 'inprogress':
        return 'In Progress';
      case 'planned':
        return 'Planned';
    }
  };

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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const groupedFeatures = features.reduce(
    (acc, feature) => {
      const existing = acc.find((g) => g.category === feature.category);
      if (existing) {
        existing.features.push(feature);
      } else {
        acc.push({ category: feature.category, features: [feature] });
      }
      return acc;
    },
    [] as Array<{ category: string; features: Feature[] }>
  );

  return (
    <div className="min-h-screen bg-[#101010] text-white py-16 px-4 sm:px-8 lg:px-16">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4">Features</h1>
          <p className="text-lg opacity-80">
            Complete overview of StellarStack capabilities and planned features
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-12"
        >
          {groupedFeatures.map((group) => (
            <motion.div key={group.category} variants={itemVariants}>
              <h2 className="text-2xl font-bold mb-6 border-b border-white/20 pb-4">
                {group.category}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {group.features.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    variants={itemVariants}
                    className="border border-white/20 p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold">{feature.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium whitespace-nowrap ${getStatusColor(feature.status)}`}>
                        {getStatusText(feature.status)}
                      </span>
                    </div>

                    <p className="text-sm opacity-80 mb-4">{feature.description}</p>

                    <ul className="space-y-2">
                      {feature.items.map((item, i) => (
                        <li key={i} className="text-sm opacity-70 flex gap-2">
                          <span className="text-white/40">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-16 p-8 border border-white/20 bg-white/5"
        >
          <h3 className="text-xl font-bold mb-6">Feature Status Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-green-300 font-semibold mb-2">✓ Implemented</p>
              <p className="opacity-80">{features.filter((f) => f.status === 'implemented').length} features</p>
            </div>
            <div>
              <p className="text-blue-300 font-semibold mb-2">⟳ In Progress</p>
              <p className="opacity-80">{features.filter((f) => f.status === 'inprogress').length} features</p>
            </div>
            <div>
              <p className="text-yellow-300 font-semibold mb-2">→ Planned</p>
              <p className="opacity-80">{features.filter((f) => f.status === 'planned').length} features</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default FeaturesPage;
