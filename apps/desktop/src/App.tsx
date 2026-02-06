import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Spinner from "@stellarUI/components/Spinner/Spinner";
import Input from "@stellarUI/components/Input/Input";
import Button from "@stellarUI/components/Button/Button";
import TitleBar from "./components/TitleBar";

/** Config shape returned by the get_config IPC command. */
interface AppConfig {
  api_port: number;
  daemon_port: number;
  sftp_port: number;
}

/** Location creation response shape. */
interface LocationResponse {
  id: string;
  name: string;
}

/** Node creation response shape. */
interface NodeResponse {
  node: Record<string, unknown>;
  token_id: string;
  token: string;
}

/**
 * Desktop splash screen — runs the startup sequence, shows progress,
 * and presents the setup wizard on first run.
 */
const App = (): JSX.Element => {
  const [status, setStatus] = useState("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Guard against double-invocation (React StrictMode or HMR)
    if (startedRef.current) return;
    startedRef.current = true;

    // Listen for backend status events
    const unlisten = listen("startup-status", (e) => {
      setStatus(e.payload as string);
    });

    startup();

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const startup = async (): Promise<void> => {
    try {
      setStatus("Checking Docker...");
      await invoke("check_docker");

      const initialized = await invoke<boolean>("is_initialized");

      setStatus("Starting database services...");
      await invoke("start_docker_services");

      setStatus("Running database migrations...");
      await invoke("run_migrations");

      setStatus("Starting API server...");
      await invoke("start_api");

      setStatus("Starting frontend...");
      await invoke("start_web");

      if (!initialized) {
        setShowWizard(true);
      } else {
        setStatus("Starting daemon...");
        await invoke("start_daemon");

        setStatus("Loading application...");
        window.location.href = "http://localhost:3000";
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSetup = async (): Promise<void> => {
    setWizardError(null);

    if (!name.trim() || !email.trim() || !password) {
      setWizardError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setWizardError("Password must be at least 8 characters.");
      return;
    }

    setWizardLoading(true);

    try {
      const config = await invoke<AppConfig>("get_config");
      const apiBase = `http://localhost:${config.api_port}`;

      // Create admin account
      const setupResp = await fetch(`${apiBase}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      const setupData = await setupResp.json();
      if (!setupResp.ok) throw new Error(setupData.error || "Setup failed");

      // Sign in
      const signInResp = await fetch(`${apiBase}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!signInResp.ok) throw new Error("Failed to authenticate");

      // Create local location
      const locationResp = await fetch(`${apiBase}/api/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Local",
          description: "Local desktop environment",
        }),
      });

      const locationData = (await locationResp.json()) as LocationResponse;
      if (!locationResp.ok) throw new Error("Failed to create location");

      // Create local node for daemon
      const nodeResp = await fetch(`${apiBase}/api/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: "Local Node",
          host: "localhost",
          port: config.daemon_port,
          protocol: "HTTP",
          sftpPort: config.sftp_port,
          memoryLimit: 8589934592,
          diskLimit: 53687091200,
          cpuLimit: 4,
          locationId: locationData.id,
        }),
      });

      const nodeData = (await nodeResp.json()) as NodeResponse;
      if (!nodeResp.ok) throw new Error("Failed to create node");

      const daemonTokenId = nodeData.token_id;
      const daemonToken = nodeData.token;

      // Save config
      await invoke("save_config", { daemonTokenId, daemonToken });

      // Start daemon
      await invoke("start_daemon");

      window.location.href = "http://localhost:3000";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setWizardError(message);
      setWizardLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen">
      {/* Title bar */}
      <TitleBar />

      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-0"
      >
        <source src="/Gradient.mp4" type="video/mp4" />
      </video>

      {/* Centered logo */}
      <div className="fixed inset-0 flex items-center justify-center z-10">
        <img src="/logo.png" alt="StellarStack" className="w-[120px] h-[120px]" />
      </div>

      {/* Bottom-left status */}
      {!error && !showWizard && (
        <div className="fixed bottom-7 left-7 z-20 flex items-center gap-2.5">
          <Spinner className="size-4 text-white" />
          <span className="text-[13px] text-white font-normal tracking-tight drop-shadow-md">
            {status}
          </span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="fixed bottom-7 left-7 right-7 z-30 bg-red-500/15 backdrop-blur-xl border border-red-500/30 rounded-[10px] px-5 py-4">
          <h3 className="text-red-500 text-sm font-semibold mb-1">Startup Failed</h3>
          <p className="text-white/70 text-[13px] leading-relaxed">{error}</p>
        </div>
      )}

      {/* Setup wizard overlay */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-[100] overflow-y-auto p-12">
          <div className="max-w-[400px] mx-auto pt-16">
            <h2 className="text-2xl font-semibold mb-2">Welcome to StellarStack</h2>
            <p className="text-white/60 mb-6 text-sm">
              Create your admin account to get started.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Admin"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
            </div>

            <Button
              onClick={handleSetup}
              disabled={wizardLoading}
              className="mt-5 w-full"
            >
              {wizardLoading ? (
                <>
                  <Spinner className="size-4" />
                  Setting up...
                </>
              ) : (
                "Create Account & Finish Setup"
              )}
            </Button>

            {wizardError && (
              <p className="text-red-500 text-sm mt-3">{wizardError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
