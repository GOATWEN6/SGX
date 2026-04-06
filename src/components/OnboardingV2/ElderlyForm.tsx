/**
 * 拾光叙 Onboarding v2 - 长辈注册表单组件
 * 
 * Track A: 长辈自己注册流 (Step 1 - 4)
 */

import React from 'react';
import { 
  PageWrapper, 
  Pill, 
  NextButton, 
  YearPicker,
  ThemeCard,
  BigCard,
  OnboardingFormData,
  CITY_OPTIONS,
  ELDERLY_THEMES,
  PRIVACY_OPTIONS
} from './shared';
import { Award, Briefcase, Home, Navigation, Palette, Book, Users, Lock, type LucideIcon } from 'lucide-react';

const THEME_ICONS: Record<string, LucideIcon> = {
  military: Award,
  career: Briefcase,
  family: Home,
  travel: Navigation,
  hobby: Palette,
  daily: Book,
};

const PRIVACY_ICONS: Record<string, LucideIcon> = {
  public: Users,
  private: Lock,
};

interface ElderlyFormProps {
  formData: OnboardingFormData;
  step: number;
  isAnimating: boolean;
  onUpdateData: (key: keyof OnboardingFormData, value: any) => void;
  onToggleTheme: (theme: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

// Step 1: 姓名和出生年份
const StepNameYear: React.FC<Omit<ElderlyFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack }) => {
  const surname = formData.name ? formData.name.charAt(0) : 'X';
  const tagOptions = formData.name.length > 0 
    ? [`${surname}爷爷 / ${surname}奶奶`, `老${surname}`, `${surname}老师 / ${surname}局长`]
    : ['X爷爷 / X奶奶', '老X', 'X老师 / X局长'];

  return (
    <PageWrapper 
      title="您好，我是小叙。\n以后我该怎么称呼您呢？" 
      showBack={true}
      onBack={onBack}
      isAnimating={isAnimating}
    >
      <div className="mt-4 mb-10">
        <input
          type="text"
          value={formData.name}
          onChange={(e) => onUpdateData('name', e.target.value)}
          placeholder="例如：老张、李奶奶"
          className="w-full text-3xl bg-transparent border-b-2 border-[#E8E2D9] pb-4 focus:outline-none focus:border-[#8A735E] transition-colors placeholder:text-[#D4C4B7]"
        />
        <div className="mt-6">
          <div className="flex flex-wrap gap-3">
            {tagOptions.map((tag) => (
              <Pill 
                key={tag} 
                active={formData.name === tag.split(' / ')[0]} 
                onClick={() => onUpdateData('name', tag.split(' / ')[0])}
              >
                {tag}
              </Pill>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-8 bg-white rounded-3xl p-6 shadow-sm border border-[#F4F0EA]">
        <h3 className="text-xl font-medium mb-6 text-center">您的出生年份是？</h3>
        <YearPicker 
          value={formData.year} 
          onChange={(year) => onUpdateData('year', year)} 
        />
      </div>
      <NextButton disabled={!formData.name} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 2: 城市选择
const StepCity: React.FC<Omit<ElderlyFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack, onSkip }) => {
  return (
    <PageWrapper 
      title="您最怀念，或是最常住的城市是哪里？" 
      subtitle="小叙想多了解一点您的过去。" 
      showBack={true}
      showSkip={true}
      onBack={onBack}
      onSkip={onSkip}
      isAnimating={isAnimating}
    >
      <div className="flex flex-wrap gap-4 mt-4">
        {CITY_OPTIONS.map(city => (
          <Pill 
            key={city} 
            active={formData.city === city} 
            onClick={() => onUpdateData('city', city)}
          >
            {city}
          </Pill>
        ))}
      </div>
      <NextButton disabled={!formData.city} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 3: 主题选择
const StepThemes: React.FC<Omit<ElderlyFormProps, 'step'>> = ({ formData, isAnimating, onToggleTheme, onNext, onBack, onSkip }) => {
  return (
    <PageWrapper 
      title="您这辈子，最想记录哪段闪光岁月？" 
      subtitle="请选择您最引以为傲，或最想回忆的经历（可多选）。" 
      showBack={true}
      showSkip={true}
      onBack={onBack}
      onSkip={onSkip}
      isAnimating={isAnimating}
    >
      <div className="grid grid-cols-2 gap-4 mt-2">
        {ELDERLY_THEMES.map(t => {
          const IconComponent = THEME_ICONS[t.id] || Book;
          return (
            <ThemeCard
              key={t.id}
              id={t.id}
              title={t.title}
              desc={t.desc}
              icon={IconComponent}
              selected={formData.themes.includes(t.id)}
              onClick={() => onToggleTheme(t.id)}
            />
          );
        })}
      </div>
      <NextButton disabled={formData.themes.length === 0} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 4: 隐私设置
const StepPrivacy: React.FC<Omit<ElderlyFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack, onSkip }) => {
  return (
    <PageWrapper 
      title="您的故事是一笔宝贵的财富。" 
      subtitle="小叙会把它们整理好，您希望这些回忆：" 
      showBack={true}
      showSkip={true}
      onBack={onBack}
      onSkip={onSkip}
      isAnimating={isAnimating}
    >
      <div className="space-y-5">
        {PRIVACY_OPTIONS.map(option => {
          const IconComponent = PRIVACY_ICONS[option.id] || Users;
          return (
            <BigCard 
              key={option.id}
              icon={IconComponent}
              title={option.title}
              desc={option.desc}
              selected={formData.privacy === option.id}
              onClick={() => onUpdateData('privacy', option.id)}
            />
          );
        })}
      </div>
      <NextButton label="完成设置" disabled={!formData.privacy} onClick={onNext} />
    </PageWrapper>
  );
};

// 主组件：根据 step 渲染对应的子页面
export const ElderlyForm: React.FC<ElderlyFormProps> = (props) => {
  const { step, ...rest } = props;
  
  switch (step) {
    case 1:
      return <StepNameYear {...rest} />;
    case 2:
      return <StepCity {...rest} />;
    case 3:
      return <StepThemes {...rest} />;
    case 4:
      return <StepPrivacy {...rest} />;
    default:
      return null;
  }
};

export default ElderlyForm;
