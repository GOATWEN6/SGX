/**
 * 拾光叙 Onboarding v2 - 共享 UI 组件
 * 
 * 可复用的基础组件：BigCard, Pill, NextButton, PageWrapper
 */

import React from 'react';
import { ChevronLeft, ArrowRight, Check } from 'lucide-react';

// ============== 类型定义 ==============

export interface OnboardingFormData {
  name: string;
  year: number;
  city: string;
  themes: string[];
  privacy: string;
  caregiverRole: string;
  healthStatus: string;
  deviceType: string;
}

export type OnboardingTrack = 'A' | 'B' | null;

// ============== 共享组件 ==============

/**
 * 页面容器组件 - 带标题、副标题、返回和跳过按钮
 */
export const PageWrapper: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showSkip?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onSkip?: () => void;
  isAnimating?: boolean;
}> = ({ children, title, subtitle, showSkip, showBack, onBack, onSkip, isAnimating = false }) => (
  <div className={`flex flex-col h-screen bg-[#FDFBF7] text-[#4A4238] font-sans transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
    <div className="flex justify-between items-center p-6 pt-10 shrink-0">
      {showBack ? (
        <button 
          onClick={onBack} 
          className="p-2 -ml-2 text-[#8A735E] hover:bg-[#F4F0EA] rounded-full transition-colors"
          type="button"
        >
          <ChevronLeft size={28} />
        </button>
      ) : <div className="w-10"></div>}
      {showSkip && (
        <button 
          onClick={onSkip} 
          className="text-[#A89F91] text-lg font-medium tracking-wider hover:text-[#8A735E] transition-colors"
          type="button"
        >
          跳过
        </button>
      )}
    </div>
    <div className="flex-1 overflow-y-auto px-6 pb-28 hide-scrollbar">
      <div className="max-w-md mx-auto w-full">
        {title && <h1 className="text-3xl font-medium tracking-wide leading-snug mb-3 whitespace-pre-wrap">{title}</h1>}
        {subtitle && <p className="text-lg text-[#8A735E] leading-relaxed mb-8 whitespace-pre-wrap">{subtitle}</p>}
        {children}
      </div>
    </div>
  </div>
);

/**
 * 大卡片组件 - 用于选择类场景
 */
export const BigCard: React.FC<{
  /** 支持 lucide-react 等图标组件 */
  icon: React.ElementType;
  title: string;
  desc: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ icon: Icon, title, desc, selected = false, onClick, className = "" }) => (
  <div 
    onClick={onClick}
    className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border-2 ${
      selected 
        ? 'bg-white border-[#8A735E] shadow-[0_8px_30px_rgb(138,115,94,0.15)] scale-[1.02]' 
        : 'bg-white border-transparent shadow-[0_4px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.08)]'
    } ${className}`}
  >
    {selected && (
      <div className="absolute top-4 right-4 bg-[#8A735E] text-white rounded-full p-1">
        <Check size={16} strokeWidth={3} />
      </div>
    )}
    <div className={`mb-4 inline-flex p-4 rounded-2xl ${selected ? 'bg-[#F4F0EA] text-[#8A735E]' : 'bg-[#FDFBF7] text-[#A89F91]'}`}>
      <Icon size={36} strokeWidth={1.5} />
    </div>
    <h3 className="text-xl font-medium mb-2">{title}</h3>
    <p className="text-[#8A735E] text-base leading-relaxed">{desc}</p>
  </div>
);

/**
 * 胶囊按钮组件 - 用于标签选择
 */
export const Pill: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({ active = false, onClick, children, className = "", disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-5 py-3 rounded-full text-lg transition-all ${
      active 
        ? 'bg-[#8A735E] text-white shadow-md border-transparent' 
        : 'bg-white text-[#6B5E51] border border-[#E8E2D9] hover:bg-[#F4F0EA]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    type="button"
  >
    {children}
  </button>
);

/**
 * 年份选择器组件
 */
export const YearPicker: React.FC<{
  value: number;
  onChange: (year: number) => void;
  minYear?: number;
  maxYear?: number;
}> = ({ value, onChange, minYear = 1920, maxYear = 2000 }) => (
  <div className="flex items-center gap-6 justify-center">
    <button 
      onClick={() => onChange(Math.max(minYear, value - 1))} 
      className="w-14 h-14 rounded-full bg-[#F4F0EA] text-[#8A735E] flex items-center justify-center text-3xl font-light hover:bg-[#E8E2D9] transition-colors"
      type="button"
    >
      -
    </button>
    <div className="text-5xl font-medium tracking-wider text-[#4A4238] w-32 text-center">{value}</div>
    <button 
      onClick={() => onChange(Math.min(maxYear, value + 1))} 
      className="w-14 h-14 rounded-full bg-[#F4F0EA] text-[#8A735E] flex items-center justify-center text-3xl font-light hover:bg-[#E8E2D9] transition-colors"
      type="button"
    >
      +
    </button>
  </div>
);

/**
 * 下一步按钮组件
 */
export const NextButton: React.FC<{
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
}> = ({ disabled = false, label = "继续", onClick }) => (
  <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent flex justify-center pb-8 z-10">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full max-w-md py-4 rounded-2xl text-xl font-medium flex items-center justify-center gap-2 transition-all ${
        disabled 
          ? 'bg-[#E8E2D9] text-[#A89F91] cursor-not-allowed' 
          : 'bg-[#4A4238] text-white shadow-[0_8px_20px_rgb(74,66,56,0.2)] hover:bg-[#3A342C] hover:-translate-y-1 active:translate-y-0'
      }`}
      type="button"
    >
      {label} <ArrowRight size={24} />
    </button>
  </div>
);

/**
 * 主题卡片组件 - 用于主题选择
 */
export const ThemeCard: React.FC<{
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
}> = ({ id, title, desc, icon: Icon, selected, onClick }) => (
  <div 
    onClick={onClick} 
    className={`p-5 rounded-3xl cursor-pointer transition-all border-2 flex flex-col items-center text-center ${
      selected 
        ? 'bg-[#FDFBF7] border-[#8A735E] shadow-md' 
        : 'bg-white border-transparent shadow-sm hover:shadow-md'
    }`}
  >
    <div className={`mb-3 p-3 rounded-2xl ${selected ? 'bg-[#8A735E] text-white' : 'bg-[#F4F0EA] text-[#8A735E]'}`}>
      <Icon size={28} strokeWidth={1.5} />
    </div>
    <h4 className="text-lg font-medium mb-1">{title}</h4>
    <p className="text-xs text-[#A89F91] leading-relaxed">{desc}</p>
  </div>
);

// ============== 主题选项 ==============

export const CITY_OPTIONS = [
  '📍 广东 深圳', '📍 北京', '📍 上海', '📍 成都', 
  '📍 重庆', '📍 西安', '📍 武汉', '📍 老家'
];

export const ELDERLY_THEMES = [
  { id: 'military', title: '峥嵘岁月', desc: '军旅、下乡、知青', icon: '🎖️' },
  { id: 'career', title: '奋斗打拼', desc: '职场、创业、商海', icon: '💼' },
  { id: 'family', title: '顾家岁月', desc: '带娃、拿手菜、家庭', icon: '🏠' },
  { id: 'travel', title: '走南闯北', desc: '旅行、出差、见闻', icon: '🧭' },
  { id: 'hobby', title: '兴趣爱好', desc: '种花、书法、戏曲', icon: '🎨' },
  { id: 'daily', title: '平淡是真', desc: '日常点滴、流水账', icon: '📖' },
];

export const CAREGIVER_THEMES = [
  { id: 'military', title: '峥嵘岁月' },
  { id: 'career', title: '奋斗打拼' },
  { id: 'family', title: '顾家岁月' },
  { id: 'travel', title: '走南闯北' },
  { id: 'hobby', title: '兴趣爱好' },
  { id: 'daily', title: '平淡是真' },
];

export const CAREGIVER_ROLES = ['女儿', '儿子', '孙女', '孙子', '老伴', '专业护理员'];

export const HEALTH_STATUS_OPTIONS = [
  { 
    id: 'active', 
    title: '🗣️ 精神矍铄，喜欢聊天', 
    desc: '条理清晰。AI 将开启长篇回忆功能，采用开放式追问语调。'
  },
  { 
    id: 'mci', 
    title: '🕰️ 偶尔忘事，时间模糊', 
    desc: '认知轻微衰退。AI 将开启晨间定向播报，转为短句安抚，不纠错。'
  },
  { 
    id: 'highcare', 
    title: '🛏️ 精力较弱，需要安抚', 
    desc: '体力不佳。界面降级极简，AI 开启倾听模式，不主动发起复杂话题。'
  },
];

export const PRIVACY_OPTIONS = [
  { 
    id: 'public', 
    icon: '👨‍👩‍👧‍👦', 
    title: '🏡 全家共享（推荐）', 
    desc: '默认挂在家庭客厅，家人们都能看到并为您点赞。' 
  },
  { 
    id: 'private', 
    icon: '🔒', 
    title: '🔒 先存私密书房', 
    desc: '仅自己可见，等您准备好了，随时可以再分享给家人。' 
  },
];

export const DEVICE_TYPE_OPTIONS = [
  { 
    id: 'frame', 
    icon: '🖼️', 
    title: '🖼️ 我有拾光智能相框', 
    desc: '扫码秒连。相框端将自动唤醒并语音播报您的心意。' 
  },
  { 
    id: 'app', 
    icon: '📱', 
    title: '📱 让长辈在手机平板上用', 
    desc: '生成极简数字邀请码，长辈免注册一键登录。' 
  },
];
