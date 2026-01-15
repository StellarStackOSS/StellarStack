"use client";

import { useState, useEffect, useRef, type JSX } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { motion, useInView, AnimatePresence } from "framer-motion";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import "swiper/css";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import type { GridItemConfig } from "@workspace/ui/components/drag-drop-grid";
import {
  BsServer,
  BsShieldCheck,
  BsLightningCharge,
  BsGithub,
  BsArrowRight,
  BsCheck,
  BsTerminal,
  BsDatabase,
  BsPeople,
  BsPersonWorkspace,
  BsCodeSlash,
  BsImage,
  BsShieldLock,
  BsKey,
  BsLock,
  BsFileEarmarkLock,
} from "react-icons/bs";
import {
  SiNextdotjs,
  SiReact,
  SiTypescript,
  SiPostgresql,
  SiPrisma,
  SiDocker,
  SiTailwindcss,
  SiHono,
  SiRedis,
  SiNodedotjs,
  SiTurborepo,
  SiRust,
  SiStorybook,
  SiTraefikproxy,
  SiPrometheus,
  SiGrafana,
} from "react-icons/si";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { TextureButton } from "@workspace/ui/components/texture-button";
import {
  TextureCard,
  TextureCardContent,
  TextureCardHeader,
  TextureSeparator,
} from "@workspace/ui/components/texture-card";
import { Mail } from "lucide-react";
import { AnimatedBackground, FloatingDots } from "@workspace/ui/components";
import { Dithering } from "@paper-design/shaders-react";

// Technology stack
const technologies = [
  { name: "Next.js", Icon: SiNextdotjs },
  { name: "React", Icon: SiReact },
  { name: "TypeScript", Icon: SiTypescript },
  { name: "PostgreSQL", Icon: SiPostgresql },
  { name: "Prisma", Icon: SiPrisma },
  { name: "Docker", Icon: SiDocker },
  { name: "Traefik", Icon: SiTraefikproxy },
  { name: "Tailwind CSS", Icon: SiTailwindcss },
  { name: "Hono", Icon: SiHono },
  { name: "Redis", Icon: SiRedis },
  { name: "Node.js", Icon: SiNodedotjs },
  { name: "Turborepo", Icon: SiTurborepo },
  { name: "Rust", Icon: SiRust },
  { name: "Prometheus", Icon: SiPrometheus },
  { name: "Grafana", Icon: SiGrafana },
  { name: "Storybook", Icon: SiStorybook },
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
      "Role-based access control, API key management, 2FA support, and comprehensive audit logging.",
  },
  {
    icon: BsLightningCharge,
    title: "Instant Deployment",
    description:
      "Spin up new game servers in seconds with automated provisioning and configuration.",
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
    description: "Built-in MySQL, PostgreSQL, and MongoDB database provisioning for game servers.",
  },
];

// Target users
const targetUsers = [
  {
    icon: BsServer,
    title: "VPS & Dedicated",
    description:
      "Got a VPS or dedicated server? Run the install script and have a full game server panel in minutes.",
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
    title: "Developers",
    description:
      "Contribute to the project, build custom blueprints, or extend functionality with the REST API.",
  },
];

// Security features
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
    description: "TLS 1.3 support out of the box with automatic certificate management via Caddy.",
  },
  {
    icon: BsFileEarmarkLock,
    title: "mTLS Communication",
    description:
      "Mutual TLS authentication between control plane and daemon nodes for zero-trust security.",
  },
];

// Security layers
const securityLayers = [
  { layer: "Edge", items: ["DDoS Protection", "WAF Rules", "Rate Limiting", "Bot Protection"] },
  {
    layer: "Application",
    items: ["Authentication", "RBAC", "Input Validation", "CSRF Protection"],
  },
  {
    layer: "Infrastructure",
    items: ["Network Segmentation", "Firewall Rules", "Encrypted Storage", "Audit Logging"],
  },
  {
    layer: "Container",
    items: ["Resource Limits", "Network Isolation", "No Privileged Mode", "Seccomp Profiles"],
  },
];

// Initial sample server data
const initialServerData = {
  name: "US-WEST-MC-01",
  cpu: {
    usage: {
      percentage: 74,
      history: [45, 52, 48, 55, 62, 58, 65, 72, 68, 75, 70, 73, 78, 82, 76, 79, 85, 80, 77, 74],
    },
    cores: 8,
    frequency: 3.6,
  },
  memory: {
    usage: {
      percentage: 88,
      history: [60, 62, 65, 63, 68, 70, 72, 75, 73, 78, 76, 79, 82, 80, 85, 83, 87, 84, 86, 88],
    },
    used: 14.1,
    total: 16,
    type: "DDR4",
  },
  disk: {
    usage: {
      percentage: 51,
      history: [42, 42, 43, 43, 44, 44, 45, 45, 46, 46, 47, 47, 48, 48, 49, 49, 50, 50, 51, 51],
    },
    used: 51,
    total: 100,
    type: "NVMe SSD",
  },
  network: {
    download: 340,
    upload: 165,
    downloadHistory: [
      120, 145, 130, 180, 165, 200, 175, 220, 190, 240, 210, 260, 230, 280, 250, 300, 270, 320, 290,
      340,
    ],
    uploadHistory: [
      45, 52, 48, 65, 58, 72, 62, 85, 70, 95, 78, 105, 85, 120, 92, 135, 100, 150, 110, 165,
    ],
  },
  networkConfig: {
    publicIp: "45.33.128.72",
    privateIp: "192.168.1.100",
    openPorts: [
      { port: 25565, protocol: "TCP" },
      { port: 25575, protocol: "TCP" },
    ],
    macAddress: "00:1A:2B:3C:4D:5E",
  },
  node: {
    id: "node-us-west-1",
    name: "US West 1",
    location: "Los Angeles, CA",
    region: "us-west",
    zone: "us-west-1a",
    provider: "Hetzner",
  },
};

// Grid items config for the landing page preview
const previewGridItems: GridItemConfig[] = [
  { i: "instance-name", size: "xxl-wide", minSize: "xxl-wide", maxSize: "xxl-wide" },
  { i: "container-controls", size: "xxs-wide", minSize: "xxs-wide", maxSize: "xxs-wide" },
  { i: "cpu", size: "xs", minSize: "xxs", maxSize: "lg" },
  { i: "ram", size: "xs", minSize: "xxs", maxSize: "sm" },
  { i: "disk", size: "xs", minSize: "xxs", maxSize: "sm" },
  { i: "network-usage", size: "xs", minSize: "xxs", maxSize: "sm" },
  { i: "console", size: "xl", minSize: "md", maxSize: "xxl" },
];

// Sample console messages
const sampleConsoleMessages = [
  "Server tick took 48ms",
  "Saving world chunks...",
  "World saved successfully",
  "Player Steve moved to chunk [12, -5]",
  "Entity count: 847",
  "Memory usage: 2.4GB / 4GB",
  "TPS: 19.8",
  "Autosave completed in 234ms",
  "Player Alex joined the game",
  "Player Steve: Hello everyone!",
  "Loaded 24 chunks for player Alex",
  "Garbage collection freed 128MB",
  "Processing 12 pending block updates",
  "Weather changed to rain",
  "Player Steve earned achievement [Getting Wood]",
];

interface ConsoleLine {
  id: string;
  timestamp: number;
  message: string;
  level: "info" | "error" | "default";
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// Animated section wrapper
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

const LandingPage = (): JSX.Element | null => {
  const { setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const [isEnterpriseArch, setIsEnterpriseArch] = useState(false);
  const [serverData, setServerData] = useState(initialServerData);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([
    {
      id: "1",
      timestamp: Date.now() - 5000,
      message: "Server started on port 25565",
      level: "info",
    },
    {
      id: "2",
      timestamp: Date.now() - 4000,
      message: 'Loading world "survival"...',
      level: "default",
    },
    {
      id: "3",
      timestamp: Date.now() - 3000,
      message: "Done! Server ready for connections",
      level: "info",
    },
    {
      id: "4",
      timestamp: Date.now() - 2000,
      message: 'Player "Steve" joined the game',
      level: "default",
    },
  ]);
  const lineIdRef = useRef(5);
  const [currentScreenshot, setCurrentScreenshot] = useState(1);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Toggle between screenshots
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setCurrentScreenshot((prev) => (prev === 1 ? 2 : 1));
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [mounted]);

  // Randomly update server data and add console lines
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setServerData((prev) => {
        const newCpu = Math.max(
          20,
          Math.min(95, prev.cpu.usage.percentage + (Math.random() - 0.5) * 10)
        );
        const newRam = Math.max(
          40,
          Math.min(95, prev.memory.usage.percentage + (Math.random() - 0.5) * 8)
        );
        const newDisk = Math.max(
          30,
          Math.min(80, prev.disk.usage.percentage + (Math.random() - 0.3) * 2)
        );
        const newDownload = Math.max(
          50,
          Math.min(500, prev.network.download + (Math.random() - 0.5) * 100)
        );
        const newUpload = Math.max(
          20,
          Math.min(250, prev.network.upload + (Math.random() - 0.5) * 50)
        );

        return {
          ...prev,
          cpu: {
            ...prev.cpu,
            usage: {
              percentage: Math.round(newCpu),
              history: [...prev.cpu.usage.history.slice(1), Math.round(newCpu)],
            },
          },
          memory: {
            ...prev.memory,
            usage: {
              percentage: Math.round(newRam),
              history: [...prev.memory.usage.history.slice(1), Math.round(newRam)],
            },
          },
          disk: {
            ...prev.disk,
            usage: {
              percentage: Math.round(newDisk),
              history: [...prev.disk.usage.history.slice(1), Math.round(newDisk)],
            },
          },
          network: {
            ...prev.network,
            download: Math.round(newDownload),
            upload: Math.round(newUpload),
            downloadHistory: [...prev.network.downloadHistory.slice(1), Math.round(newDownload)],
            uploadHistory: [...prev.network.uploadHistory.slice(1), Math.round(newUpload)],
          },
        };
      });

      // Add a new console line randomly
      if (Math.random() > 0.3) {
        const randomMessage =
          sampleConsoleMessages[Math.floor(Math.random() * sampleConsoleMessages.length)] ??
          "Server tick completed";
        const newLine: ConsoleLine = {
          id: String(lineIdRef.current++),
          timestamp: Date.now(),
          message: randomMessage,
          level: Math.random() > 0.9 ? "info" : "default",
        };
        setConsoleLines((prev) => [...prev.slice(-50), newLine]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [mounted]);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  const homeNavLinks = [
    { href: "#features", label: "Features", isAnchor: true },
    { href: "#security", label: "Security", isAnchor: true },
    { href: "#tech", label: "Tech Stack", isAnchor: true },
  ];

  return (
    <div
      className={cn(
        "relative min-h-svh scroll-smooth transition-colors",
        isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
      )}
    >
      <AnimatedBackground />
      <Navigation links={homeNavLinks} />

      <section className="relative flex flex-row items-center justify-center px-6 pt-32 pb-20">
        <div className="flex max-w-[50%] flex-col items-center justify-center gap-18">
          <div className="flex flex-col items-center justify-center">
            <div></div>
            <div className="mt-24 flex flex-col">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-6 text-center text-5xl leading-[1.1] font-extralight tracking-tight md:text-8xl"
              >
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: isDark
                      ? "linear-gradient(135deg, #ffffff 0%, #a1a1aa 50%, #71717a 100%)"
                      : "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #52525b 100%)",
                  }}
                >
                  The infrastructure behind your game servers, simplified.
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className={cn(
                  "mx-auto mb-10 max-w-2xl text-center text-lg leading-relaxed md:text-lg",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                A modern, open-source game server management panel designed for self-hosting on your
                own infrastructure.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row"
              >
                <a
                  href="https://github.com/stellarstack/stellarstack"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TextureButton variant="primary">
                    Read the Docs
                    <BsArrowRight className="ml-2 h-4 w-4" />
                  </TextureButton>
                </a>
              </motion.div>
            </div>
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border-4",
                isDark ? "border-zinc-800" : "border-zinc-200"
              )}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentScreenshot}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  src={`/screenshot-${currentScreenshot}.png`}
                  className="aspect w-full"
                />
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>
      <Footer isDark={isDark} />
    </div>
  );
};

export default LandingPage;
