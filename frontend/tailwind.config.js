/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        phosphor: '#39ff14',
        amber: '#ffbf00',
        neonred: '#ff073a',
      },
    },
  },
  plugins: [],
};
