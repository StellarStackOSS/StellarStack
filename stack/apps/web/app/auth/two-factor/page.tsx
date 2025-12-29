"use client";

import { useState, useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useTheme as useNextTheme } from "next-themes";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { AnimatedBackground } from "@workspace/ui/components/shared/AnimatedBackground";
import { FloatingDots } from "@workspace/ui/components/shared/Animations";
import { BsShieldCheck, BsArrowLeft } from "react-icons/bs";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const TwoFactorPage = (): JSX.Element | null => {
  const router = useRouter();
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

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
      "min-h-svh flex items-center justify-center transition-colors relative",
      isDark ? "bg-[#0b0b0a]" : "bg-[#f5f5f4]"
    )}>
      <AnimatedBackground isDark={isDark} />
      <FloatingDots isDark={isDark} count={15} />

      <div className="relative w-full max-w-md p-8">
        <div className={cn(
          "relative p-8 border",
          isDark
            ? "bg-gradient-to-b from-[#141414] via-[#0f0f0f] to-[#0a0a0a] border-zinc-200/10"
            : "bg-gradient-to-b from-white via-zinc-50 to-zinc-100 border-zinc-300"
        )}>
          <div className={cn("absolute top-0 left-0 w-2 h-2 border-t border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
          <div className={cn("absolute top-0 right-0 w-2 h-2 border-t border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />
          <div className={cn("absolute bottom-0 left-0 w-2 h-2 border-b border-l", isDark ? "border-zinc-500" : "border-zinc-400")} />
          <div className={cn("absolute bottom-0 right-0 w-2 h-2 border-b border-r", isDark ? "border-zinc-500" : "border-zinc-400")} />

          <div className="flex flex-col items-center text-center mb-8">
            <div className={cn(
              "w-16 h-16 flex items-center justify-center mb-4 border",
              isDark ? "bg-zinc-900 border-zinc-700" : "bg-zinc-100 border-zinc-300"
            )}>
              <BsShieldCheck className={cn("w-8 h-8", isDark ? "text-zinc-400" : "text-zinc-600")} />
            </div>
            <h1 className={cn(
              "text-xl font-light tracking-wider",
              isDark ? "text-zinc-100" : "text-zinc-800"
            )}>
              TWO-FACTOR AUTHENTICATION
            </h1>
            <p className={cn(
              "text-sm mt-2",
              isDark ? "text-zinc-500" : "text-zinc-500"
            )}>
              {useBackupCode
                ? "Enter one of your backup codes to continue"
                : "Enter the 6-digit code from your authenticator app"}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                isDark ? "text-zinc-500" : "text-zinc-400"
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
                  "mt-2 text-center text-2xl tracking-[0.5em] font-mono",
                  isDark
                    ? "bg-zinc-900/50 border-zinc-700/50 text-zinc-200 focus:border-zinc-500"
                    : "bg-white border-zinc-300 text-zinc-800 focus:border-zinc-400"
                )}
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={code.length < 6 || isSubmitting}
              className={cn(
                "w-full transition-all",
                isDark
                  ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                  : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
              )}
            >
              <span className="text-xs uppercase tracking-wider">
                {isSubmitting ? "Verifying..." : "Verify"}
              </span>
            </Button>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode("");
                }}
                className={cn(
                  "text-xs uppercase tracking-wider transition-colors",
                  isDark
                    ? "text-zinc-500 hover:text-zinc-300"
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
              </button>

              <button
                onClick={() => router.back()}
                className={cn(
                  "flex items-center gap-2 text-xs uppercase tracking-wider transition-colors",
                  isDark
                    ? "text-zinc-500 hover:text-zinc-300"
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <BsArrowLeft className="w-3 h-3" />
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorPage;
