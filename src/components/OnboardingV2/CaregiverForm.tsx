/**
 * 拾光叙 Onboarding v2 - 子女注册表单组件
 * 
 * Track B: 子女/护工代办流 (Step 1 - 5)
 */

import React from 'react';
import { 
  PageWrapper, 
  Pill, 
  NextButton, 
  YearPicker,
  BigCard,
  OnboardingFormData,
  CITY_OPTIONS,
  CAREGIVER_THEMES,
  CAREGIVER_ROLES,
  HEALTH_STATUS_OPTIONS,
  DEVICE_TYPE_OPTIONS
} from './shared';
import { Sun, Clock, Coffee, Monitor, Smartphone, Users, Lock, Share, type LucideIcon } from 'lucide-react';

const HEALTH_STATUS_ICONS: Record<string, LucideIcon> = {
  active: Sun,
  mci: Clock,
  highcare: Coffee,
};

const DEVICE_TYPE_ICONS: Record<string, LucideIcon> = {
  frame: Monitor,
  app: Smartphone,
};

interface CaregiverFormProps {
  formData: OnboardingFormData;
  step: number;
  isAnimating: boolean;
  onUpdateData: (key: keyof OnboardingFormData, value: any) => void;
  onToggleTheme: (theme: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

// Step 1: 子女身份选择
const StepRole: React.FC<Omit<CaregiverFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack }) => {
  const handleRoleSelect = (role: string) => {
    onUpdateData('caregiverRole', role);
    // 自动进入下一步
    setTimeout(() => onNext(), 300);
  };

  return (
    <PageWrapper 
      title="您好，请问您是长辈的？" 
      subtitle="小叙将根据您的身份，为您定制家庭互动视角。" 
      showBack={true}
      onBack={onBack}
      isAnimating={isAnimating}
    >
      <div className="grid grid-cols-2 gap-4 mt-4">
        {CAREGIVER_ROLES.map(role => (
          <Pill 
            key={role} 
            active={formData.caregiverRole === role} 
            className="py-5 text-xl font-medium"
            onClick={() => handleRoleSelect(role)}
          >
            {role}
          </Pill>
        ))}
      </div>
      <div className="mt-8">
        <input
          type="text"
          placeholder="其他称呼（如：儿媳、外甥女）"
          className="w-full text-xl bg-transparent border-b-2 border-[#E8E2D9] pb-4 focus:outline-none focus:border-[#8A735E] transition-colors placeholder:text-[#D4C4B7]"
          onChange={(e) => onUpdateData('caregiverRole', e.target.value)}
          value={formData.caregiverRole || ''}
        />
      </div>
      <NextButton disabled={!formData.caregiverRole} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 2: 长辈信息
const StepElderlyInfo: React.FC<Omit<CaregiverFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack }) => {
  return (
    <PageWrapper 
      title="我们要为哪位长辈建立「拾光书房」？" 
      subtitle="只需三步，帮长辈搭好回忆的家。" 
      showBack={true}
      onBack={onBack}
      isAnimating={isAnimating}
    >
      <div className="space-y-10 mt-2">
        <div>
          <label className="block text-[#A89F91] text-sm mb-2">长辈姓名 / 称呼</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onUpdateData('name', e.target.value)}
            placeholder="例如：李建国 / 爸爸"
            className="w-full text-2xl bg-transparent border-b-2 border-[#E8E2D9] pb-3 focus:outline-none focus:border-[#8A735E]"
          />
        </div>
        
        <div>
          <label className="block text-[#A89F91] text-sm mb-4">出生年份 (定位回忆锚点)</label>
          <div className="flex items-center gap-6 justify-center bg-white p-4 rounded-3xl border border-[#F4F0EA]">
            <button 
              onClick={() => onUpdateData('year', Math.max(1920, formData.year - 1))} 
              className="w-12 h-12 rounded-full bg-[#F4F0EA] text-[#8A735E] flex items-center justify-center text-2xl font-light"
              type="button"
            >
              -
            </button>
            <div className="text-4xl font-medium tracking-wider text-[#4A4238] w-28 text-center">{formData.year}</div>
            <button 
              onClick={() => onUpdateData('year', Math.min(2000, formData.year + 1))} 
              className="w-12 h-12 rounded-full bg-[#F4F0EA] text-[#8A735E] flex items-center justify-center text-2xl font-light"
              type="button"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[#A89F91] text-sm mb-3">常住或最怀念的城市</label>
          <div className="flex flex-wrap gap-3">
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
        </div>
      </div>
      <NextButton disabled={!formData.name || !formData.city} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 3: 长辈健康状态
const StepHealthStatus: React.FC<Omit<CaregiverFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack, onSkip }) => {
  return (
    <PageWrapper 
      title="长辈近期的状态是？" 
      subtitle="为了让 AI 提供最舒适的语调。此信息仅用于系统适配，长辈端绝对不可见。" 
      showBack={true}
      showSkip={true}
      onBack={onBack}
      onSkip={onSkip}
      isAnimating={isAnimating}
    >
      <div className="space-y-4">
        {HEALTH_STATUS_OPTIONS.map(option => {
          const IconComponent = HEALTH_STATUS_ICONS[option.id] || Sun;
          return (
            <BigCard 
              key={option.id}
              icon={IconComponent}
              title={option.title}
              desc={option.desc}
              selected={formData.healthStatus === option.id}
              onClick={() => onUpdateData('healthStatus', option.id)}
            />
          );
        })}
      </div>
      <NextButton disabled={!formData.healthStatus} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 4: 主题选择
const StepThemes: React.FC<Omit<CaregiverFormProps, 'step'>> = ({ formData, isAnimating, onToggleTheme, onNext, onBack, onSkip }) => {
  return (
    <PageWrapper 
      title="长辈最喜欢念叨的经历？" 
      subtitle="小叙将根据这些主题，每天引导长辈聊聊天（可多选）。" 
      showBack={true}
      showSkip={true}
      onBack={onBack}
      onSkip={onSkip}
      isAnimating={isAnimating}
    >
      <div className="grid grid-cols-2 gap-4 mt-2">
        {CAREGIVER_THEMES.map(t => (
          <Pill 
            key={t.id} 
            active={formData.themes.includes(t.id)} 
            onClick={() => onToggleTheme(t.id)}
            className="py-6 shadow-sm"
          >
            {t.title}
          </Pill>
        ))}
      </div>
      <NextButton disabled={formData.themes.length === 0} onClick={onNext} />
    </PageWrapper>
  );
};

// Step 5: 设备类型
const StepDeviceType: React.FC<Omit<CaregiverFormProps, 'step'>> = ({ formData, isAnimating, onUpdateData, onNext, onBack }) => {
  const inviteCode = '839021'; // 模拟邀请码

  return (
    <PageWrapper 
      title="书房已建好！现在，请长辈「拎包入住」吧。" 
      subtitle="选择您为长辈准备的设备类型。" 
      showBack={true}
      onBack={onBack}
      isAnimating={isAnimating}
    >
      <div className="space-y-6">
        {DEVICE_TYPE_OPTIONS.map(option => {
          const IconComponent = DEVICE_TYPE_ICONS[option.id] || Smartphone;
          return (
            <BigCard 
              key={option.id}
              icon={IconComponent}
              title={option.title}
              desc={option.desc}
              selected={formData.deviceType === option.id}
              onClick={() => onUpdateData('deviceType', option.id)}
            />
          );
        })}
      </div>
      {formData.deviceType === 'app' && (
        <div className="mt-8 p-6 bg-white rounded-3xl border border-[#F4F0EA] text-center shadow-sm animate-fade-in-up">
          <p className="text-[#A89F91] text-sm mb-2">长辈专属邀请码</p>
          <div className="text-5xl font-mono font-medium tracking-[0.2em] text-[#8A735E] mb-4">{inviteCode}</div>
          <button 
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#07C160] text-white rounded-xl font-medium"
            type="button"
          >
            <Share size={20} /> 一键分享给长辈微信
          </button>
        </div>
      )}
      <NextButton label="进入我的家庭空间" disabled={!formData.deviceType} onClick={onNext} />
    </PageWrapper>
  );
};

// 主组件：根据 step 渲染对应的子页面
export const CaregiverForm: React.FC<CaregiverFormProps> = (props) => {
  const { step, ...rest } = props;
  
  switch (step) {
    case 1:
      return <StepRole {...rest} />;
    case 2:
      return <StepElderlyInfo {...rest} />;
    case 3:
      return <StepHealthStatus {...rest} />;
    case 4:
      return <StepThemes {...rest} />;
    case 5:
      return <StepDeviceType {...rest} />;
    default:
      return null;
  }
};

export default CaregiverForm;
