"use client";

import { type JSX, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/Utils";
import { TextureButton } from "@stellarUI/components/TextureButton";
import Input from "@stellarUI/components/Input/Input";
import { BsArrowLeft, BsShieldCheck } from "react-icons/bs";
import { authClient } from "@/lib/AuthClient";
import { toast } from "sonner";
import Label from "@stellarUI/components/Label/Label";

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
    } catch (_err: unknown) {
      toast.error((_err as Error)?.message || "Invalid verification code");
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
    <div
      className={cn(
        "relative flex min-h-svh items-center justify-center bg-[#0b0b0a] transition-colors"
      )}
    >
      <div className="relative w-full p-8">
        <div
          className={cn(
            "relative border border-zinc-200/10 bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] p-8"
          )}
        >
          <div className={cn("absolute top-0 left-0 h-2 w-2 border-t border-l border-zinc-500")} />
          <div className={cn("absolute top-0 right-0 h-2 w-2 border-t border-r border-zinc-500")} />
          <div
            className={cn("absolute bottom-0 left-0 h-2 w-2 border-b border-l border-zinc-500")}
          />
          <div
            className={cn("absolute right-0 bottom-0 h-2 w-2 border-r border-b border-zinc-500")}
          />

          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className={cn(
                "mb-4 flex h-16 w-16 items-center justify-center border border-zinc-700 bg-zinc-900"
              )}
            >
              <BsShieldCheck className={cn("h-8 w-8 text-zinc-400")} />
            </div>
            <h1 className={cn("text-xl font-light tracking-wider text-zinc-100")}>
              TWO-FACTOR AUTHENTICATION
            </h1>
            <p className={cn("mt-2 text-sm text-zinc-500")}>
              {useBackupCode
                ? "Enter one of your backup codes to continue"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <Label>{useBackupCode ? "Backup Code" : "Verification Code"}</Label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                onKeyDown={handleKeyDown}
                placeholder={useBackupCode ? "Enter backup code" : "000000"}
                maxLength={useBackupCode ? 20 : 6}
                autoFocus
                className={cn(
                  "mt-2 border-zinc-700/50 bg-zinc-900/50 text-center font-mono text-2xl tracking-[0.5em] text-zinc-200 focus:border-zinc-500"
                )}
              />
            </div>

            <TextureButton onClick={handleVerify} disabled={code.length < 6 || isSubmitting}>
              <span className="text-xs tracking-wider uppercase">
                {isSubmitting ? "Verifying..." : "Verify"}
              </span>
            </TextureButton>

            <div className="flex flex-col items-center gap-4">
              <TextureButton
                variant="minimal"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode("");
                }}
              >
                {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
              </TextureButton>

              <TextureButton variant="minimal" onClick={() => router.back()}>
                <BsArrowLeft className="h-3 w-3" />
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
