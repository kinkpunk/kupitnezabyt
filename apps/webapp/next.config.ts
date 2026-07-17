import type { NextConfig } from "next";

validateBuildEnv();

// NEXT_PUBLIC_API_BASE_URL is embedded into the bundle at build time. A Vercel
// build without it silently falls back to http://localhost:3001 and ships an
// app that cannot reach the API, so fail fast instead.
function validateBuildEnv(): void {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv) {
    if (!apiBaseUrl) {
      throw new Error(
        `[webapp] NEXT_PUBLIC_API_BASE_URL is not set for the Vercel "${vercelEnv}" environment. ` +
          "Add it in Vercel → Project Settings → Environment Variables " +
          "(for example, https://kupitnezabyt-api.onrender.com) and redeploy. " +
          "Without it the app falls back to http://localhost:3001 and cannot reach the API."
      );
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/.test(apiBaseUrl)) {
      throw new Error(
        `[webapp] NEXT_PUBLIC_API_BASE_URL="${apiBaseUrl}" points to a local address ` +
          `in the Vercel "${vercelEnv}" environment. Deployed users' browsers cannot reach it; ` +
          "set the public API URL instead."
      );
    }
    return;
  }

  if (process.env.NODE_ENV === "production" && !apiBaseUrl) {
    console.warn(
      "[webapp] NEXT_PUBLIC_API_BASE_URL is not set; the bundle will fall back to http://localhost:3001. " +
        "Do not deploy this build outside local development."
    );
  }
}

const nextConfig: NextConfig = {
  typedRoutes: true
};

export default nextConfig;
