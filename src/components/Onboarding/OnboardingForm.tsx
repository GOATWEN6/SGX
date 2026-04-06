/**
 * AI 回忆录助手 - Onboarding 注册表单组件
 * 用户首次使用时的初始化设置
 */
import { useState } from 'react';
import { logger } from '@/lib/client-logger';
import styles from './OnboardingForm.module.css';

interface OnboardingFormProps {
  displayMode: 'normal' | 'large' | 'high_contrast';
  onComplete: (user: any, token: string) => void;
}

interface FormData {
  name: string;
  ageGroup: string;
  gender: string;
  birthPlace: string;
  grewUpPlace: string;
  education: string;
  useHonorific: boolean;
  preferredStyle: string;
  conversationDuration: number;
  memoirGoal: string;
}

const initialFormData: FormData = {
  name: '',
  ageGroup: '',
  gender: '',
  birthPlace: '',
  grewUpPlace: '',
  education: '',
  useHonorific: true,
  preferredStyle: 'narrative',
  conversationDuration: 10,
  memoirGoal: 'self',
};

export default function OnboardingForm({ displayMode, onComplete }: OnboardingFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: keyof FormData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('请输入您的称呼');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        onComplete(result.data.user, result.data.token);
      } else {
        alert('创建用户失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('注册错误', { error: String(error) });
      alert('发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📖</span>
        <h1>AI 回忆录助手</h1>
      </div>
      
      <p className={styles.subtitle}>
        通过温和的对话，帮助您记录和书写人生故事
      </p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="name">您希望我怎么称呼您？</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="请输入您的称呼"
            disabled={isLoading}
          />
        </div>

        <div className={styles.formGroup}>
          <label>您希望我用"您"还是"你"来称呼您？</label>
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="useHonorific"
                checked={formData.useHonorific}
                onChange={() => handleChange('useHonorific', true)}
                disabled={isLoading}
              />
              <span>用"您"</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="useHonorific"
                checked={!formData.useHonorific}
                onChange={() => handleChange('useHonorific', false)}
                disabled={isLoading}
              />
              <span>用"你"</span>
            </label>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="ageGroup">您大概属于哪个年龄段？</label>
          <select
            id="ageGroup"
            value={formData.ageGroup}
            onChange={(e) => handleChange('ageGroup', e.target.value)}
            disabled={isLoading}
          >
            <option value="">请选择</option>
            <option value="60-65">60-65岁</option>
            <option value="65-70">65-70岁</option>
            <option value="70-75">70-75岁</option>
            <option value="75-80">75-80岁</option>
            <option value="80+">80岁以上</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="birthPlace">您出生在哪里？（可选）</label>
          <input
            type="text"
            id="birthPlace"
            value={formData.birthPlace}
            onChange={(e) => handleChange('birthPlace', e.target.value)}
            placeholder="例如：江苏省南京市"
            disabled={isLoading}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="education">您的受教育程度？（可选）</label>
          <select
            id="education"
            value={formData.education}
            onChange={(e) => handleChange('education', e.target.value)}
            disabled={isLoading}
          >
            <option value="">请选择</option>
            <option value="小学">小学</option>
            <option value="初中">初中</option>
            <option value="高中/中专">高中/中专</option>
            <option value="大专">大专</option>
            <option value="本科">本科</option>
            <option value="研究生">研究生及以上</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="preferredStyle">您喜欢什么风格的文字？</label>
          <select
            id="preferredStyle"
            value={formData.preferredStyle}
            onChange={(e) => handleChange('preferredStyle', e.target.value)}
            disabled={isLoading}
          >
            <option value="narrative">朴素记叙 - 平实清楚</option>
            <option value="o3ical">清丽抒情 - 细腻优美</option>
            <option value="rustic">乡土温润 - 有地方味</option>
            <option value="daily">温厚日常 - 平淡温暖</option>
            <option value="philosophical">哲思沉静 - 深思熟虑</option>
            <option value="letter">家书口吻 - 亲切自然</option>
            <option value="oral">口述实录 - 口语化</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="memoirGoal">您希望这本回忆录给谁看？</label>
          <select
            id="memoirGoal"
            value={formData.memoirGoal}
            onChange={(e) => handleChange('memoirGoal', e.target.value)}
            disabled={isLoading}
          >
            <option value="self">给自己留档</option>
            <option value="children">给子女</option>
            <option value="grandchildren">给孙辈</option>
            <option value="family_heirloom">家庭纪念册</option>
            <option value="publish">出版草稿</option>
          </select>
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={isLoading}
        >
          {isLoading ? '正在准备...' : '开始我们的回忆之旅'}
        </button>
      </form>
    </div>
  );
}