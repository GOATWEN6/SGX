# AI 回忆录助手 - UI 视觉设计指南

## 一、视觉方向

### 核心关键词
- **温暖**：低饱和度暖色调，给人亲切感
- **克制**：不炫技、不喧宾夺主
- **治愈**：柔和、安静的视觉氛围
- **柔和**：圆润的线条和边缘
- **细腻**：细节处理精致
- **真诚**：不做作的表达
- **安静**：不刺激的视觉体验

### 质感关键词
- 奶油感
- 木质感
- 原木焦糖
- 暖白
- 柔雾
- 轻拟物

---

## 二、颜色系统

### 主色 - 低饱和暖焦糖木质色

```css
:root {
  /* 主色 */
  --color-primary: #A67C52;        /* 焦糖木色 */
  --color-primary-light: #C4A07A;   /* 浅焦糖 */
  --color-primary-dark: #8B6543;    /* 深焦糖 */
  --color-primary-hover: #B8956A;   /* hover 状态 */
  --color-primary-active: #967548;  /* active 状态 */
  --color-primary-soft: #E8DED3;   /* 柔和背景 */
}
```

### 中性色阶

```css
:root {
  /* 中性色 - 暖灰系列 */
  --color-neutral-50: #FAF8F6;   /* 极浅米白 */
  --color-neutral-100: #F5F1EC;  /* 奶油白 */
  --color-neutral-200: #EDE8E1;  /* 暖灰白 */
  --color-neutral-300: #D9D2C8;  /* 浅暖灰 */
  --color-neutral-400: #B8AFA2;  /* 中暖灰 */
  --color-neutral-500: #948A7C;  /* 暖灰 */
  --color-neutral-600: #6E6357;  /* 深暖灰 */
  --color-neutral-700: #504840;  /* 暖墨灰 */
  --color-neutral-800: #3D362E;  /* 深褐灰 */
  --color-neutral-900: #2A241E;  /* 炭棕色 */
}
```

### 背景色阶

```css
:root {
  --color-bg-primary: #FEFCF9;    /* 主背景 - 奶油白 */
  --color-bg-secondary: #F8F4EF; /* 次级背景 - 暖白 */
  --color-bg-tertiary: #F0EBE3;  /* 三级背景 - 柔雾 */
  --color-bg-card: #FFFFFF;      /* 卡片背景 */
  --color-bg-modal: #FEFCF9;     /* 弹层背景 */
}
```

### 文字色阶

```css
:root {
  --color-text-primary: #3D362E;  /* 主文字 - 暖墨色 */
  --color-text-secondary: #6E6357; /* 次级文字 - 暖灰 */
  --color-text-tertiary: #948A7C; /* 辅助文字 */
  --color-text-disabled: #B8AFA2; /* 禁用文字 */
  --color-text-inverse: #FEFCF9;  /* 反色文字 */
}
```

### 状态色

```css
:root {
  --color-success: #7B9E87;    /* 柔和植物绿 */
  --color-warning: #D4A574;   /* 暖金色 */
  --color-error: #C17B7B;     /* 低饱和砖红 */
  --color-info: #B8A07A;      /* 浅金棕 */
}
```

### 边框色

```css
:root {
  --color-border-light: #EDE8E1;  /* 浅边框 */
  --color-border: #D9D2C8;       /* 默认边框 */
  --color-border-dark: #B8AFA2;  /* 深边框 */
  --color-border-focus: #A67C52; /* 聚焦边框 */
}
```

---

## 三、字体系统

### 字体家族

```css
:root {
  /* 无衬线体 - 推荐用于正文 */
  --font-family-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  
  /* 衬线体 - 可选用于标题或特殊场景 */
  --font-family-serif: "Noto Serif SC", "Songti SC", "SimSun", serif;
}
```

### 字号层级（适老友好）

```css
:root {
  /* 基础字号 - 偏大，便于阅读 */
  --font-size-base: 1.125rem;    /* 18px - 正文 */
  --font-size-lg: 1.25rem;       /* 20px - 强调 */
  --font-size-xl: 1.5rem;        /* 24px - 标题 */
  --font-size-2xl: 1.875rem;     /* 30px - 大标题 */
  
  /* 辅助字号 */
  --font-size-sm: 0.875rem;      /* 14px - 次级 */
  --font-size-xs: 0.75rem;      /* 12px - 辅助 */
}
```

### 大字模式

```css
.large-text {
  --font-size-base: 1.375rem;    /* 22px */
  --font-size-lg: 1.75rem;       /* 28px */
  --font-size-xl: 2.25rem;       /* 36px */
}
```

### 高对比度模式

```css
.high-contrast {
  --font-size-base: 1.375rem;
  --color-bg-primary: #ffffff;
  --color-text-primary: #000000;
  --color-border: #000000;
}
```

---

## 四、间距系统

```css
:root {
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;       /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;  /* 40px */
  --spacing-12: 3rem;     /* 48px */
}
```

---

## 五、圆角系统

```css
:root {
  --radius-sm: 0.25rem;    /* 4px */
  --radius: 0.5rem;        /* 8px - 默认 */
  --radius-md: 0.75rem;    /* 12px */
  --radius-lg: 1rem;        /* 16px */
  --radius-xl: 1.5rem;      /* 24px */
  --radius-2xl: 2rem;       /* 32px */
  --radius-full: 9999px;    /* 圆形 */
}
```

---

## 六、阴影系统

```css
:root {
  /* 柔和阴影 - 适合卡片 */
  --shadow-card: 0 2px 8px rgba(61, 54, 46, 0.08);
  --shadow-card-hover: 0 4px 16px rgba(61, 54, 46, 0.12);
  
  /* 弹层阴影 */
  --shadow-modal: 0 25px 50px -12px rgba(61, 54, 46, 0.25);
  
  /* 基础阴影 */
  --shadow-sm: 0 1px 2px 0 rgba(61, 54, 46, 0.05);
  --shadow: 0 1px 3px 0 rgba(61, 54, 46, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(61, 54, 46, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(61, 54, 46, 0.1);
}
```

---

## 七、组件规则

### 按钮

- **高度**：48px（触摸友好）
- **圆角**：8px-12px
- **过渡**：150ms ease-in-out
- **禁用状态**：降低透明度，不使用纯灰色

### 卡片

- **背景**：白色或奶油白
- **圆角**：12px-16px
- **阴影**：柔和的投影
- **内边距**：16px-24px
- **边框**：1px 浅色边框（可选）

### 输入框

- **高度**：48px
- **圆角**：8px
- **边框**：2px
- **聚焦**：主色边框 + 柔和阴影

### 对话气泡

- **用户气泡**：柔和背景（--color-primary-soft）
- **AI 气泡**：浅灰白背景（--color-neutral-100）
- **圆角**：16px（圆润）
- **最大宽度**：85%

---

## 八、动效原则

### 过渡动画

```css
:root {
  --transition-fast: 75ms ease-in-out;
  --transition: 150ms ease-in-out;
  --transition-slow: 300ms ease-in-out;
}
```

### 使用场景

- 页面切换：fadeIn 0.3s
- 元素出现：slideUp 0.4s
- 加载状态：gentlePulse 2s（柔和脉冲）
- 避免使用：过于夸张的动效

---

## 九、适老友好设计

### 核心原则

1. **字号偏大**：基础字号 18px 起
2. **色彩对比度足够**：但不刺眼
3. **触摸区域**：至少 48px × 48px
4. **简洁清晰**：不堆砌装饰
5. **操作可逆**：减少误操作影响
6. **反馈明确**：每个操作都有明确反馈

### 辅助功能

- 支持大字模式（large-text）
- 支持高对比度模式（high-contrast）
- 支持语音输入
- 简洁的导航

---

## 十、禁止的设计风格

❌ **医疗系统风** - 避免使用蓝白色调、药丸形状
❌ **政务风** - 避免使用方正字体、严肃布局
❌ **养老保健品风** - 避免使用保健品包装风格
❌ **高饱和运营风** - 避免使用促销色、弹窗干扰
❌ **强科技风** - 避免使用深色背景、发光效果
❌ **电商促销风** - 避免使用倒计时、红包、折扣标签

---

## 十一、实现方式

### 使用 CSS 变量

在 `globals.css` 中定义所有设计 token：

```css
:root {
  /* 颜色 */
  --color-primary: #A67C52;
  --color-bg-primary: #FEFCF9;
  --color-text-primary: #3D362E;
  
  /* 字号 */
  --font-size-base: 1.125rem;
  
  /* 间距 */
  --spacing-4: 1rem;
  
  /* 圆角 */
  --radius: 0.5rem;
  
  /* 阴影 */
  --shadow-card: 0 2px 8px rgba(61, 54, 46, 0.08);
}
```

### 在组件中使用

```css
.elder-card {
  background-color: var(--color-bg-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--spacing-6);
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius);
  height: 48px;
}
```

---

## 十二、文件位置

- **设计 token 定义**: `src/lib/design-tokens.ts`
- **CSS 变量定义**: `src/app/globals.css`
- **组件样式**: `src/app/page.module.css`
- **主页面**: `src/app/page.tsx`

---

## 十三、后续迭代

### Phase 2（语音与形象）

预留扩展位：

```typescript
// 语音角色配置
interface VoicePersona {
  label: string;
  voiceStyle: string;
  speakingSpeed: number;
  warmthLevel: number;
}

// 形象角色配置
interface AvatarProfile {
  label: string;
  visualStyle: string;
  colorTone: string;
  personaTraits: string[];
}
```

### 注意事项

- 扩展位预留，不影响现有设计
- 未来语音/形象风格应保持温暖、生活化
- 避免过度拟真人，尊重用户隐私
