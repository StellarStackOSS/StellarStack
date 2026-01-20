"use client";

import { Turnstile as TurnstileWidget } from "@marsidev/react-turnstile";
import { useEffect, useState } from "react";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function Turnstile({ onVerify, onError, onExpire }: TurnstileProps) {
  const [siteKey, setSiteKey] = useState<string | null>(null);

  useEffect(() => {
    // Get the site key from environment variables
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    setSiteKey(key || null);
  }, []);

  // If no site key is configured, don't render the CAPTCHA
  if (!siteKey) {
    return null;
  }

  return (
    <div className="my-4 flex justify-center">
      <TurnstileWidget
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={onError}
        onExpire={onExpire}
        options={{
          theme: "dark",
          size: "normal",
        }}
      />
    </div>
  );
}
