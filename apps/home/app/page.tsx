"use client";

import { type JSX, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  BsArrowRight,
  BsBoxSeam,
  BsCheck2,
  BsCloudArrowUp,
  BsCodeSlash,
  BsCpu,
  BsDatabase,
  BsFileEarmarkCode,
  BsFileEarmarkLock,
  BsGear,
  BsGithub,
  BsKey,
  BsLayers,
  BsLightningCharge,
  BsLock,
  BsPeople,
  BsPersonWorkspace,
  BsPlug,
  BsServer,
  BsShieldCheck,
  BsShieldLock,
  BsTerminal,
} from "react-icons/bs";
import {
  SiDocker,
  SiGrafana,
  SiHono,
  SiNextdotjs,
  SiNodedotjs,
  SiPostgresql,
  SiPrisma,
  SiPrometheus,
  SiReact,
  SiRedis,
  SiRust,
  SiTailwindcss,
  SiTraefikproxy,
  SiTurborepo,
  SiTypescript,
} from "react-icons/si";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { TextureButton } from "@workspace/ui/components/texture-button";

// ============================================================================
// Data
// ============================================================================

const technologies = [
  { name: "Next.js", Icon: SiNextdotjs, description: "React Framework" },
  { name: "React", Icon: SiReact, description: "UI Library" },
  { name: "TypeScript", Icon: SiTypescript, description: "Type Safety" },
  { name: "PostgreSQL", Icon: SiPostgresql, description: "Database" },
  { name: "Prisma", Icon: SiPrisma, description: "ORM" },
  { name: "Docker", Icon: SiDocker, description: "Containers" },
  { name: "Traefik", Icon: SiTraefikproxy, description: "Reverse Proxy" },
  { name: "Tailwind CSS", Icon: SiTailwindcss, description: "Styling" },
  { name: "Hono", Icon: SiHono, description: "API Framework" },
  { name: "Redis", Icon: SiRedis, description: "Caching" },
  { name: "Node.js", Icon: SiNodedotjs, description: "Runtime" },
  { name: "Turborepo", Icon: SiTurborepo, description: "Monorepo" },
  { name: "Rust", Icon: SiRust, description: "Daemon" },
  { name: "Prometheus", Icon: SiPrometheus, description: "Metrics" },
  { name: "Grafana", Icon: SiGrafana, description: "Dashboards" },
];

const features = [
  {
    icon: BsServer,
    title: "Multi-Game Support",
    description:
      "Deploy and manage servers for Minecraft, Rust, Valheim, ARK, and dozens more games with pre-configured blueprints.",
  },
  {
    icon: BsShieldCheck,
    title: "Enterprise Security",
    description:
      "Role-based access control, API key management, 2FA support, and comprehensive audit logging built in.",
  },
  {
    icon: BsLightningCharge,
    title: "Instant Deployment",
    description:
      "Spin up new game servers in seconds with automated provisioning, Docker orchestration, and configuration.",
  },
  {
    icon: BsTerminal,
    title: "Real-time Console",
    description:
      "Full console access with WebSocket-powered real-time log streaming and command execution.",
  },
  {
    icon: BsDatabase,
    title: "Database Management",
    description:
      "Built-in MySQL and PostgreSQL database provisioning for game servers that need persistent storage.",
  },
  {
    icon: BsCloudArrowUp,
    title: "Automated Backups",
    description:
      "Schedule automatic backups with configurable retention policies. Restore with a single click.",
  },
  {
    icon: BsGear,
    title: "Resource Management",
    description:
      "Set CPU, memory, and disk limits per server. Monitor usage in real-time with detailed metrics.",
  },
  {
    icon: BsPlug,
    title: "REST API",
    description:
      "Comprehensive REST API for automation and integration. Build your own tools or connect existing systems.",
  },
];

const targetUsers = [
  {
    icon: BsServer,
    title: "VPS & Dedicated Servers",
    description:
      "Got a VPS or dedicated server? Run the install script and have a full game server panel running in minutes.",
  },
  {
    icon: BsPeople,
    title: "Gaming Communities",
    description:
      "Self-host servers for your clan or guild with role-based permissions and member access control.",
  },
  {
    icon: BsPersonWorkspace,
    title: "Homelab Enthusiasts",
    description:
      "Run game servers on your own hardware. Perfect for those who prefer full control over their infrastructure.",
  },
  {
    icon: BsCodeSlash,
    title: "Developers & Contributors",
    description:
      "Contribute to the project, build custom blueprints, or extend functionality. It's all open source.",
  },
];

const securityFeatures = [
  {
    icon: BsKey,
    title: "Bcrypt Password Hashing",
    description:
      "Industry-standard bcrypt algorithm with adaptive cost factor for secure password storage.",
  },
  {
    icon: BsLock,
    title: "AES-256-CBC Encryption",
    description:
      "Military-grade encryption for sensitive data at rest, including API tokens and secrets.",
  },
  {
    icon: BsShieldLock,
    title: "HTTPS Everywhere",
    description: "TLS 1.3 support out of the box with automatic certificate management.",
  },
  {
    icon: BsFileEarmarkLock,
    title: "mTLS Communication",
    description:
      "Mutual TLS authentication between control plane and daemon nodes for zero-trust security.",
  },
];

const architectureSteps = [
  {
    step: "01",
    title: "Web Interface",
    description:
      "Next.js dashboard for managing servers, users, and configurations with a modern UI.",
    icon: BsLayers,
  },
  {
    step: "02",
    title: "API Layer",
    description:
      "Hono-powered REST API handling authentication, authorization, and business logic.",
    icon: BsFileEarmarkCode,
  },
  {
    step: "03",
    title: "Daemon Nodes",
    description: "High-performance Rust daemons running on each node, managing Docker containers.",
    icon: BsCpu,
  },
  {
    step: "04",
    title: "Game Servers",
    description:
      "Isolated Docker containers running your game servers with resource limits and networking.",
    icon: BsBoxSeam,
  },
];

const installSteps = [
  { text: "curl -sSL https://get.stellarstack.app | bash", delay: 0 },
  { text: "Detecting system architecture... x86_64", delay: 800 },
  { text: "Downloading StellarStack v1.3.5...", delay: 1200 },
  { text: "Installing dependencies...", delay: 2000 },
  { text: "Configuring Docker...", delay: 2800 },
  { text: "Starting services...", delay: 3400 },
  { text: "StellarStack is ready! Visit https://localhost:3000", delay: 4200 },
];

// ============================================================================
// Animation Variants
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

// ============================================================================
// Components
// ============================================================================

const AnimatedSection = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInUp}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={cn(
        "group relative rounded-xl border p-6 transition-all duration-300",
        "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
      )}
    >
      <div className="mb-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <Icon className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-zinc-200" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-zinc-100">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-500">{description}</p>
    </motion.div>
  );
};

const TerminalWindow = () => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    const timeouts: NodeJS.Timeout[] = [];
    installSteps.forEach((step, index) => {
      const timeout = setTimeout(() => {
        setVisibleLines(index + 1);
      }, step.delay);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [isInView]);

  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0a0a0a]">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-zinc-700" />
        <div className="h-3 w-3 rounded-full bg-zinc-700" />
        <div className="h-3 w-3 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-600">Terminal</span>
      </div>
      {/* Terminal Content */}
      <div className="p-4 font-mono text-sm">
        {installSteps.slice(0, visibleLines).map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-2"
          >
            {index === 0 ? (
              <span className="text-zinc-500">$</span>
            ) : (
              <span className="text-zinc-700">{">"}</span>
            )}
            <span
              className={cn(
                index === 0 ? "text-zinc-300" : "text-zinc-500",
                index === installSteps.length - 1 && "text-emerald-500"
              )}
            >
              {step.text}
            </span>
          </motion.div>
        ))}
        {visibleLines < installSteps.length && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block h-4 w-2 bg-zinc-500"
          />
        )}
      </div>
    </div>
  );
};

const ArchitectureDiagram = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="relative">
      {/* Connection Lines SVG */}
      <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3f3f46" stopOpacity="0" />
            <stop offset="50%" stopColor="#3f3f46" stopOpacity="1" />
            <stop offset="100%" stopColor="#3f3f46" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {architectureSteps.map((step, index) => (
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: index * 0.15 }}
            className="relative"
          >
            {/* Connector Arrow (except last) */}
            {index < architectureSteps.length - 1 && (
              <div className="absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 lg:block">
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.3, delay: index * 0.15 + 0.3 }}
                >
                  <BsArrowRight className="h-5 w-5 text-zinc-700" />
                </motion.div>
              </div>
            )}

            <div className={cn("relative rounded-xl border p-6", "border-zinc-800 bg-zinc-900/50")}>
              {/* Step Number */}
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-zinc-600">
                  STEP {step.step}
                </span>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                  <step.icon className="h-4 w-4 text-zinc-500" />
                </div>
              </div>
              <h4 className="mb-2 font-medium text-zinc-200">{step.title}</h4>
              <p className="text-sm text-zinc-500">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const TechStackGrid = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className="grid grid-cols-3 gap-4 sm:grid-cols-5 lg:grid-cols-5"
    >
      {technologies.map((tech, index) => (
        <motion.div
          key={tech.name}
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1 },
          }}
          transition={{ duration: 0.3 }}
          className={cn(
            "group flex flex-col items-center justify-center rounded-xl border p-4 transition-all duration-300",
            "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
          )}
        >
          <tech.Icon className="mb-2 h-6 w-6 text-zinc-500 transition-colors group-hover:text-zinc-300" />
          <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200">
            {tech.name}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
};

const ImagePlaceholder = ({
  aspectRatio = "16/9",
  label = "Screenshot",
}: {
  aspectRatio?: string;
  label?: string;
}) => (
  <div
    className={cn(
      "relative flex items-center justify-center overflow-hidden rounded-xl border",
      "border-zinc-800 bg-zinc-900/50"
    )}
    style={{ aspectRatio }}
  >
    {/* Grid Pattern */}
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage: `
          linear-gradient(to right, #27272a 1px, transparent 1px),
          linear-gradient(to bottom, #27272a 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }}
    />
    {/* Center Label */}
    <div className="relative z-10 flex flex-col items-center gap-2">
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2">
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
    </div>
  </div>
);

// ============================================================================
// Main Page
// ============================================================================

const LandingPage = (): JSX.Element => {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const homeNavLinks = [
    { href: "#features", label: "Features", isAnchor: true },
    { href: "#architecture", label: "Architecture", isAnchor: true },
    { href: "#security", label: "Security", isAnchor: true },
    { href: "#tech", label: "Tech Stack", isAnchor: true },
  ];

  return (
    <div className={cn("relative min-h-svh scroll-smooth", "bg-[#0b0b0a]")}>
      <Navigation links={homeNavLinks} />

      {/* ================================================================== */}
      {/* Hero Section */}
      {/* ================================================================== */}
      <section
        ref={heroRef}
        className="relative flex min-h-svh flex-col items-center justify-center px-6 pt-20"
      >
        {/* Background Gradient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, #27272a 0%, transparent 70%)",
            }}
          />
        </div>

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative z-10 mx-auto max-w-5xl text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2"
          >
            <span className="text-xs font-medium text-zinc-400">Open Source</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <span className="text-xs text-zinc-500">MIT License</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 text-4xl leading-[1.1] font-light tracking-tight sm:text-5xl md:text-7xl"
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #ffffff 0%, #a1a1aa 50%, #71717a 100%)",
              }}
            >
              Game server infrastructure,
            </span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #a1a1aa 0%, #71717a 50%, #52525b 100%)",
              }}
            >
              simplified.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400"
          >
            A modern, open-source game server management panel. Deploy on your own infrastructure,
            manage multiple nodes, and give your community the tools they need.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <a href="https://docs.stellarstack.app" target="_blank" rel="noopener noreferrer">
              <TextureButton variant="primary">
                Get Started
                <BsArrowRight className="ml-2 h-4 w-4" />
              </TextureButton>
            </a>
            <a
              href="https://github.com/stellarstack/stellarstack"
              target="_blank"
              rel="noopener noreferrer"
            >
              <TextureButton variant="minimal">
                <BsGithub className="mr-2 h-4 w-4" />
                View on GitHub
              </TextureButton>
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs tracking-wider text-zinc-600 uppercase">Scroll</span>
            <div className="h-8 w-[1px] bg-gradient-to-b from-zinc-600 to-transparent" />
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================== */}
      {/* Screenshot Section */}
      {/* ================================================================== */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30 p-2">
              <ImagePlaceholder aspectRatio="16/9" label="Dashboard Screenshot" />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Features Section */}
      {/* ================================================================== */}
      <section id="features" className="relative px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
              Features
            </span>
            <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
              Everything you need to manage game servers
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-500">
              Built for self-hosting with enterprise-grade features. No vendor lock-in, no monthly
              fees, complete control over your infrastructure.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Architecture Section */}
      {/* ================================================================== */}
      <section id="architecture" className="relative px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
              Architecture
            </span>
            <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">How it works</h2>
            <p className="mx-auto max-w-2xl text-zinc-500">
              A distributed architecture designed for reliability and scalability. Run everything on
              a single server or scale across multiple nodes.
            </p>
          </AnimatedSection>

          <ArchitectureDiagram />

          {/* Installation Terminal */}
          <AnimatedSection delay={0.2} className="mt-16">
            <div className="mx-auto max-w-2xl">
              <p className="mb-4 text-center text-sm text-zinc-500">
                Get started with a single command
              </p>
              <TerminalWindow />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Security Section */}
      {/* ================================================================== */}
      <section id="security" className="relative px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
            {/* Left: Content */}
            <AnimatedSection>
              <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
                Security
              </span>
              <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
                Security at every layer
              </h2>
              <p className="mb-8 text-zinc-500">
                From encrypted communications to isolated containers, security is built into every
                component. Your game servers and player data stay protected.
              </p>

              <div className="space-y-4">
                {securityFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2">
                      <feature.icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-zinc-200">{feature.title}</h4>
                      <p className="text-sm text-zinc-500">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>

            {/* Right: Visual */}
            <AnimatedSection delay={0.2}>
              <div className="relative">
                {/* Security Layers Visualization */}
                <div className="space-y-3">
                  {[
                    "Edge Protection",
                    "Application Security",
                    "Infrastructure",
                    "Container Isolation",
                  ].map((layer, index) => (
                    <motion.div
                      key={layer}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className={cn("rounded-lg border p-4", "border-zinc-800 bg-zinc-900/50")}
                      style={{ marginLeft: `${index * 1.5}rem` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-300">{layer}</span>
                        <BsCheck2 className="h-4 w-4 text-zinc-600" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Who It's For Section */}
      {/* ================================================================== */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <AnimatedSection className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
              Use Cases
            </span>
            <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
              Built for self-hosters
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-500">
              Whether you're running servers for friends or managing infrastructure for a gaming
              community, StellarStack scales with you.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {targetUsers.map((user, index) => (
              <FeatureCard key={user.title} {...user} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* Tech Stack Section */}
      {/* ================================================================== */}
      <section id="tech" className="relative px-6 py-32">
        <div className="mx-auto max-w-4xl">
          <AnimatedSection className="mb-16 text-center">
            <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
              Tech Stack
            </span>
            <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
              Built with modern tools
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-500">
              A carefully chosen stack for performance, developer experience, and reliability.
            </p>
          </AnimatedSection>

          <TechStackGrid />
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA Section */}
      {/* ================================================================== */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-4xl">
          <AnimatedSection>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border p-12 text-center",
                "border-zinc-800 bg-zinc-900/50"
              )}
            >
              {/* Background Pattern */}
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #27272a 1px, transparent 0)`,
                  backgroundSize: "32px 32px",
                }}
              />

              <div className="relative z-10">
                <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
                  Ready to get started?
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-zinc-500">
                  StellarStack is free and open source. Deploy it on your own infrastructure and
                  take control of your game servers.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <a href="https://docs.stellarstack.app" target="_blank" rel="noopener noreferrer">
                    <TextureButton variant="primary">
                      Read the Documentation
                      <BsArrowRight className="ml-2 h-4 w-4" />
                    </TextureButton>
                  </a>
                  <a
                    href="https://github.com/stellarstack/stellarstack"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TextureButton variant="minimal">
                      <BsGithub className="mr-2 h-4 w-4" />
                      Star on GitHub
                    </TextureButton>
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
