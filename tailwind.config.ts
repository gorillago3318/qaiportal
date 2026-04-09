import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0A1628",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#C9A84C",
          foreground: "#0A1628",
        },
        background: "#F8F9FA",
        surface: "#FFFFFF",
        border: "#E5E7EB",
        muted: {
          DEFAULT: "#F3F4F6",
          foreground: "#6B7280",
        },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        // Navy shades
        navy: {
          50: "#EEF1F7",
          100: "#D4DCE9",
          200: "#A9B9D3",
          300: "#7E96BC",
          400: "#5373A6",
          500: "#285090",
          600: "#1E3C6B",
          700: "#142847",
          800: "#0A1628",
          900: "#050B14",
          DEFAULT: "#0A1628",
        },
        gold: {
          50: "#FDF9EE",
          100: "#F8EFCC",
          200: "#F0DC99",
          300: "#E8C866",
          400: "#C9A84C",
          500: "#B8912A",
          600: "#9A7820",
          700: "#7B5F16",
          800: "#5D470C",
          900: "#3E2F08",
          DEFAULT: "#C9A84C",
        },
        // Status colors
        status: {
          draft: "#6B7280",
          submitted: "#3B82F6",
          bank_processing: "#6366F1",
          kiv: "#F59E0B",
          approved: "#10B981",
          declined: "#EF4444",
          accepted: "#059669",
          rejected: "#F43F5E",
          payment_pending: "#F97316",
          paid: "#14B8A6",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        heading: ["Playfair Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(10, 22, 40, 0.08), 0 1px 2px -1px rgba(10, 22, 40, 0.04)",
        "card-hover":
          "0 4px 6px -1px rgba(10, 22, 40, 0.1), 0 2px 4px -2px rgba(10, 22, 40, 0.06)",
        premium:
          "0 10px 25px -5px rgba(10, 22, 40, 0.15), 0 8px 10px -6px rgba(10, 22, 40, 0.1)",
        glow: "0 0 20px rgba(201, 168, 76, 0.25)",
        "inner-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        xs: "0.25rem",
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "sidebar": "16rem",
        "sidebar-collapsed": "4.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-left": "slideInLeft 0.3s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
