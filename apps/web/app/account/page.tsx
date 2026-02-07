"use client";

import { type JSX, useEffect, useState } from "react";
import { cn } from "@stellarUI/lib/utils";
import { FadeIn } from "@stellarUI/components/FadeIn/FadeIn";
import { TextureButton } from "@stellarUI/components/TextureButton";
import { SidebarTrigger } from "@stellarUI/components/Sidebar/Sidebar";
import ConfirmationModal from "@stellarUI/components/ConfirmationModal/ConfirmationModal";
import FormModal from "@stellarUI/components/FormModal/FormModal";
import Input from "@stellarUI/components/Input/Input";
import Label from "@stellarUI/components/Label/Label";
import {
  BsCheckCircle,
  BsDiscord,
  BsGithub,
  BsGoogle,
  BsKey,
  BsPlus,
  BsShieldCheck,
  BsTrash,
  BsPerson,
  BsLink45Deg,
  BsPalette,
} from "react-icons/bs";
import ThemeSelector from "@/components/ThemeSelector/ThemeSelector";
import { authClient, useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";

interface Passkey {
  id: string;
  name: string | null;
  createdAt: Date;
  credentialId: string;
}

/**
 * Safely extract error message from unknown error types
 */
const GetErrorMessage = (error: Error | unknown, defaultMessage: string = "An error occurred"): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return defaultMessage;
};

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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, "Failed to enable 2FA"));
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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, "Invalid verification code"));
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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, "Failed to disable 2FA"));
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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, "Failed to add passkey"));
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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, "Failed to delete passkey"));
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
    } catch (error: Error | unknown) {
      toast.error(GetErrorMessage(error, `Failed to connect ${provider}`));
    }
  };

  return (
    <FadeIn className="flex min-h-[calc(100svh-1rem)] w-full flex-col">
      <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col transition-colors">
        <div className="relative flex min-h-[calc(100svh-1rem)] w-full flex-col rounded-lg bg-black px-4 pb-4">
          {/* Header */}
          <FadeIn delay={0}>
            <div className="mb-6 flex items-center justify-between">
              <SidebarTrigger className="text-zinc-400 transition-all hover:scale-110 hover:text-zinc-100 active:scale-95" />
            </div>
          </FadeIn>

          {/* Account Settings Content */}
          <FadeIn delay={0.05}>
            <div className="flex h-full flex-col rounded-lg border border-white/5 bg-[#090909] p-1 pt-2">
              <div className="flex shrink-0 items-center justify-between pr-2 pb-2 pl-2">
                <div className="flex items-center gap-2 text-xs opacity-50">
                  <BsPerson className="h-3 w-3" />
                  Account Settings
                </div>
              </div>
              <div className="flex flex-1 flex-col rounded-lg border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-6 shadow-lg shadow-black/20">
                {/* Profile Section */}
                <FadeIn delay={0.1}>
                  <div className="mb-8">
                    <div className="mb-4 flex items-center gap-2">
                      <BsPerson className="h-4 w-4 text-zinc-400" />
                      <h2 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                        Profile
                      </h2>
                    </div>

                    <div className="space-y-4 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                      <div>
                        <Label>Full Name</Label>
                        <Input
                          type="text"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((prev) => ({ ...prev, name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Email Address</Label>
                        <Input type="email" value={profile.email} disabled />
                        <p className="mt-1 text-xs text-zinc-500">
                          Email changes are not yet supported
                        </p>
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input type="password" value="********" disabled />
                      </div>
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={handleSaveProfile}
                        disabled={!hasProfileChanges}
                      >
                        {saved ? (
                          <>
                            <BsCheckCircle className="h-4 w-4" />
                            Saved
                          </>
                        ) : (
                          "Update Profile"
                        )}
                      </TextureButton>
                    </div>
                  </div>
                </FadeIn>

                {/* Appearance Section */}
                <FadeIn delay={0.12}>
                  <div className="mb-8">
                    <div className="mb-4 flex items-center gap-2">
                      <BsPalette className="h-4 w-4 text-zinc-400" />
                      <h2 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                        Appearance
                      </h2>
                    </div>

                    <div className="space-y-4 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                      <div>
                        <Label>Theme</Label>
                        <p className="mb-2 text-xs text-zinc-500">
                          Choose a color theme for the interface
                        </p>
                        <ThemeSelector className="max-w-xs" />
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* Connected Accounts Section */}
                <FadeIn delay={0.17}>
                  <div className="mb-8">
                    <div className="mb-4 flex items-center gap-2">
                      <BsLink45Deg className="h-4 w-4 text-zinc-400" />
                      <h2 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                        Connected Accounts
                      </h2>
                    </div>

                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                      <p className="mb-4 text-xs text-zinc-500">
                        Connect your social accounts for quick sign-in.
                      </p>

                      <div className="flex flex-wrap gap-3">
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleSocialSignIn("google")}
                        >
                          <BsGoogle className="h-4 w-4" />
                          Google
                        </TextureButton>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleSocialSignIn("github")}
                        >
                          <BsGithub className="h-4 w-4" />
                          GitHub
                        </TextureButton>
                        <TextureButton
                          variant="minimal"
                          size="sm"
                          className="w-fit"
                          onClick={() => handleSocialSignIn("discord")}
                        >
                          <BsDiscord className="h-4 w-4" />
                          Discord
                        </TextureButton>
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* Passkeys Section */}
                <FadeIn delay={0.22}>
                  <div className="mb-8">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BsKey className="h-4 w-4 text-zinc-400" />
                        <h2 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                          Passkeys
                        </h2>
                      </div>
                      <TextureButton
                        variant="minimal"
                        size="sm"
                        className="w-fit"
                        onClick={() => setAddPasskeyModalOpen(true)}
                      >
                        <BsPlus className="h-4 w-4" />
                        Add Passkey
                      </TextureButton>
                    </div>

                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                      <p className="mb-4 text-xs text-zinc-500">
                        Passkeys provide a more secure and convenient way to sign in without
                        passwords.
                      </p>

                      <div className="space-y-3">
                        {passkeys.length === 0 ? (
                          <p className="text-sm text-zinc-500">No passkeys registered yet.</p>
                        ) : (
                          passkeys.map((passkey) => (
                            <div
                              key={passkey.id}
                              className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4"
                            >
                              <div>
                                <div className="text-sm font-medium text-zinc-200">
                                  {passkey.name || "Unnamed Passkey"}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">
                                  Added {new Date(passkey.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <TextureButton
                                variant="secondary"
                                size="sm"
                                className="w-fit text-red-400 hover:text-red-300"
                                onClick={() => openDeletePasskeyModal(passkey)}
                              >
                                <BsTrash className="h-4 w-4" />
                              </TextureButton>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </FadeIn>

                {/* Two-Factor Authentication Section */}
                <FadeIn delay={0.27}>
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <BsShieldCheck className="h-4 w-4 text-zinc-400" />
                      <h2 className="text-sm font-medium tracking-wider text-zinc-100 uppercase">
                        Two-Factor Authentication
                      </h2>
                    </div>

                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-4">
                      <p className="mb-4 text-xs text-zinc-500">
                        Add an extra layer of security to your account by requiring a second form of
                        verification.
                      </p>

                      {!showTotpSetup ? (
                        <div className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4">
                          <div>
                            <div className="text-sm font-medium text-zinc-200">
                              Authenticator App
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {twoFactorEnabled
                                ? "Two-factor authentication is enabled"
                                : "Use an app like Google Authenticator or Authy"}
                            </div>
                          </div>
                          {twoFactorEnabled ? (
                            <TextureButton
                              variant="secondary"
                              size="sm"
                              className="w-fit text-red-400 hover:text-red-300"
                              onClick={() => setDisableTwoFactorModalOpen(true)}
                            >
                              Disable
                            </TextureButton>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="password"
                                placeholder="Password"
                                value={passwordForAction}
                                onChange={(e) => setPasswordForAction(e.target.value)}
                                className="w-40"
                              />
                              <TextureButton
                                variant="minimal"
                                size="sm"
                                className="w-fit"
                                onClick={handleEnableTwoFactor}
                                disabled={!passwordForAction}
                              >
                                Enable
                              </TextureButton>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-4">
                            <p className="mb-4 text-sm text-zinc-300">
                              Scan this QR code with your authenticator app:
                            </p>
                            {totpQrCode && (
                              <div className="mb-4 flex justify-center">
                                <img
                                  src={totpQrCode}
                                  alt="TOTP QR Code"
                                  className="h-48 w-48 rounded-lg"
                                />
                              </div>
                            )}
                            <p className="mb-2 text-xs text-zinc-500">
                              Or enter this code manually:
                            </p>
                            <code className="block rounded bg-zinc-800 p-2 text-xs break-all text-zinc-300">
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
                              className="w-40"
                            />
                            <TextureButton
                              variant="minimal"
                              size="sm"
                              className="w-fit"
                              onClick={handleVerifyTotp}
                              disabled={verifyCode.length !== 6}
                            >
                              Verify
                            </TextureButton>
                            <TextureButton
                              variant="secondary"
                              size="sm"
                              className="w-fit"
                              onClick={() => {
                                setShowTotpSetup(false);
                                setTotpUri(null);
                                setTotpQrCode(null);
                                setVerifyCode("");
                                setPasswordForAction("");
                              }}
                            >
                              Cancel
                            </TextureButton>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </FadeIn>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

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
              className="rounded bg-zinc-800 p-2 text-center font-mono text-sm text-zinc-300"
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
            <Label>Passkey Name</Label>
            <Input
              value={newPasskeyName}
              onChange={(e) => setNewPasskeyName(e.target.value)}
              placeholder="e.g., MacBook Pro - Touch ID"
            />
            <p className="mt-1 text-xs text-zinc-500">Enter a name to identify this passkey</p>
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
            <Label>Password</Label>
            <Input
              type="password"
              value={passwordForAction}
              onChange={(e) => setPasswordForAction(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
        </div>
      </FormModal>
    </FadeIn>
  );
};

export default AccountPage;
