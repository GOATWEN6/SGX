/**
 * AI 回忆录助手 - ProgressBar 进度条组件
 */
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  currentPhase: string;
}

const phaseProgress: Record<string, number> = {
  onboarding: 0,
  ice_breaker: 10,
  basic_info: 20,
  childhood: 30,
  education: 40,
  career: 50,
  family: 60,
  migration: 70,
  challenges: 80,
  proud_moments: 85,
  reflections: 90,
  legacy: 100,
};

const phaseNames: Record<string, string> = {
  onboarding: '欢迎设置',
  ice_breaker: '破冰与信任',
  basic_info: '基本人生信息',
  childhood: '童年与家庭',
  education: '学校与成长',
  career: '工作与事业',
  family: '婚恋与家庭',
  migration: '迁徙与时代',
  challenges: '困难与转折',
  proud_moments: '骄傲与成就',
  reflections: '感悟与和解',
  legacy: '留给后代的话',
};

export default function ProgressBar({ currentPhase }: ProgressBarProps) {
  const progress = phaseProgress[currentPhase] || 0;
  const phaseName = phaseNames[currentPhase] || '访谈中';

  return (
    <div className={styles.container}>
      <div className={styles.info}>
        <span className={styles.phase}>当前阶段：{phaseName}</span>
        <span className={styles.percent}>{progress}%</span>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
}