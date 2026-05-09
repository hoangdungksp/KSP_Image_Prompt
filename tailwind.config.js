/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        ksp: {
          bg: "#0f0f10",
          panel: "#18181a",
          border: "#27272a",
          text: "#e4e4e7",
          muted: "#71717a",
          accent: "#a78bfa",
          good: "#34d399",
          bad: "#f87171",
        },
      },
    },
  },
  plugins: [],
};
