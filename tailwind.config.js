/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2430",
        parchment: "#EDE6D6",
        parchment2: "#E4DBC6",
        teal: "#1F6F63",
        tealdark: "#164F46",
        amber: "#C98A2C",
        rust: "#B5502E",
        rule: "#C9BFA8",
        slate: "#5B6472",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
}
