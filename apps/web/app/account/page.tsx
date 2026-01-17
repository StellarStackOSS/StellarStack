"use client";

import {type JSX, useEffect, useState} from "react";
import {cn} from "@workspace/ui/lib/utils";
import {TextureButton} from "@workspace/ui/components/texture-button";
import {SidebarTrigger} from "@workspace/ui/components/sidebar";
import {ConfirmationModal} from "@workspace/ui/components/confirmation-modal";
import {FormModal} from "@workspace/ui/components/form-modal";
import {Input} from "@workspace/ui/components/input";
import {BsCheckCircle, BsDiscord, BsGithub, BsGoogle, BsKey, BsPlus, BsShieldCheck, BsTrash,} from "react-icons/bs";
import {authClient, useSession} from "@/lib/auth-client";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import QRCode from "qrcode";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {Card} from "@workspace/ui/components";
import {SectionTitle} from "@/components/AccountPageComponents/SectionTitle";

interface Passkey {
  id: string;
  name: string | null;
  createdAt: Date;
  credentialId: string;
}

const AccountPage = (): JSX.Element | null => {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionLoading } = useSession();

  const [profile, setProfile] = useState({ name: "", email: "" });
  const [originalProfile, setOriginalProfile] = useState({ name: "", email: "" });
  const [saved, setSaved] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [passwordForAction, setPasswordForAction] = useState("");

  // Passkey state
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [addPasskeyModalOpen, setAddPasskeyModalOpen] = useState(false);
  const [deletePasskeyModalOpen, setDeletePasskeyModalOpen] = useState(false);
  const [selectedPasskey, setSelectedPasskey] = useState<Passkey | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [disableTwoFactorModalOpen, setDisableTwoFactorModalOpen] = useState(false);

  useEffect(() => {
    if (session?.user) {
      const userData = {
        name: session.user.name || "",
        email: session.user.email || "",
      };
      setProfile(userData);
      setOriginalProfile(userData);
      setTwoFactorEnabled((session.user as any).twoFactorEnabled || false);
    }
  }, [session]);

  // Fetch passkeys
  const { data: passkeyData } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const response = await authClient.passkey.listUserPasskeys();
      return response.data || [];
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (passkeyData) {
      setPasskeys(passkeyData as unknown as Passkey[]);
    }
  }, [passkeyData]);

  if (sessionLoading) return null;

  const hasProfileChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile);

  const handleSaveProfile = async () => {
    try {
      await authClient.updateUser({ name: profile.name });
      setOriginalProfile({ ...profile });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["session"] });
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  // 2FA functions
  const handleEnableTwoFactor = async () => {
    if (!passwordForAction) {
      toast.error("Please enter your password");
      return;
    }
    try {
      const response = await authClient.twoFactor.enable({
        password: passwordForAction,
      });
      if (response.data?.totpURI) {
        setTotpUri(response.data.totpURI);
        const qr = await QRCode.toDataURL(response.data.totpURI);
        setTotpQrCode(qr);
        if (response.data.backupCodes) {
          setBackupCodes(response.data.backupCodes);
        }
        setShowTotpSetup(true);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to enable 2FA");
    }
  };

  const handleVerifyTotp = async () => {
    try {
      const response = await authClient.twoFactor.verifyTotp({
        code: verifyCode,
      });
      if (response.data) {
        setTwoFactorEnabled(true);
        setShowTotpSetup(false);
        setShowBackupCodes(true);
        setVerifyCode("");
        setPasswordForAction("");
        queryClient.invalidateQueries({ queryKey: ["session"] });
        toast.success("Two-factor authentication enabled");
      }
    } catch (error: any) {
      toast.error(error?.message || "Invalid verification code");
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!passwordForAction) {
      toast.error("Please enter your password");
      return;
    }
    try {
      await authClient.twoFactor.disable({
        password: passwordForAction,
      });
      setTwoFactorEnabled(false);
      setDisableTwoFactorModalOpen(false);
      setPasswordForAction("");
      queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Two-factor authentication disabled");
    } catch (error: any) {
      toast.error(error?.message || "Failed to disable 2FA");
    }
  };

  // Passkey functions
  const handleAddPasskey = async () => {
    try {
      const response = await authClient.passkey.addPasskey({
        name: newPasskeyName,
      });
      if (response.data) {
        queryClient.invalidateQueries({ queryKey: ["passkeys"] });
        setAddPasskeyModalOpen(false);
        setNewPasskeyName("");
        toast.success("Passkey added successfully");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to add passkey");
    }
  };

  const handleDeletePasskey = async () => {
    if (!selectedPasskey) return;
    try {
      await authClient.passkey.deletePasskey({
        id: selectedPasskey.id,
      });
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
      setDeletePasskeyModalOpen(false);
      setSelectedPasskey(null);
      toast.success("Passkey deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete passkey");
    }
  };

  const openDeletePasskeyModal = (passkey: Passkey) => {
    setSelectedPasskey(passkey);
    setDeletePasskeyModalOpen(true);
  };

  // Social login functions
  const handleSocialSignIn = async (provider: "google" | "github" | "discord") => {
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.href,
      });
    } catch (error: any) {
      toast.error(error?.message || `Failed to connect ${provider}`);
    }
  };

  return (
    <Card
      className={cn(
        "relative min-h-svh transition-colors bg-[#0b0b0a]",
      )}
    >
      <AnimatedBackground />
      <FloatingDots count={15} />

      <Card className="relative p-8">
        <Card className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger
                className={cn(
                  "transition-all hover:scale-110 active:scale-95 text-zinc-400 hover:text-zinc-100",
                )}
              />
              <div>
                <h1
                  className={cn(
                    "text-2xl font-light tracking-wider text-zinc-100",
                  )}
                >
                  ACCOUNT SETTINGS
                </h1>
                <p className={cn("mt-1 text-sm text-zinc-500")}>
                  Manage your account and security
                </p>
              </div>
            </div>
          </div>

          {/* Profile Section */}
          <Card>
            <SectionTitle>Profile</SectionTitle>

            <div className="space-y-4">
              <div>
                <label
                  className={cn(
                    "text-[10px] font-medium tracking-wider uppercase text-zinc-500",
                  )}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  className={cn(
                    "mt-2 w-full border px-3 py-2 text-sm transition-colors outline-none border-zinc-700/50 bg-zinc-900/50 text-zinc-200 focus:border-zinc-500",
                  )}
                />
              </div>
              <div>
                <label
                  className={cn(
                    "text-[10px] font-medium tracking-wider uppercase text-zinc-500",
                  )}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className={cn(
                    "mt-2 w-full border px-3 py-2 text-sm opacity-50 transition-colors outline-none border-zinc-700/50 bg-zinc-900/50 text-zinc-200",
                  )}
                />
                <p className={cn("mt-1 text-xs text-zinc-500")}>
                  Email changes are not yet supported
                </p>
              </div>
            </div>

            <TextureButton
              variant="minimal"
              onClick={handleSaveProfile}
              disabled={!hasProfileChanges}
            >
              {saved ? (
                <>
                  <BsCheckCircle className="h-4 w-4" />
                  <span className="text-xs tracking-wider uppercase">Saved</span>
                </>
              ) : (
                <span className="text-xs tracking-wider uppercase">Update Profile</span>
              )}
            </TextureButton>
          </Card>

          {/* Connected Accounts Section */}
          <Card>
            <SectionTitle>Connected Accounts</SectionTitle>

            <p className={cn("mb-4 text-xs text-zinc-500")}>
              Connect your social accounts for quick sign-in.
            </p>

            <div className="flex flex-wrap gap-3">
              <TextureButton
                variant="minimal"
                onClick={() => handleSocialSignIn("google")}
              >
                <BsGoogle className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Google</span>
              </TextureButton>
              <TextureButton
                variant="minimal"
                onClick={() => handleSocialSignIn("github")}
              >
                <BsGithub className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">GitHub</span>
              </TextureButton>
              <TextureButton
                variant="minimal"
                onClick={() => handleSocialSignIn("discord")}
              >
                <BsDiscord className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Discord</span>
              </TextureButton>
            </div>
          </Card>

          {/* Passkeys Section */}
          <Card >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BsKey className={cn("h-4 w-4 text-zinc-400")} />
                <SectionTitle className="mb-0">Passkeys</SectionTitle>
              </div>
              <TextureButton
                variant="minimal"
                onClick={() => setAddPasskeyModalOpen(true)}
              >
                <BsPlus className="h-4 w-4" />
                <span className="text-xs tracking-wider uppercase">Add Passkey</span>
              </TextureButton>
            </div>

            <p className={cn("mb-4 text-xs text-zinc-500")}>
              Passkeys provide a more secure and convenient way to sign in without passwords.
            </p>

            <div className="space-y-3">
              {passkeys.length === 0 ? (
                <p className={cn("text-sm text-zinc-500")}>
                  No passkeys registered yet.
                </p>
              ) : (
                passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className={cn(
                      "flex items-center justify-between border p-4 border-zinc-700/50 bg-zinc-900/30",
                    )}
                  >
                    <div>
                      <div
                        className={cn(
                          "text-sm font-medium text-zinc-200",
                        )}
                      >
                        {passkey.name || "Unnamed Passkey"}
                      </div>
                      <div
                        className={cn("mt-1 text-xs text-zinc-500")}
                      >
                        Added {new Date(passkey.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <TextureButton
                      variant="destructive"
                      onClick={() => openDeletePasskeyModal(passkey)}
                    >
                      <BsTrash className="h-4 w-4" />
                    </TextureButton>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Two-Factor Authentication Section */}
          <Card>
            <div className="mb-6 flex items-center gap-2">
              <BsShieldCheck
                className={cn("h-4 w-4 text-zinc-400")}
              />
              <SectionTitle className="mb-0">Two-Factor Authentication</SectionTitle>
            </div>

            <p className={cn("mb-4 text-xs text-zinc-500")}>
              Add an extra layer of security to your account by requiring a second form of
              verification.
            </p>

            {!showTotpSetup ? (
              <div
                className={cn(
                  "flex items-center justify-between border p-4 border-zinc-700/50 bg-zinc-900/30",
                )}
              >
                <div>
                  <div
                    className={cn(
                      "text-sm font-medium text-zinc-200",
                    )}
                  >
                    Authenticator App
                  </div>
                  <div className={cn("mt-1 text-xs text-zinc-500")}>
                    {twoFactorEnabled
                      ? "Two-factor authentication is enabled"
                      : "Use an app like Google Authenticator or Authy"}
                  </div>
                </div>
                {twoFactorEnabled ? (
                  <TextureButton
                    variant="destructive"
                    onClick={() => setDisableTwoFactorModalOpen(true)}
                  >
                    <span className="text-xs tracking-wider uppercase">Disable</span>
                  </TextureButton>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="Password"
                      value={passwordForAction}
                      onChange={(e) => setPasswordForAction(e.target.value)}
                      className={cn(
                        "h-8 w-40 text-sm border-zinc-700 bg-zinc-900 text-zinc-100",
                      )}
                    />
                    <TextureButton
                      variant="minimal"
                      onClick={handleEnableTwoFactor}
                      disabled={!passwordForAction}
                    >
                      <span className="text-xs tracking-wider uppercase">Enable</span>
                    </TextureButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className={cn(
                    "border p-4 border-zinc-700/50 bg-zinc-900/30",
                  )}
                >
                  <p className={cn("mb-4 text-sm text-zinc-300")}>
                    Scan this QR code with your authenticator app:
                  </p>
                  {totpQrCode && (
                    <div className="mb-4 flex justify-center">
                      <img src={totpQrCode} alt="TOTP QR Code" className="h-48 w-48" />
                    </div>
                  )}
                  <p className={cn("mb-2 text-xs text-zinc-500")}>
                    Or enter this code manually:
                  </p>
                  <code
                    className={cn(
                      "block p-2 text-xs break-all bg-zinc-800 text-zinc-300",
                    )}
                  >
                    {totpUri?.split("secret=")[1]?.split("&")[0] || ""}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    maxLength={6}
                    className={cn(
                      "h-8 w-40 text-sm border-zinc-700 bg-zinc-900 text-zinc-100",
                    )}
                  />
                  <TextureButton
                    variant="minimal"
                    onClick={handleVerifyTotp}
                    disabled={verifyCode.length !== 6}
                  >
                    <span className="text-xs tracking-wider uppercase">Verify</span>
                  </TextureButton>
                  <TextureButton
                    variant="minimal"
                    onClick={() => {
                      setShowTotpSetup(false);
                      setTotpUri(null);
                      setTotpQrCode(null);
                      setVerifyCode("");
                      setPasswordForAction("");
                    }}
                  >
                    <span className="text-xs tracking-wider uppercase">Cancel</span>
                  </TextureButton>
                </div>
              </div>
            )}
          </Card>
        </Card>
      </Card>

      {/* Backup Codes Modal */}
      <FormModal
        open={showBackupCodes}
        onOpenChange={setShowBackupCodes}
        title="Backup Codes"
        description="Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device."
        onSubmit={() => {
          setShowBackupCodes(false);
          setBackupCodes([]);
        }}
        submitLabel="I've saved these codes"
        isValid={true}
      >
        <div className="space-y-2">
          {backupCodes.map((code, index) => (
            <div
              key={index}
              className={cn(
                "p-2 text-center font-mono text-sm bg-zinc-800 text-zinc-300",
              )}
            >
              {code}
            </div>
          ))}
        </div>
      </FormModal>

      {/* Add Passkey Modal */}
      <FormModal
        open={addPasskeyModalOpen}
        onOpenChange={setAddPasskeyModalOpen}
        title="Add Passkey"
        description="Register a new passkey for passwordless authentication."
        onSubmit={handleAddPasskey}
        submitLabel="Add Passkey"
        isValid={newPasskeyName.trim().length >= 3}
      >
        <div className="space-y-4">
          <div>
            <label
              className={cn(
                "mb-2 block text-xs tracking-wider uppercase text-zinc-400",
              )}
            >
              Passkey Name
            </label>
            <Input
              value={newPasskeyName}
              onChange={(e) => setNewPasskeyName(e.target.value)}
              placeholder="e.g., MacBook Pro - Touch ID"
              className={cn(
                "transition-all border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600",
              )}
            />
            <p className={cn("mt-1 text-xs text-zinc-500")}>
              Enter a name to identify this passkey
            </p>
          </div>
        </div>
      </FormModal>

      {/* Delete Passkey Modal */}
      <ConfirmationModal
        open={deletePasskeyModalOpen}
        onOpenChange={setDeletePasskeyModalOpen}
        title="Delete Passkey"
        description={`Are you sure you want to delete "${selectedPasskey?.name || "this passkey"}"? You will no longer be able to sign in using this passkey.`}
        onConfirm={handleDeletePasskey}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Disable 2FA Modal */}
      <FormModal
        open={disableTwoFactorModalOpen}
        onOpenChange={setDisableTwoFactorModalOpen}
        title="Disable Two-Factor Authentication"
        description="Enter your password to disable two-factor authentication. This will make your account less secure."
        onSubmit={handleDisableTwoFactor}
        submitLabel="Disable 2FA"
        isValid={passwordForAction.length > 0}
      >
        <div className="space-y-4">
          <div>
            <label
              className={cn(
                "mb-2 block text-xs tracking-wider uppercase text-zinc-400",
              )}
            >
              Password
            </label>
            <Input
              type="password"
              value={passwordForAction}
              onChange={(e) => setPasswordForAction(e.target.value)}
              placeholder="Enter your password"
              className={cn(
                "transition-all border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600",
              )}
            />
          </div>
        </div>
      </FormModal>
    </Card>
  );
};

export default AccountPage;
