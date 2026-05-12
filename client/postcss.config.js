export default {
  plugins: {
    'postcss-import': {}, // Ensure postcss-import runs first
    tailwindcss: {}, // Use the main tailwindcss plugin for v3
    autoprefixer: {},
  },
};