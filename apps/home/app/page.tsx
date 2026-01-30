"use client";

import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useScroll, useTransform } from "framer-motion";
import { cn } from "@workspace/ui/lib/utils";
import {
  BsArrowRight,
  BsBoxSeam,
  BsChevronDown,
  BsCloudArrowUp,
  BsCpu,
  BsDatabase,
  BsGear,
  BsGithub,
  BsLayers,
  BsLightningCharge,
  BsLock,
  BsPeople,
  BsPlug,
  BsServer,
  BsShieldCheck,
  BsTerminal,
} from "react-icons/bs";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { TextureButton } from "@workspace/ui/components/texture-button";

// ============================================================================
// Data
// ============================================================================

const CYCLE_DURATION = 5000; // ms per showcase item

interface ShowcaseItem {
  label: string;
  heading: string;
  description: string;
}

const showcaseItems: ShowcaseItem[] = [
  {
    label: "Deploy servers",
    heading: "One-click game server deployment",
    description:
      "Select a game, configure resources, and deploy in seconds. Pre-built blueprints handle all the complexity so you can focus on playing.",
  },
  {
    label: "Monitor performance",
    heading: "Real-time resource monitoring",
    description:
      "Track CPU, memory, disk, and network usage across all your servers with live-updating dashboards and historical metrics.",
  },
  {
    label: "Manage players",
    heading: "Player management & permissions",
    description:
      "View online players, manage bans and whitelists, and assign granular role-based permissions to your team members.",
  },
  {
    label: "Automate backups",
    heading: "Scheduled & on-demand backups",
    description:
      "Configure automatic backup schedules with retention policies. Restore any backup with a single click -- zero downtime.",
  },
  {
    label: "Scale infrastructure",
    heading: "Multi-node orchestration",
    description:
      "Add new nodes to your cluster and distribute game servers across them. Manage your entire fleet from one dashboard.",
  },
];

const features = [
  {
    icon: BsBoxSeam,
    title: "Docker isolation",
    description:
      "Every game server runs in its own container with strict resource limits and network isolation.",
  },
  {
    icon: BsShieldCheck,
    title: "Role-based access",
    description:
      "Fine-grained permissions system with customizable roles. Control exactly who can do what.",
  },
  {
    icon: BsPlug,
    title: "REST API",
    description:
      "Full-featured API for automation and integration. Build custom tools or connect existing systems.",
  },
  {
    icon: BsTerminal,
    title: "Real-time console",
    description:
      "WebSocket-powered console with live log streaming and command execution for every server.",
  },
  {
    icon: BsLayers,
    title: "Multi-node support",
    description:
      "Distribute servers across multiple machines. Add capacity by connecting new daemon nodes.",
  },
  {
    icon: BsGear,
    title: "Blueprint system",
    description:
      "Pre-configured templates for dozens of games. Create custom blueprints for any Docker image.",
  },
];

const faqItems = [
  {
    question: "How do I install StellarStack?",
    answer:
      "Run a single command on any Linux server: curl -sSL https://get.stellarstack.app | bash. The installer handles Docker, database setup, and service configuration automatically. You'll have a running panel in under five minutes.",
  },
  {
    question: "Which games are supported?",
    answer:
      "StellarStack ships with blueprints for Minecraft (Java & Bedrock), Rust, Valheim, ARK, Terraria, CS2, Palworld, and many more. You can also create custom blueprints for any game that can run in Docker.",
  },
  {
    question: "What are the minimum server requirements?",
    answer:
      "The panel itself requires 1 CPU core, 1 GB RAM, and 10 GB disk. Game servers need additional resources depending on the game. Any modern Linux distribution with Docker support works.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. StellarStack is open source under the MIT license. There are no hidden fees, usage limits, or premium tiers. You run it on your own infrastructure.",
  },
  {
    question: "Can I migrate from Pterodactyl or other panels?",
    answer:
      "We provide migration guides and tooling to help you transition from Pterodactyl and other popular panels. Your game data, configurations, and user accounts can be imported.",
  },
  {
    question: "How do I get support?",
    answer:
      "Join our Discord community for help from maintainers and other users. You can also open issues on GitHub for bug reports and feature requests.",
  },
];

// ============================================================================
// Animation helpers
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

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

// ============================================================================
// Showcase mock visuals (right-side panels)
// ============================================================================

const DeployVisual = () => (
  <div className="space-y-4">
    {/* Header bar */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <BsServer className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-200">New Server</p>
          <p className="text-xs text-zinc-500">Minecraft - Java Edition</p>
        </div>
      </div>
      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
        Deploying...
      </span>
    </div>
    {/* Progress */}
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      {["Pulling image", "Creating container", "Configuring network", "Starting server"].map(
        (step, i) => (
          <div key={step} className="flex items-center gap-3">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                i < 2 ? "bg-emerald-400" : i === 2 ? "animate-pulse bg-emerald-400" : "bg-zinc-700"
              )}
            />
            <span className={cn("text-sm", i <= 2 ? "text-zinc-300" : "text-zinc-600")}>
              {step}
            </span>
          </div>
        )
      )}
    </div>
    {/* Config summary */}
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "CPU", value: "4 Cores" },
        { label: "Memory", value: "8 GB" },
        { label: "Disk", value: "50 GB" },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-center"
        >
          <p className="text-xs text-zinc-500">{item.label}</p>
          <p className="text-sm font-medium text-zinc-200">{item.value}</p>
        </div>
      ))}
    </div>
  </div>
);

const MonitorVisual = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-zinc-200">Server Metrics</p>
      <span className="text-xs text-zinc-500">Live</span>
    </div>
    {/* Metric bars */}
    {[
      { label: "CPU Usage", value: 42, color: "bg-emerald-400" },
      { label: "Memory", value: 67, color: "bg-blue-400" },
      { label: "Disk I/O", value: 23, color: "bg-amber-400" },
      { label: "Network", value: 51, color: "bg-purple-400" },
    ].map((metric) => (
      <div key={metric.label} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">{metric.label}</span>
          <span className="text-xs font-medium text-zinc-300">{metric.value}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${metric.value}%` }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className={cn("h-full rounded-full", metric.color)}
          />
        </div>
      </div>
    ))}
    {/* Uptime */}
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <span className="text-xs text-zinc-400">Uptime</span>
      <span className="text-sm font-medium text-emerald-400">99.98% &middot; 14d 6h</span>
    </div>
  </div>
);

const PlayersVisual = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-zinc-200">Online Players</p>
      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        12 / 64
      </span>
    </div>
    <div className="space-y-2">
      {[
        { name: "Alex_Builder", role: "Admin", online: true },
        { name: "CraftMaster99", role: "Moderator", online: true },
        { name: "SurvivalPro", role: "Member", online: true },
        { name: "RedstoneWiz", role: "Member", online: true },
        { name: "NoobSlayer42", role: "Member", online: false },
      ].map((player) => (
        <div
          key={player.name}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                player.online ? "bg-emerald-400" : "bg-zinc-600"
              )}
            />
            <span className="text-sm text-zinc-200">{player.name}</span>
          </div>
          <span
            className={cn(
              "text-xs",
              player.role === "Admin"
                ? "text-amber-400"
                : player.role === "Moderator"
                  ? "text-blue-400"
                  : "text-zinc-500"
            )}
          >
            {player.role}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const BackupsVisual = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-zinc-200">Backup Schedule</p>
      <span className="text-xs text-zinc-500">Next: 2h 14m</span>
    </div>
    <div className="space-y-2">
      {[
        {
          name: "Auto Backup",
          time: "Today, 03:00 AM",
          size: "2.4 GB",
          status: "completed",
        },
        {
          name: "Auto Backup",
          time: "Yesterday, 03:00 AM",
          size: "2.3 GB",
          status: "completed",
        },
        {
          name: "Manual Backup",
          time: "Jan 27, 11:45 AM",
          size: "2.4 GB",
          status: "completed",
        },
        {
          name: "Auto Backup",
          time: "Jan 27, 03:00 AM",
          size: "2.2 GB",
          status: "completed",
        },
      ].map((backup, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5"
        >
          <div>
            <p className="text-sm text-zinc-200">{backup.name}</p>
            <p className="text-xs text-zinc-500">{backup.time}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-zinc-300">{backup.size}</p>
            <p className="text-xs text-emerald-400">Completed</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ScaleVisual = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-zinc-200">Node Cluster</p>
      <span className="text-xs text-zinc-500">3 nodes</span>
    </div>
    {[
      { name: "us-east-1", servers: 8, cpu: 62, mem: 71, status: "healthy" },
      { name: "eu-west-1", servers: 5, cpu: 45, mem: 58, status: "healthy" },
      { name: "ap-south-1", servers: 3, cpu: 28, mem: 34, status: "healthy" },
    ].map((node) => (
      <div key={node.name} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-medium text-zinc-200">{node.name}</span>
          </div>
          <span className="text-xs text-zinc-500">{node.servers} servers</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">CPU</span>
              <span className="text-[11px] text-zinc-400">{node.cpu}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${node.cpu}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">MEM</span>
              <span className="text-[11px] text-zinc-400">{node.mem}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${node.mem}%` }} />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const showcaseVisuals = [DeployVisual, MonitorVisual, PlayersVisual, BackupsVisual, ScaleVisual];

// ============================================================================
// Feature Showcase (progress bars + visuals)
// ============================================================================

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const startTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(0);

    const step = 30; // ms
    let elapsed = 0;

    intervalRef.current = setInterval(() => {
      elapsed += step;
      setProgress(Math.min((elapsed / CYCLE_DURATION) * 100, 100));

      if (elapsed >= CYCLE_DURATION) {
        setActiveIndex((prev) => (prev + 1) % showcaseItems.length);
        elapsed = 0;
        setProgress(0);
      }
    }, step);
  }, []);

  useEffect(() => {
    if (isInView) startTimer();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isInView, startTimer]);

  const handleSelect = (index: number) => {
    setActiveIndex(index);
    startTimer();
  };

  const ActiveVisual = showcaseVisuals[activeIndex] ?? DeployVisual;

  return (
    <section ref={sectionRef} id="showcase" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="mb-16">
          <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
            How it works
          </span>
          <h2 className="mb-4 max-w-xl text-3xl font-light text-zinc-100 sm:text-4xl">
            Everything you need to run game servers, in one panel
          </h2>
          <p className="max-w-2xl text-zinc-500">
            From deployment to scaling, StellarStack handles the full lifecycle of your game server
            infrastructure.
          </p>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Progress list */}
          <div className="space-y-1">
            {showcaseItems.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.label}
                  onClick={() => handleSelect(index)}
                  className={cn(
                    "group w-full text-left transition-all duration-300",
                    "rounded-xl px-5 py-4",
                    isActive ? "bg-zinc-900/80" : "hover:bg-zinc-900/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors",
                        isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
                      )}
                    >
                      {item.label}
                    </span>
                    <BsArrowRight
                      className={cn(
                        "h-3.5 w-3.5 transition-all",
                        isActive
                          ? "translate-x-0 text-emerald-400 opacity-100"
                          : "-translate-x-1 text-zinc-600 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      )}
                    />
                  </div>

                  {/* Description - only visible when active */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden text-sm leading-relaxed text-zinc-500"
                      >
                        <span className="block pt-2">{item.description}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Progress bar */}
                  <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-zinc-800">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        isActive ? "bg-emerald-400" : "bg-transparent"
                      )}
                      style={{
                        width: isActive ? `${progress}%` : "0%",
                      }}
                      transition={{ duration: 0.05, ease: "linear" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Visual panel */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
              {/* Panel header */}
              <div className="mb-5 flex items-center gap-2 border-b border-zinc-800/60 pb-4">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="ml-2 text-xs text-zinc-600">
                  {showcaseItems[activeIndex]?.heading}
                </span>
              </div>
              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <ActiveVisual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// Features Grid
// ============================================================================

const FeaturesGrid = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <AnimatedSection className="mb-16 text-center">
          <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
            Features
          </span>
          <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
            Built for self-hosting.{" "}
            <span className="text-zinc-500">
              No vendor lock-in, no monthly fees, complete control.
            </span>
          </h2>
        </AnimatedSection>

        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4 }}
              className={cn(
                "group relative rounded-xl border p-6 transition-all duration-300",
                "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60"
              )}
            >
              <div className="mb-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                <feature.icon className="h-4 w-4 text-emerald-400" />
              </div>
              <h3 className="mb-2 text-base font-medium text-zinc-100">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-500">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// ============================================================================
// FAQ Accordion
// ============================================================================

const FAQItem = ({
  item,
  isOpen,
  onToggle,
}: {
  item: (typeof faqItems)[0];
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <div className="border-b border-zinc-800/60">
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-zinc-100"
    >
      <span
        className={cn(
          "text-[15px] font-medium transition-colors",
          isOpen ? "text-zinc-100" : "text-zinc-300"
        )}
      >
        {item.question}
      </span>
      <BsChevronDown
        className={cn(
          "h-4 w-4 flex-shrink-0 text-zinc-500 transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <p className="pb-5 text-sm leading-relaxed text-zinc-500">{item.answer}</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative px-6 py-32">
      <div className="mx-auto max-w-3xl">
        <AnimatedSection className="mb-12 text-center">
          <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
            FAQ
          </span>
          <h2 className="text-3xl font-light text-zinc-100 sm:text-4xl">Common questions</h2>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div>
            {faqItems.map((item, index) => (
              <FAQItem
                key={index}
                item={item}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

// ============================================================================
// Install / Terminal
// ============================================================================

const installSteps = [
  { text: "curl -sSL https://get.stellarstack.app | bash", delay: 0 },
  { text: "Detecting system architecture... x86_64", delay: 800 },
  { text: "Downloading StellarStack v1.3.9...", delay: 1200 },
  { text: "Installing dependencies...", delay: 2000 },
  { text: "Configuring Docker...", delay: 2800 },
  { text: "Starting services...", delay: 3400 },
  {
    text: "StellarStack is ready! Visit https://localhost:3000",
    delay: 4200,
  },
];

const TerminalWindow = () => {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
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
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-600">Terminal</span>
      </div>
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
                index === installSteps.length - 1 && "text-emerald-400"
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
    { href: "#showcase", label: "How it works", isAnchor: true },
    { href: "#features", label: "Features", isAnchor: true },
    { href: "#install", label: "Install", isAnchor: true },
    { href: "#faq", label: "FAQ", isAnchor: true },
  ];

  return (
    <div className={cn("relative min-h-svh scroll-smooth", "bg-[#0b0b0a]")}>
      <Navigation links={homeNavLinks} />

      {/* ================================================================ */}
      {/* Hero */}
      {/* ================================================================ */}
      <section
        ref={heroRef}
        className="relative flex min-h-svh flex-col items-center justify-center px-6 pt-20"
      >
        {/* Background gradient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 left-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-3xl"
            style={{
              background: "radial-gradient(circle, #34d399 0%, transparent 70%)",
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
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-zinc-400">Open Source</span>
            <span className="h-1 w-1 rounded-full bg-zinc-600" />
            <span className="text-xs text-zinc-500">MIT License</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 text-4xl leading-[1.08] font-light tracking-tight sm:text-5xl md:text-7xl"
          >
            <span className="text-zinc-100">The infrastructure behind your</span>
            <br />
            <span className="text-zinc-100">game servers, </span>
            <span className="text-zinc-500">simplified.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400"
          >
            A modern, open-source game server management panel designed for self-hosting on your own
            infrastructure.
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
              href="https://github.com/StellarStackOSS/StellarStack"
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

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs tracking-wider text-zinc-600 uppercase">Scroll</span>
            <div className="h-8 w-[1px] bg-gradient-to-b from-zinc-600 to-transparent" />
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================ */}
      {/* Feature Showcase (Progress Bars + Visuals) */}
      {/* ================================================================ */}
      <FeatureShowcase />

      {/* ================================================================ */}
      {/* Features Grid */}
      {/* ================================================================ */}
      <FeaturesGrid />

      {/* ================================================================ */}
      {/* Install Section */}
      {/* ================================================================ */}
      <section id="install" className="relative px-6 py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: content */}
            <AnimatedSection>
              <span className="mb-4 inline-block text-xs font-medium tracking-wider text-zinc-500 uppercase">
                Get started
              </span>
              <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
                Up and running in minutes
              </h2>
              <p className="mb-6 text-zinc-500">
                One command installs everything -- Docker, the database, the API, the web panel, and
                the daemon. No complex configuration required.
              </p>
              <div className="space-y-3">
                {[
                  "Automated Docker & dependency setup",
                  "PostgreSQL database provisioned automatically",
                  "Secure HTTPS with auto-generated certificates",
                  "Multi-architecture support (x86_64 & ARM64)",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-sm text-zinc-400">{item}</span>
                  </div>
                ))}
              </div>
            </AnimatedSection>

            {/* Right: terminal */}
            <AnimatedSection delay={0.15}>
              <TerminalWindow />
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FAQ */}
      {/* ================================================================ */}
      <FAQSection />

      {/* ================================================================ */}
      {/* CTA */}
      {/* ================================================================ */}
      <section className="relative px-6 py-32">
        <div className="mx-auto max-w-4xl">
          <AnimatedSection>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border p-12 text-center",
                "border-zinc-800 bg-zinc-900/50"
              )}
            >
              {/* Dot pattern */}
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, #27272a 1px, transparent 0)",
                  backgroundSize: "32px 32px",
                }}
              />

              <div className="relative z-10">
                <h2 className="mb-4 text-3xl font-light text-zinc-100 sm:text-4xl">
                  Ready to get started?
                </h2>
                <p className="mx-auto mb-8 max-w-xl text-zinc-500">
                  StellarStack is free and open source. Deploy it on your own infrastructure and
                  take full control of your game servers.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <a href="https://docs.stellarstack.app" target="_blank" rel="noopener noreferrer">
                    <TextureButton variant="primary">
                      Read the Docs
                      <BsArrowRight className="ml-2 h-4 w-4" />
                    </TextureButton>
                  </a>
                  <a
                    href="https://github.com/StellarStackOSS/StellarStack"
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
