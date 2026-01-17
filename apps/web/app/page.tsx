"use client";

import {type JSX, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useTheme as useNextTheme} from "next-themes";
import {cn} from "@workspace/ui/lib/utils";
import {AnimatedBackground} from "@workspace/ui/components/animated-background";
import {FloatingDots} from "@workspace/ui/components/floating-particles";
import {signIn} from "@/lib/auth-client";
import {useAuth} from "hooks/auth-provider";
import {setup} from "@/lib/api";
import {toast} from "sonner";
import {Spinner} from "@workspace/ui/components";
import LoginForm from "@/components/LoginForm/LoginForm";

const LoginPage = (): JSX.Element | null => {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if system needs setup
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await setup.status();
        if (!status.initialized) {
          // No users exist, redirect to setup
          router.push("/setup");
          return;
        }
      } catch {
        // If check fails, continue to login
      } finally {
        setCheckingSetup(false);
      }
    };
    checkStatus();
  }, [router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push("/servers");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleLogin = async (values: { email: string; password: string; captchaToken: string }) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.email({
        email: values.email,
        password: values.password,
      });

      if (result.error) {
        const message = result.error.message || "Invalid email or password";
        setError(message);
        toast.error(message);
      } else {
        toast.success("Signed in successfully");
        router.push("/servers");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div
        className={cn(
          "relative flex min-h-svh items-center justify-center transition-colors bg-[#0b0b0a]",
        )}
      >
        <AnimatedBackground />
        <FloatingDots count={15} />
        <div
          className={cn(
            "text-sm tracking-wider uppercase text-zinc-500",
          )}
        >
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-svh items-center justify-center transition-colors bg-[#0b0b0a]",
      )}
    >
      <AnimatedBackground />
      <FloatingDots count={15} />

      <LoginForm handleLogin={handleLogin} isLoading={isLoading} error={error} />
    </div>
  );
};

export default LoginPage;
