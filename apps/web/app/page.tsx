"use client";

import { type JSX, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@stellarUI/lib/utils";
import { signIn } from "@/lib/auth-client";
import { useAuth } from "hooks/auth-provider";
import { toast } from "sonner";
import LoginForm from "@/components/LoginForm/LoginForm";

const LoginPage = (): JSX.Element | null => {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div
      className={cn(
        "relative flex min-h-svh items-center justify-center bg-[#0b0b0a] transition-colors"
      )}
    >
      <LoginForm handleLogin={handleLogin} isLoading={isLoading} error={error} />
    </div>
  );
};

export default LoginPage;
