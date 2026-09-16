/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Тёплая пастельная шкала «песок» — единственный акцентный оттенок.
        // Никаких контрастных teal/синих: только тёплые пастельные тона.
        sand: {
          50: '#FAF7F1',
          100: '#F3EDE2',
          200: '#E8DDCB',
          300: '#DAC9AE',
          400: '#C9B294',
          500: '#B49C7D',
          600: '#9A8266',
          700: '#7D6952',
          800: '#575046',
          900: '#35302A',
          950: '#211E1A',
        },
        surface: {
          light: 'rgba(250, 247, 241, 0.72)',
          dark: 'rgba(33, 30, 26, 0.72)',
        },
      },
      fontFamily: {
        // 7. Типографика: все шрифты с кириллицей + латиницей,
        // гротески без вязи, нейтральные и легкочитаемые.
        // display — Manrope (заголовки / навигация),
        // sans — Onest (основной текст / интерфейс),
        // mono — JetBrains Mono (код / мета).
        display: ['Manrope', 'Onest', 'system-ui', 'sans-serif'],
        sans: ['Onest', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        '4xl': '2rem',
        // 5. Закругления: кнопки и карточки заметно круглее обычного.
        pill: '999px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(87, 80, 70, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.55)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'card-soft': '0 2px 12px rgba(87, 80, 70, 0.08)',
        'notch': '0 12px 40px rgba(87, 80, 70, 0.14)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-down': 'slideDown 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        // 3. Переключение страниц: отдаление с размытием и обратное появление.
        'page-enter': 'pageEnter 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'page-exit': 'pageExit 0.22s ease-in both',
        // 3. Меню: плавное расширение / сжатие.
        'notch-expand': 'notchExpand 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'notch-collapse': 'notchCollapse 0.3s ease-in both',
        // 8. Анимация создания папки из заметок.
        'folder-pop': 'folderPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'drop-glow': 'dropGlow 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pageEnter: {
          '0%': { transform: 'scale(0.94)', opacity: '0', filter: 'blur(14px)' },
          '60%': { transform: 'scale(1.005)', opacity: '1', filter: 'blur(0px)' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'blur(0px)' },
        },
        pageExit: {
          '0%': { transform: 'scale(1)', opacity: '1', filter: 'blur(0px)' },
          '100%': { transform: 'scale(0.96)', opacity: '0', filter: 'blur(10px)' },
        },
        notchExpand: {
          '0%': { transform: 'scaleX(0.96)', opacity: '0.6' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
        notchCollapse: {
          '0%': { transform: 'scaleX(1)', opacity: '1' },
          '100%': { transform: 'scaleX(0.96)', opacity: '0.6' },
        },
        folderPop: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '60%': { transform: 'scale(1.06)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        dropGlow: {
          '0%, 100%': { boxShadow: '0 0 0 2px hsl(var(--primary) / 0.55), 0 8px 32px rgba(180, 156, 125, 0.35)' },
          '50%': { boxShadow: '0 0 0 4px hsl(var(--primary) / 0.35), 0 8px 40px rgba(180, 156, 125, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
