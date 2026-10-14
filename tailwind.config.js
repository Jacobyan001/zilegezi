/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        kid: ['"ZCOOL KuaiLe"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        kai: ['"Kaiti SC"', '"STKaiti"', '"KaiTi"', '"楷体"', '"Songti SC"', '"Noto Serif SC"', 'serif'],
      },
      colors: {
        paper: '#fdf6e9',
        paperdeep: '#f6e7c8',
        ink: '#2e2a24',
        cinnabar: '#e85d3f',
        cinnabardeep: '#c9482d',
        jade: '#3aa17e',
        sun: '#f6b93b',
        sky: '#5aa7e0',
        grape: '#9b7ede',
      },
      boxShadow: {
        block: '0 5px 0 rgba(46,42,36,0.18)',
        'block-lg': '0 8px 0 rgba(46,42,36,0.2)',
        card: '0 3px 0 rgba(46,42,36,0.15), 0 6px 14px rgba(46,42,36,0.12)',
        'card-deep': '0 4px 0 rgba(46,42,36,0.28), 0 8px 18px rgba(46,42,36,0.22)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'translate(-50%, -50%) scale(1)' },
          '40%': { transform: 'translate(-50%, -50%) scale(1.18) rotate(3deg)' },
          '100%': { transform: 'translate(-50%, -50%) scale(0) rotate(-12deg)', opacity: '0' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-7px) rotate(-2deg)' },
          '40%': { transform: 'translateX(7px) rotate(2deg)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(5px)' },
        },
        bob: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        ring: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        floatUp: {
          '0%': { transform: 'translate(-50%, -50%) translateY(8px)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translate(-50%, -50%) translateY(-46px)', opacity: '0' },
        },
        dropIn: {
          '0%': { transform: 'translate(-50%, -50%) translateY(-26px) scale(0.7)', opacity: '0' },
          '70%': { transform: 'translate(-50%, -50%) translateY(3px) scale(1.04)', opacity: '1' },
          '100%': { transform: 'translate(-50%, -50%) translateY(0) scale(1)', opacity: '1' },
        },
        // 给 flex 居中的弹窗/横幅用（不带 -50% 锚定偏移）
        dropInCenter: {
          '0%': { transform: 'translateY(-26px) scale(0.7)', opacity: '0' },
          '70%': { transform: 'translateY(3px) scale(1.04)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translate(0,0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translate(var(--cx), var(--cy)) rotate(540deg)', opacity: '0' },
        },
        sparkle: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.35)', opacity: '0.5' },
        },
      },
      animation: {
        pop: 'pop 0.42s cubic-bezier(0.36,0,0.66,-0.28) forwards',
        shake: 'shake 0.5s ease-in-out',
        bob: 'bob 2.4s ease-in-out infinite',
        ring: 'ring 1.4s ease-out infinite',
        wiggle: 'wiggle 0.8s ease-in-out infinite',
        floatUp: 'floatUp 0.9s ease-out forwards',
        dropIn: 'dropIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        dropInCenter: 'dropInCenter 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
        confetti: 'confetti 0.95s ease-out forwards',
        sparkle: 'sparkle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
