import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { getApiUrl } from "@/lib/public-env";

const API_URL = typeof window !== "undefined" ? getApiUrl() : "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/auth/two-factor";
      },
    }),
    passkeyClient(),
  ],
});

export const { signIn, signOut, useSession } = authClient;
