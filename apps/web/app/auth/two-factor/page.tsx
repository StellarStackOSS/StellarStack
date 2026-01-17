"use client";

import { useState, useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import {TextureButton} from "@workspace/ui/components/texture-button";
import { Input } from "@workspace/ui/components/input";
import { AnimatedBackground } from "@workspace/ui/components/animated-background";
import { FloatingDots } from "@workspace/ui/components/floating-particles";
import { BsShieldCheck, BsArrowLeft } from "react-icons/bs";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const TwoFactorPage = (): JSX.Element | null => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async () => {
    if (code.length < 6) {
      toast.error("Please enter a valid code");
      return;
    }

    setIsSubmitting(true);
    try {
      if (useBackupCode) {
        const response = await authClient.twoFactor.verifyBackupCode({
          code,
        });
        if (response.data) {
          router.push("/servers");
        }
      } else {
        const response = await authClient.twoFactor.verifyTotp({
          code,
          trustDevice: true,
        });
        if (response.data) {
          router.push("/servers");
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Invalid verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <div className={cn(
      "min-h-svh flex items-center justify-center transition-colors relative bg-[#0b0b0a]",
    )}>
      <AnimatedBackground />
      <FloatingDots count={15} />

      <div className="relative w-full max-w-md p-8">
        <div className={cn(
          "relative p-8 border bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10",
        )}>
          <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-500")} />
          <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-500")} />
          <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-500")} />
          <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-500")} />

          <div className="flex flex-col items-center text-center mb-8">
            <div className={cn(
              "w-16 h-16 flex items-center justify-center mb-4 border bg-zinc-900 border-zinc-700",
            )}>
              <BsShieldCheck className={cn("w-8 h-8 text-zinc-400")} />
            </div>
            <h1 className={cn(
              "text-xl font-light tracking-wider text-zinc-100",
            )}>
              TWO-FACTOR AUTHENTICATION
            </h1>
            <p className={cn(
              "text-sm mt-2 text-zinc-500",
            )}>
              {useBackupCode
                ? "Enter one of your backup codes to continue"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className={cn(
                "text-[10px] font-medium uppercase tracking-wider text-zinc-500",
              )}>
                {useBackupCode ? "Backup Code" : "Verification Code"}
              </label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                onKeyDown={handleKeyDown}
                placeholder={useBackupCode ? "Enter backup code" : "000000"}
                maxLength={useBackupCode ? 20 : 6}
                autoFocus
                className={cn(
                  "mt-2 text-center text-2xl tracking-[0.5em] font-mono bg-zinc-900/50 border-zinc-700/50 text-zinc-200 focus:border-zinc-500",
                )}
              />
            </div>

            <TextureButton
              onClick={handleVerify}
              disabled={code.length < 6 || isSubmitting}
            >
              <span className="text-xs uppercase tracking-wider">
                {isSubmitting ? "Verifying..." : "Verify"}
              </span>
            </TextureButton>

            <div className="flex flex-col items-center gap-4">
              <TextureButton variant="minimal"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode("");
                }}
              >
                {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
              </TextureButton>

              <TextureButton variant="minimal"
                onClick={() => router.back()}
              >
                <BsArrowLeft className="w-3 h-3" />
                Back to login
              </TextureButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorPage;
