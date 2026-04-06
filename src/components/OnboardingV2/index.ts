/**
 * 拾光叙 Onboarding v2 - 组件导出
 */

export { OnboardingFlow } from './OnboardingFlow';
export { Welcome } from './Welcome';
export { ElderlyForm } from './ElderlyForm';
export { CaregiverForm } from './CaregiverForm';
export { ElderlyDashboard } from './ElderlyDashboard';
export { CaregiverDashboard } from './CaregiverDashboard';

// 共享类型（单独 export type，避免打包器漏识别 interface）
export type { OnboardingFormData, OnboardingTrack } from './shared';

// 共享组件
export {
  PageWrapper,
  BigCard,
  Pill,
  YearPicker,
  NextButton,
  ThemeCard,
  CITY_OPTIONS,
  ELDERLY_THEMES,
  CAREGIVER_THEMES,
  CAREGIVER_ROLES,
  HEALTH_STATUS_OPTIONS,
  PRIVACY_OPTIONS,
  DEVICE_TYPE_OPTIONS,
} from './shared';
