'use client';

import { motion } from 'framer-motion';

interface RoadmapPhase {
  quarter: string;
  version: string;
  theme: string;
  features: string[];
  status: 'completed' | 'inprogress' | 'planned';
}

/**
 * Roadmap page showcasing future development plans.
 */
const RoadmapPage = () => {
  const roadmap: RoadmapPhase[] = [
    {
      quarter: 'Q1 2026',
      version: 'v1.4.0',
      theme: 'Stabilization',
      status: 'inprogress',
      features: [
        'Complete error handling system',
        'Advanced permission management UI',
        'Improved backup scheduling',
        'WebSocket connection recovery',
        'Rate limiting improvements',
        'Security audit recommendations panel',
        'Performance monitoring dashboard',
      ],
    },
    {
      quarter: 'Q2 2026',
      version: 'v1.5.0',
      theme: 'API Completeness',
      status: 'planned',
      features: [
        'Complete REST API documentation',
        'OpenAPI/Swagger specification',
        'API versioning strategy',
        'API rate limiting per user',
        'API key management UI',
        'Webhook system v1.0',
        'GraphQL API (experimental)',
      ],
    },
    {
      quarter: 'Q3-Q4 2026',
      version: 'v2.0.0',
      theme: 'Enterprise',
      status: 'planned',
      features: [
        'Kubernetes operator support',
        'Helm charts for deployment',
        'Multi-region failover',
        'High-availability setup',
        'SAML 2.0 support',
        'LDAP/Active Directory integration',
        'Advanced analytics dashboard',
        'White-label support',
        'Custom domain support',
      ],
    },
  ];

  const strategicGoals = [
    {
      title: 'Stability & Production Readiness',
      description: 'Move from Alpha to Beta with enterprise-grade reliability',
      timeline: 'Q1 2026',
      items: [
        '99.9% uptime SLA achievable',
        '<100ms API response times',
        'Zero critical security vulnerabilities',
        'Full disaster recovery',
      ],
    },
    {
      title: 'Feature Parity & Completeness',
      description: 'Ensure all planned features are fully implemented',
      timeline: 'Q2 2026',
      items: [
        'Complete REST API with 100% feature parity',
        'WebSocket real-time features',
        'Advanced task scheduling',
        'Comprehensive backup & restore',
      ],
    },
    {
      title: 'Developer Experience',
      description: 'Make StellarStack the platform of choice for developers',
      timeline: 'Q2-Q3 2026',
      items: [
        'Plugin SDK v2.0 (TypeScript + Rust)',
        'Official plugin marketplace',
        'SDK documentation & tutorials',
        '50+ community plugins created',
      ],
    },
    {
      title: 'Scalability & Performance',
      description: 'Support hundreds of servers per installation',
      timeline: 'Q3-Q4 2026',
      items: [
        'Horizontal scaling for API servers',
        'Database query optimization',
        'Handle 1000+ servers per cluster',
        'API latency <20ms (p95)',
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
    <div className="min-h-screen bg-[#101010] text-white py-16 px-4 sm:px-8 lg:px-16">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4">Roadmap</h1>
          <p className="text-lg opacity-80">
            Our vision for StellarStack development through 2026 and beyond
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold mb-8">Strategic Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {strategicGoals.map((goal, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="border border-white/20 p-6"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-bold">{goal.title}</h3>
                  <p className="text-sm opacity-60 mt-1">{goal.timeline}</p>
                </div>
                <p className="text-sm opacity-80 mb-4">{goal.description}</p>
                <ul className="space-y-2">
                  {goal.items.map((item, i) => (
                    <li key={i} className="text-sm opacity-70 flex gap-2">
                      <span className="text-white/40">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold mb-8">Release Timeline</h2>
          <div className="space-y-8">
            {roadmap.map((phase, idx) => (
              <motion.div key={idx} variants={itemVariants} className="border border-white/20 p-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold">{phase.version}</h3>
                    <p className="text-sm opacity-60 mt-1">{phase.quarter}</p>
                  </div>
                  <span
                    className={`px-3 py-1 text-sm font-medium ${
                      phase.status === 'completed'
                        ? 'bg-green-500/20 text-green-300'
                        : phase.status === 'inprogress'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {phase.status === 'completed' ? 'Released' : phase.status === 'inprogress' ? 'In Progress' : 'Planned'}
                  </span>
                </div>

                <p className="text-lg font-semibold text-white mb-6">{phase.theme}</p>

                <ul className="space-y-3">
                  {phase.features.map((feature, i) => (
                    <li key={i} className="flex gap-3 text-sm opacity-80">
                      <span className="text-white/40">→</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="p-8 border border-white/20 bg-white/5"
        >
          <h3 className="text-xl font-bold mb-4">Performance Targets</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="opacity-60 mb-1">API Response (p95)</p>
              <p className="font-mono">{'v1.4: <50ms → v2.0: <20ms'}</p>
            </div>
            <div>
              <p className="opacity-60 mb-1">WebSocket Latency</p>
              <p className="font-mono">{'v1.4: <50ms → v2.0: <20ms'}</p>
            </div>
            <div>
              <p className="opacity-60 mb-1">Page Load</p>
              <p className="font-mono">{'v1.4: <1s → v2.0: <500ms'}</p>
            </div>
            <div>
              <p className="opacity-60 mb-1">Server Scalability</p>
              <p className="font-mono">{'1000+ servers per cluster'}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RoadmapPage;
