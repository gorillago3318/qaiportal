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
          DEFAULT: "#1D1D1F",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#0066CC",
          foreground: "#FFFFFF",
        },
        background: "#F5F5F7",
        surface: "#FFFFFF",
        border: "#D2D2D7",
        muted: {
          DEFAULT: "#F5F5F7",
          foreground: "#86868B",
        },
        success: "#34C759",
        warning: "#FF9F0A",
        error: "#FF3B30",
        // Navy substituted to dark grays so old classes don't break immediately
        navy: {
          50: "#F5F5F7",
          100: "#E8E8ED",
          200: "#D2D2D7",
          300: "#86868B",
          400: "#515154",
          500: "#1D1D1F",
          600: "#000000",
          700: "#000000",
          800: "#000000",
          900: "#000000",
          DEFAULT: "#1D1D1F",
        },
        gold: {
          50: "#F0F8FF",
          100: "#E0F0FF",
          200: "#B3D9FF",
          300: "#80BFFF",
          400: "#4D99FF",
          500: "#0066CC",
          600: "#0052A3",
          700: "#003D7A",
          800: "#002952",
          900: "#001429",
          DEFAULT: "#0066CC",
        },
        // Status colors
        status: {
          draft: "#86868B",
          submitted: "#0066CC",
          bank_processing: "#5856D6",
          kiv: "#FF9F0A",
          approved: "#34C759",
          declined: "#FF3B30",
          accepted: "#248A3D",
          rejected: "#FF3B30",
          payment_pending: "#FF9F0A",
          paid: "#34C759",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Inter", "system-ui", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)",
        "card-hover":
          "0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)",
        premium:
          "0 20px 40px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08)",
        glow: "0 0 24px rgba(59, 130, 246, 0.3)",
        "inner-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        xs: "0.25rem",
        sm: "0.5rem",
        DEFAULT: "0.75rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "sidebar": "17rem",
        "sidebar-collapsed": "5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-left": "slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
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
