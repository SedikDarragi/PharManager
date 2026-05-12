/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-navy': '#0A0F1E',
        'electric-teal': '#00D4AA',
        'soft-white': '#E0E0E0',
        'navy-accent': '#1E3A5F',
      }
    },
  },
  plugins: [],
}