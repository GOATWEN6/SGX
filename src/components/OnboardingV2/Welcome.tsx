/**
 * 拾光叙 Onboarding v2 - 欢迎页组件
 * 
 * 入口选择：长辈自己记录 或 子女为长辈准备
 */

import React from 'react';
import { User, Heart } from 'lucide-react';
import { BigCard, OnboardingTrack } from './shared';

interface WelcomeProps {
  onSelectTrack: (track: OnboardingTrack) => void;
  isAnimating?: boolean;
}

export const Welcome: React.FC<WelcomeProps> = ({ onSelectTrack, isAnimating = false }) => {
  return (
    <div className={`flex flex-col h-screen bg-[#FDFBF7] text-[#4A4238] px-6 py-12 transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex-1 max-w-md mx-auto w-full flex flex-col justify-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-medium tracking-widest mb-4">拾光叙</h1>
          <p className="text-xl text-[#8A735E] tracking-wide">岁月从不败记忆</p>
        </div>
        <div className="space-y-6">
          <BigCard 
            icon={User} 
            title="我自己记录" 
            desc="我想把过去的故事存下来，留给岁月和家人。"
            onClick={() => onSelectTrack('A')}
          />
          <BigCard 
            icon={Heart} 
            title="我为长辈准备" 
            desc="我想帮家里的老人留住珍贵的回忆。"
            onClick={() => onSelectTrack('B')}
          />
        </div>
      </div>
    </div>
  );
};

export default Welcome;
