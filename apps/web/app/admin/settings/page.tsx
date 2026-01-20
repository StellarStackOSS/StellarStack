"use client";

import { useEffect, useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { FadeIn } from "@workspace/ui/components/fade-in";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CloudIcon,
  GlobeIcon,
  Loader2Icon,
  MailIcon,
  PaletteIcon,
  SaveIcon,
  TestTube2Icon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import {
  adminSettings,
  type BrandingSettings,
  type CloudflareSettings,
  type EmailSettings,
  type SubdomainSettings,
} from "@/lib/api";
import { toast } from "sonner";
import { TextureButton } from "@workspace/ui/components/texture-button";
import { Label } from "@workspace/ui/components/label";
import { Input, Switch } from "@workspace/ui/components";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

const SettingsSection = ({
  title,
  description,
  icon: Icon,
  children,
  onSave,
  onTest,
  isSaving,
  isTesting,
  testResult,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onSave: () => void;
  onTest?: () => void;
  isSaving: boolean;
  isTesting?: boolean;
  testResult?: { success: boolean; message?: string } | null;
}) => {
  return (
    <div className={cn("relative border border-zinc-700/50 bg-zinc-900/50 p-6")}>
      {/* Corner accents */}
      <div className={cn("absolute top-0 left-0 h-2 w-2 border-t border-l border-zinc-700")} />
      <div className={cn("absolute top-0 right-0 h-2 w-2 border-t border-r border-zinc-700")} />
      <div className={cn("absolute bottom-0 left-0 h-2 w-2 border-b border-l border-zinc-700")} />
      <div className={cn("absolute right-0 bottom-0 h-2 w-2 border-r border-b border-zinc-700")} />

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Icon className={cn("h-5 w-5 text-zinc-400")} />
        <div>
          <h2 className={cn("font-medium text-zinc-100")}>{title}</h2>
          <p className={cn("text-xs text-zinc-500")}>{description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mb-6 space-y-4">{children}</div>

      {/* Test Result */}
      {testResult && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2 border p-3 text-sm",
            testResult.success
              ? "border-green-700/50 bg-green-900/20 text-green-400"
              : "border-red-700/50 bg-red-900/20 text-red-400"
          )}
        >
          {testResult.success ? (
            <CheckCircle2Icon className="h-4 w-4" />
          ) : (
            <XCircleIcon className="h-4 w-4" />
          )}
          {testResult.message || (testResult.success ? "Test successful" : "Test failed")}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <TextureButton variant="minimal" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <SaveIcon className="h-4 w-4" />
          )}
          Save
        </TextureButton>
        {onTest && (
          <TextureButton variant="minimal" onClick={onTest} disabled={isTesting}>
            {isTesting ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube2Icon className="h-4 w-4" />
            )}
            Test Connection
          </TextureButton>
        )}
      </div>
    </div>
  );
};

export default function AdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Cloudflare state
  const [cloudflare, setCloudflare] = useState<CloudflareSettings>({
    apiToken: "",
    zoneId: "",
    domain: "",
    enabled: false,
  });
  const [savingCloudflare, setSavingCloudflare] = useState(false);
  const [testingCloudflare, setTestingCloudflare] = useState(false);
  const [cloudflareTestResult, setCloudflareTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Subdomain state
  const [subdomains, setSubdomains] = useState<SubdomainSettings>({
    enabled: false,
    baseDomain: "",
    autoProvision: false,
    dnsProvider: "manual",
  });
  const [savingSubdomains, setSavingSubdomains] = useState(false);

  // Email state
  const [email, setEmail] = useState<EmailSettings>({
    provider: "smtp",
    fromEmail: "",
    fromName: "StellarStack",
    smtp: {
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
    },
    apiKey: "",
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>({
    appName: "StellarStack",
    logoUrl: null,
    faviconUrl: null,
    primaryColor: "#22c55e",
    supportEmail: "",
    supportUrl: null,
    termsUrl: null,
    privacyUrl: null,
    footerText: "",
    customCss: "",
  });
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [cf, sub, em, br] = await Promise.all([
          adminSettings.cloudflare.get(),
          adminSettings.subdomains.get(),
          adminSettings.email.get(),
          adminSettings.branding.get(),
        ]);

        setCloudflare(cf);
        setSubdomains(sub);
        setEmail({
          ...em,
          smtp: em.smtp || { host: "", port: 587, secure: false, username: "", password: "" },
        });
        setBranding(br);
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSaveCloudflare = async () => {
    setSavingCloudflare(true);
    try {
      const updated = await adminSettings.cloudflare.update(cloudflare);
      setCloudflare(updated);
      toast.success("Cloudflare settings saved");
    } catch (error) {
      toast.error("Failed to save Cloudflare settings");
    } finally {
      setSavingCloudflare(false);
    }
  };

  const handleTestCloudflare = async () => {
    setTestingCloudflare(true);
    setCloudflareTestResult(null);
    try {
      const result = await adminSettings.cloudflare.test();
      setCloudflareTestResult({
        success: result.success,
        message: result.success
          ? `Connected to zone: ${result.zone?.name} (${result.zone?.status})`
          : result.error,
      });
    } catch (error: any) {
      setCloudflareTestResult({ success: false, message: error.message });
    } finally {
      setTestingCloudflare(false);
    }
  };

  const handleSaveSubdomains = async () => {
    setSavingSubdomains(true);
    try {
      const updated = await adminSettings.subdomains.update(subdomains);
      setSubdomains(updated);
      toast.success("Subdomain settings saved");
    } catch (error) {
      toast.error("Failed to save subdomain settings");
    } finally {
      setSavingSubdomains(false);
    }
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      const updated = await adminSettings.email.update(email);
      setEmail({
        ...updated,
        smtp: updated.smtp || { host: "", port: 587, secure: false, username: "", password: "" },
      });
      toast.success("Email settings saved");
    } catch (error) {
      toast.error("Failed to save email settings");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error("Please enter a test email address");
      return;
    }
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const result = await adminSettings.email.test(testEmailAddress);
      setEmailTestResult({
        success: result.success,
        message: result.success ? result.message : result.error,
      });
    } catch (error: any) {
      setEmailTestResult({ success: false, message: error.message });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const updated = await adminSettings.branding.update(branding);
      setBranding(updated);
      toast.success("Branding settings saved");
    } catch (error) {
      toast.error("Failed to save branding settings");
    } finally {
      setSavingBranding(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex min-h-svh items-center justify-center bg-[#0b0b0a]")}>
        <Loader2Icon className={cn("h-8 w-8 animate-spin text-zinc-400")} />
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-svh bg-[#0b0b0a] transition-colors")}>
      <div className="relative p-8">
        <div className="mx-auto">
          <FadeIn delay={0}>
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/admin"
                className={cn(
                  "mb-4 inline-flex items-center gap-2 text-xs tracking-wider text-zinc-500 uppercase transition-opacity hover:opacity-70"
                )}
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <h1 className={cn("text-2xl font-light tracking-wider text-zinc-100")}>SETTINGS</h1>
              <p className={cn("mt-1 text-sm text-zinc-500")}>Configure system-wide settings</p>
            </div>
          </FadeIn>

          {/* Settings Sections */}
          <div className="space-y-6">
            <FadeIn delay={0.1}>
              <SettingsSection
                title="Cloudflare"
                description="Configure Cloudflare API for DNS management"
                icon={CloudIcon}
                onSave={handleSaveCloudflare}
                onTest={handleTestCloudflare}
                isSaving={savingCloudflare}
                isTesting={testingCloudflare}
                testResult={cloudflareTestResult}
              >
                <div>
                  <Switch
                    checked={cloudflare.enabled}
                    onCheckedChange={(v) => setCloudflare({ ...cloudflare, enabled: v })}
                  />
                  <Label>Enable Cloudflare Integration</Label>
                </div>
                <div>
                  <Label>API Token</Label>
                  <Input
                    type="password"
                    value={cloudflare.apiToken}
                    onChange={(e) => setCloudflare({ ...cloudflare, apiToken: e.target.value })}
                    placeholder="Enter Cloudflare API token"
                  />
                </div>
                <div>
                  <Label>Zone ID</Label>
                  <Input
                    type="text"
                    value={cloudflare.zoneId}
                    onChange={(e) => setCloudflare({ ...cloudflare, zoneId: e.target.value })}
                    placeholder="Enter zone ID"
                  />
                </div>
                <div>
                  <Label>Domain</Label>
                  <Input
                    type="text"
                    value={cloudflare.domain}
                    onChange={(e) => setCloudflare({ ...cloudflare, domain: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
              </SettingsSection>
            </FadeIn>

            <FadeIn delay={0.2}>
              <SettingsSection
                title="Subdomains"
                description="Configure automatic subdomain provisioning for servers"
                icon={GlobeIcon}
                onSave={handleSaveSubdomains}
                isSaving={savingSubdomains}
              >
                <div>
                  <Switch
                    checked={subdomains.enabled}
                    onCheckedChange={(v) => setSubdomains({ ...subdomains, enabled: v })}
                  />
                  <Label>Enable Subdomains</Label>
                </div>
                <div>
                  <Label>Base Domain</Label>
                  <Input
                    type="text"
                    value={subdomains.baseDomain}
                    onChange={(e) => setSubdomains({ ...subdomains, baseDomain: e.target.value })}
                    placeholder="servers.example.com"
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>
                    Subdomains will be created under this domain (e.g.,
                    myserver.servers.example.com)
                  </p>
                </div>
                <div>
                  <Label>DNS Provider</Label>
                  <Select
                    value={subdomains.dnsProvider}
                    onValueChange={(v: string) =>
                      setSubdomains({ ...subdomains, dnsProvider: v as "cloudflare" | "manual" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual DNS</SelectItem>
                      <SelectItem value="cloudflare">Cloudflare (automatic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {subdomains.dnsProvider === "cloudflare" && (
                  <div>
                    <Switch
                      checked={subdomains.autoProvision}
                      onCheckedChange={(v) => setSubdomains({ ...subdomains, autoProvision: v })}
                    />
                    <Label>Auto-provision DNS records</Label>
                  </div>
                )}
              </SettingsSection>
            </FadeIn>

            <FadeIn delay={0.3}>
              <SettingsSection
                title="Email"
                description="Configure email settings for notifications and invitations"
                icon={MailIcon}
                onSave={handleSaveEmail}
                onTest={handleTestEmail}
                isSaving={savingEmail}
                isTesting={testingEmail}
                testResult={emailTestResult}
              >
                <div>
                  <Label>Email Provider</Label>
                  <Select
                    value={email.provider}
                    onValueChange={(v: string) =>
                      setEmail({ ...email, provider: v as EmailSettings["provider"] })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">SMTP</SelectItem>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={email.fromEmail}
                    onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })}
                    placeholder="noreply@example.com"
                  />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input
                    type="text"
                    value={email.fromName}
                    onChange={(e) => setEmail({ ...email, fromName: e.target.value })}
                    placeholder="StellarStack"
                  />
                </div>

                {email.provider === "smtp" && (
                  <>
                    <div>
                      <Label>SMTP Host</Label>
                      <Input
                        type="text"
                        value={email.smtp?.host || ""}
                        onChange={(e) =>
                          setEmail({ ...email, smtp: { ...email.smtp!, host: e.target.value } })
                        }
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        value={String(email.smtp?.port || 587)}
                        onChange={(e) =>
                          setEmail({
                            ...email,
                            smtp: { ...email.smtp!, port: parseInt(e.target.value) || 587 },
                          })
                        }
                        placeholder="587"
                      />
                    </div>
                    <div>
                      <Switch
                        checked={email.smtp?.secure || false}
                        onCheckedChange={(v) =>
                          setEmail({ ...email, smtp: { ...email.smtp!, secure: v } })
                        }
                      />
                      <Label>Use TLS/SSL</Label>
                    </div>
                    <div>
                      <Label>SMTP Username</Label>
                      <Input
                        type="text"
                        value={email.smtp?.username || ""}
                        onChange={(e) =>
                          setEmail({ ...email, smtp: { ...email.smtp!, username: e.target.value } })
                        }
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label>SMTP Password</Label>
                      <Input
                        type="password"
                        value={email.smtp?.password || ""}
                        onChange={(e) =>
                          setEmail({ ...email, smtp: { ...email.smtp!, password: e.target.value } })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                  </>
                )}

                {email.provider !== "smtp" && (
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={email.apiKey || ""}
                      onChange={(e) => setEmail({ ...email, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                  </div>
                )}

                <div>
                  <Label>Test Email Address</Label>
                  <Input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="test@example.com"
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>
                    Enter an email address to send a test email
                  </p>
                </div>
              </SettingsSection>
            </FadeIn>

            <FadeIn delay={0.4}>
              <SettingsSection
                title="Branding"
                description="Customize the appearance and branding of your panel"
                icon={PaletteIcon}
                onSave={handleSaveBranding}
                isSaving={savingBranding}
              >
                <div>
                  <Label>Application Name</Label>
                  <Input
                    type="text"
                    value={branding.appName}
                    onChange={(e) => setBranding({ ...branding, appName: e.target.value })}
                    placeholder="StellarStack"
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>
                    The name displayed throughout the application
                  </p>
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    type="text"
                    value={branding.logoUrl || ""}
                    onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value || null })}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>
                    URL to your logo image (recommended: 200x50px)
                  </p>
                </div>
                <div>
                  <Label>Favicon URL</Label>
                  <Input
                    type="text"
                    value={branding.faviconUrl || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, faviconUrl: e.target.value || null })
                    }
                    placeholder="https://example.com/favicon.ico"
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>URL to your favicon</p>
                </div>
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer border-0"
                    />
                    <Input
                      type="text"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      placeholder="#22c55e"
                    />
                  </div>
                </div>
                <div>
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={branding.supportEmail}
                    onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
                    placeholder="support@example.com"
                  />
                </div>
                <div>
                  <Label>Support URL</Label>
                  <Input
                    type="text"
                    value={branding.supportUrl || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, supportUrl: e.target.value || null })
                    }
                    placeholder="https://support.example.com"
                  />
                </div>
                <div>
                  <Label>Terms of Service URL</Label>
                  <Input
                    type="text"
                    value={branding.termsUrl || ""}
                    onChange={(e) => setBranding({ ...branding, termsUrl: e.target.value || null })}
                    placeholder="https://example.com/terms"
                  />
                </div>
                <div>
                  <Label>Privacy Policy URL</Label>
                  <Input
                    type="text"
                    value={branding.privacyUrl || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, privacyUrl: e.target.value || null })
                    }
                    placeholder="https://example.com/privacy"
                  />
                </div>
                <div>
                  <Label>Footer Text</Label>
                  <Input
                    type="text"
                    value={branding.footerText}
                    onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
                    placeholder="Powered by StellarStack"
                  />
                </div>
                <div>
                  <Label>Custom CSS</Label>
                  <Textarea
                    value={branding.customCss}
                    onChange={(e) => setBranding({ ...branding, customCss: e.target.value })}
                    placeholder="/* Custom CSS styles */"
                    rows={6}
                  />
                  <p className={cn("mt-1 text-xs text-zinc-500")}>
                    Advanced: Add custom CSS to override default styles (admins only)
                  </p>
                </div>
              </SettingsSection>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
