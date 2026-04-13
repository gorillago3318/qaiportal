import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Suppress known Turbopack CSS resolution warning for tailwindcss
    // See: https://github.com/vercel/next.js/issues/87898
    ignoreIssue: [
      {
        path: "**/globals.css",
        title: /Can't resolve/,
      },
      {
        path: "**/tailwind.config.*",
        title: /Module not found/,
      },
    ],
  },
};

export default nextConfig;
