/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        asphalt: {
          DEFAULT: '#0B0D10',
          800: '#12151A',
          700: '#181C22',
          600: '#222730',
          500: '#2E343F',
        },
        sodium: '#FFB347',
        regulatory: '#E0322B',
        permit: '#1FA463',
        signwhite: '#F4F1EA',
        paid: '#5AA9FF',
        permitzone: '#B48CFF',
      },
      fontFamily: {
        sign: ['Overpass', '"Arial Narrow"', 'Arial', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 10px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        sodium: '0 0 40px -6px rgba(255,179,71,0.55)',
      },
    },
  },
  plugins: [],
};
