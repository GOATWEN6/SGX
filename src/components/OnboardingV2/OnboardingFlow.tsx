/**
 * 拾光叙 Onboarding v2 - 主控制器组件
 * 
 * 整合所有 onboarding 流程的入口组件
 */

import React, { useState } from 'react';
import { Welcome } from './Welcome';
import { ElderlyForm } from './ElderlyForm';
import { CaregiverForm } from './CaregiverForm';
import { ElderlyDashboard } from './ElderlyDashboard';
import { CaregiverDashboard } from './CaregiverDashboard';
import { OnboardingFormData, OnboardingTrack } from './shared';

interface OnboardingFlowProps {
  onComplete?: (data: OnboardingFormData, track: OnboardingTrack) => void;
}

/** 0=欢迎页；1+ 为表单步数；完成后进入仪表盘虚拟步 */
type DashboardStep = 'elderly_dashboard' | 'caregiver_dashboard';
type FlowStep = number | DashboardStep;

const initialFormData: OnboardingFormData = {
  name: '',
  year: 1955,
  city: '',
  themes: [],
  privacy: '',
  caregiverRole: '',
  healthStatus: '',
  deviceType: ''
};

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<FlowStep>(0);
  const [track, setTrack] = useState<OnboardingTrack>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);

  // 平滑过渡到下一步
  const transitionTo = (nextStep: FlowStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsAnimating(false);
    }, 300);
  };

  // 处理下一步
  const handleNext = () => {
    if (typeof step !== 'number') return;

    if (track === 'A') {
      if (step === 4) {
        transitionTo('elderly_dashboard');
        onComplete?.(formData, track);
      } else {
        transitionTo(step + 1);
      }
    } else if (track === 'B') {
      if (step === 5) {
        transitionTo('caregiver_dashboard');
        onComplete?.(formData, track);
      } else {
        transitionTo(step + 1);
      }
    }
  };

  // 处理上一步
  const handleBack = () => {
    if (step === 'elderly_dashboard') {
      transitionTo(4);
      return;
    }
    if (step === 'caregiver_dashboard') {
      transitionTo(5);
      return;
    }
    if (step <= 1) {
      transitionTo(0);
      setTrack(null);
    } else {
      transitionTo((step as number) - 1);
    }
  };

  // 处理跳过
  const handleSkip = () => {
    if (typeof step === 'number') transitionTo(step + 1);
  };

  // 更新表单数据
  const handleUpdateData = (key: keyof OnboardingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // 处理主题切换（支持多选）
  const handleToggleTheme = (theme: string) => {
    setFormData(prev => {
      const themes = prev.themes.includes(theme)
        ? prev.themes.filter(t => t !== theme)
        : [...prev.themes, theme];
      return { ...prev, themes };
    });
  };

  // 处理 Track 选择
  const handleSelectTrack = (selectedTrack: OnboardingTrack) => {
    setTrack(selectedTrack);
    transitionTo(1);
  };

  // 退出预览（开发模式）- 返回欢迎页
  const handleExit = () => {
    transitionTo(0);
    setTrack(null);
    setFormData(initialFormData);
  };

  // 切换端（保留已填写数据，切换 track 和仪表盘）
  const handleSwitchTrack = () => {
    const targetTrack = track === 'A' ? 'B' : 'A';
    // 根据目标 track 决定仪表盘类型
    const targetDashboard: DashboardStep =
      targetTrack === 'A' ? 'elderly_dashboard' : 'caregiver_dashboard';
    setTrack(targetTrack);
    transitionTo(targetDashboard);
  };

  // 路由渲染
  // Step 0: 欢迎页
  if (step === 0) {
    return (
      <Welcome 
        onSelectTrack={handleSelectTrack} 
        isAnimating={isAnimating}
      />
    );
  }

  // Track A: 长辈端表单 (Step 1-4)
  if (track === 'A') {
    // 老人端仪表盘
    if (step === 'elderly_dashboard') {
      return (
        <ElderlyDashboard 
          formData={formData}
          isAnimating={isAnimating}
          onExit={handleExit}
          onSwitchTrack={handleSwitchTrack}
        />
      );
    }

    return (
      <ElderlyForm
        formData={formData}
        step={step as number}
        isAnimating={isAnimating}
        onUpdateData={handleUpdateData}
        onToggleTheme={handleToggleTheme}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
      />
    );
  }

  // Track B: 子女端表单 (Step 1-5)
  if (track === 'B') {
    // 子女端仪表盘
    if (step === 'caregiver_dashboard') {
      return (
        <CaregiverDashboard 
          formData={formData}
          isAnimating={isAnimating}
          onExit={handleExit}
          onSwitchTrack={handleSwitchTrack}
        />
      );
    }

    return (
      <CaregiverForm
        formData={formData}
        step={step as number}
        isAnimating={isAnimating}
        onUpdateData={handleUpdateData}
        onToggleTheme={handleToggleTheme}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
      />
    );
  }

  return null;
};

export default OnboardingFlow;
