/**
 * AI 回忆录助手 - UI 设计系统
 *
 * 视觉方向：温暖、克制、治愈、柔和、细腻、真诚、安静
 * 核心关键词：奶油感、木质感、原木焦糖、暖白、柔雾、轻拟物
 */

// 颜色系统
export const colors = {
  // 主色 - 低饱和暖焦糖木质色
  primary: {
    DEFAULT: '#A67C52',      // 焦糖木色
    light: '#C4A07A',        // 浅焦糖
    dark: '#8B6543',         // 深焦糖
    hover: '#B8956A',        // hover 状态
    active: '#967548',       // active 状态
    soft: '#E8DED3',         // 柔和背景
  },

  // 中性色阶
  neutral: {
    50: '#FAF8F6',           // 极浅米白
    100: '#F5F1EC',          // 奶油白
    200: '#EDE8E1',          // 暖灰白
    300: '#D9D2C8',          // 浅暖灰
    400: '#B8AFA2',          // 中暖灰
    500: '#948A7C',          // 暖灰
    600: '#6E6357',          // 深暖灰
    700: '#504840',          // 暖墨灰
    800: '#3D362E',          // 深褐灰
    900: '#2A241E',          // 炭棕色
  },

  // 背景色阶
  background: {
    primary: '#FEFCF9',       // 主背景 - 奶油白
    secondary: '#F8F4EF',    // 次级背景 - 暖白
    tertiary: '#F0EBE3',    // 三级背景 - 柔雾
    card: '#FFFFFF',         // 卡片背景
    modal: '#FEFCF9',        // 弹层背景
  },

  // 文字色阶
  text: {
    primary: '#3D362E',      // 主文字 - 暖墨色
    secondary: '#6E6357',   // 次级文字 - 暖灰
    tertiary: '#948A7C',    // 辅助文字
    disabled: '#B8AFA2',    // 禁用文字
    inverse: '#FEFCF9',     // 反色文字
  },

  // 状态色
  status: {
    success: '#7B9E87',      // 柔和植物绿
    warning: '#D4A574',      // 暖金色 / 浅琥珀
    error: '#C17B7B',        // 低饱和砖红 / 豆沙红
    info: '#B8A07A',         // 浅金棕
  },

  // 边框色
  border: {
    light: '#EDE8E1',        // 浅边框
    DEFAULT: '#D9D2C8',       // 默认边框
    dark: '#B8AFA2',         // 深边框
    focus: '#A67C52',        // 聚焦边框
  },
} as const;

// 字体系统
export const typography = {
  // 字体家族
  fontFamily: {
    sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
    serif: ['"Noto Serif SC"', '"Songti SC"', '"SimSun"', 'serif'],
  },

  // 字号层级
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1.125rem' }],      // 12px - 辅助
    sm: ['0.875rem', { lineHeight: '1.25rem' }],       // 14px - 次级
    base: ['1rem', { lineHeight: '1.5rem' }],          // 16px - 正文
    lg: ['1.125rem', { lineHeight: '1.75rem' }],       // 18px - 强调
    xl: ['1.25rem', { lineHeight: '1.875rem' }],       // 20px - 标题
    '2xl': ['1.5rem', { lineHeight: '2rem' }],        // 24px - 页面标题
    '3xl': ['1.875rem', { lineHeight: '2.375rem' }],  // 30px - 大标题
  },

  // 字重
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
  },
} as const;

// 间距系统
export const spacing = {
  0: '0',
  1: '0.25rem',    // 4px
  2: '0.5rem',     // 8px
  3: '0.75rem',    // 12px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
} as const;

// 圆角系统
export const borderRadius = {
  none: '0',
  sm: '0.25rem',     // 4px
  DEFAULT: '0.5rem', // 8px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.5rem',      // 24px
  '2xl': '2rem',     // 32px
  full: '9999px',    // 圆形
} as const;

// 阴影系统
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(61, 54, 46, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(61, 54, 46, 0.1), 0 1px 2px -1px rgba(61, 54, 46, 0.1)',
  md: '0 4px 6px -1px rgba(61, 54, 46, 0.1), 0 2px 4px -2px rgba(61, 54, 46, 0.1)',
  lg: '0 10px 15px -3px rgba(61, 54, 46, 0.1), 0 4px 6px -4px rgba(61, 54, 46, 0.1)',
  xl: '0 20px 25px -5px rgba(61, 54, 46, 0.1), 0 8px 10px -6px rgba(61, 54, 46, 0.1)',
  // 柔和阴影（适合卡片）
  card: '0 2px 8px rgba(61, 54, 46, 0.08)',
  cardHover: '0 4px 16px rgba(61, 54, 46, 0.12)',
  // 弹层阴影
  modal: '0 25px 50px -12px rgba(61, 54, 46, 0.25)',
} as const;

// 动画系统
export const transitions = {
  none: 'none',
  fast: '75ms ease-in-out',
  DEFAULT: '150ms ease-in-out',
  slow: '300ms ease-in-out',
} as const;

// 组件尺寸
export const sizes = {
  button: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: '0.5rem 1rem',
      md: '0.75rem 1.5rem',
      lg: '1rem 2rem',
    },
  },
  input: {
    height: '2.5rem',   // 40px
    padding: '0.5rem 1rem',
  },
  avatar: {
    sm: '2rem',        // 32px
    md: '3rem',        // 48px
    lg: '4rem',        // 64px
  },
} as const;

// 响应式断点
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

// Z-index 层级
export const zIndex = {
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
} as const;

// 导出为 CSS 变量
export const cssVariables = `
  /* 颜色变量 */
  --color-primary: ${colors.primary.DEFAULT};
  --color-primary-light: ${colors.primary.light};
  --color-primary-dark: ${colors.primary.dark};
  --color-primary-hover: ${colors.primary.hover};
  --color-primary-active: ${colors.primary.active};
  --color-primary-soft: ${colors.primary.soft};

  --color-background-primary: ${colors.background.primary};
  --color-background-secondary: ${colors.background.secondary};
  --color-background-tertiary: ${colors.background.tertiary};
  --color-background-card: ${colors.background.card};

  --color-text-primary: ${colors.text.primary};
  --color-text-secondary: ${colors.text.secondary};
  --color-text-tertiary: ${colors.text.tertiary};

  --color-status-success: ${colors.status.success};
  --color-status-warning: ${colors.status.warning};
  --color-status-error: ${colors.status.error};
  --color-status-info: ${colors.status.info};

  --color-border-light: ${colors.border.light};
  --color-border: ${colors.border.DEFAULT};
  --color-border-dark: ${colors.border.dark};

  /* 圆角变量 */
  --radius-sm: ${borderRadius.sm};
  --radius: ${borderRadius.DEFAULT};
  --radius-md: ${borderRadius.md};
  --radius-lg: ${borderRadius.lg};
  --radius-xl: ${borderRadius.xl};

  /* 阴影变量 */
  --shadow-card: ${shadows.card};
  --shadow-card-hover: ${shadows.cardHover};
  --shadow-modal: ${shadows.modal};

  /* 过渡变量 */
  --transition: ${transitions.DEFAULT};
`;
