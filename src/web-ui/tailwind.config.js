/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(0 0% 90%)",
        input: "hsl(0 0% 90%)",
        ring: "hsl(235 69% 61%)",
        background: "hsl(0 0% 98%)",
        foreground: "hsl(0 0% 9%)",
        primary: {
          DEFAULT: "hsl(235 69% 61%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(0 0% 96%)",
          foreground: "hsl(0 0% 32%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84% 60%)",
          foreground: "hsl(0 0% 100%)",
        },
        muted: {
          DEFAULT: "hsl(0 0% 96%)",
          foreground: "hsl(0 0% 46%)",
        },
        accent: {
          DEFAULT: "hsl(0 0% 96%)",
          foreground: "hsl(0 0% 9%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(0 0% 9%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(0 0% 9%)",
        },
        sidebar: {
          DEFAULT: "hsl(0 0% 98%)",
          foreground: "hsl(0 0% 9%)",
          border: "hsl(0 0% 92%)",
        },
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs': ['11px', '16px'],
        'sm': ['12px', '18px'],
        'base': ['13px', '20px'],
        'lg': ['15px', '22px'],
        'xl': ['17px', '24px'],
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
