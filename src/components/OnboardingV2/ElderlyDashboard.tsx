/**
 * 拾光叙 Onboarding v2 - 老人端仪表盘
 * 
 * 极简大字号书房界面
 */

import React from 'react';
import { Sun, MessageCircle, Book, RefreshCw, ChevronLeft } from 'lucide-react';
import { OnboardingFormData } from './shared';

interface ElderlyDashboardProps {
  formData: OnboardingFormData;
  isAnimating?: boolean;
  onChat?: () => void;
  onViewMemoir?: () => void;
  onExit?: () => void;
  onSwitchTrack?: () => void;
}

export const ElderlyDashboard: React.FC<ElderlyDashboardProps> = ({ 
  formData, 
  isAnimating = false,
  onChat,
  onViewMemoir,
  onExit,
  onSwitchTrack
}) => {
  // 获取时间段问候
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  // 模拟天气数据
  const weather = { temp: 22, condition: '晴朗' };
  
  // 从城市中提取地名（去除 emoji）
  const cityName = formData.city ? formData.city.replace(/📍\s*/g, '') : '老家';

  return (
    <div className={`flex flex-col h-screen bg-[#FDFBF7] text-[#4A4238] transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
      {/* 顶部天气与问候 */}
      <div className="pt-12 px-6 pb-6 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-4xl font-medium mb-2">{formData.name || '您'}，{getGreeting()}</h1>
          <p className="text-2xl text-[#8A735E] flex items-center gap-2">
            <Sun size={28} /> 今天{weather.condition}，{weather.temp}℃
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 切换端入口 */}
          <button
            onClick={onSwitchTrack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F4F0EA] text-[#8A735E] text-sm font-medium hover:bg-[#E8E2D9] transition-colors"
            type="button"
            title="切换到子女端"
          >
            <RefreshCw size={16} />
            子女端
          </button>
          {/* 返回 */}
          <button
            onClick={onExit}
            className="p-2 rounded-full hover:bg-[#F4F0EA] transition-colors"
            type="button"
            title="返回设置"
          >
            <ChevronLeft size={24} className="text-[#8A735E]" />
          </button>
          <div className="w-12 h-12 rounded-full bg-[#E8E2D9] overflow-hidden border-2 border-white shadow-sm">
           <img 
             src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name || 'user')}&backgroundColor=E8E2D9`} 
             alt="avatar" 
           />
          </div>
        </div>
      </div>

      {/* 核心功能区 */}
      <div className="px-6 flex-1 flex flex-col gap-6 mt-4">
        {/* 聊天入口卡片 */}
        <div 
          className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-[#F4F0EA] flex-1 flex flex-col justify-center items-center text-center active:scale-95 transition-transform cursor-pointer"
          onClick={onChat}
        >
            <div className="w-24 h-24 bg-[#F4F0EA] rounded-full flex items-center justify-center mb-6">
               <MessageCircle size={48} className="text-[#8A735E]" />
            </div>
            <h2 className="text-3xl font-medium mb-4">今天想聊点什么？</h2>
            <p className="text-xl text-[#A89F91]">小叙为您准备了一个关于「{cityName}」的话题</p>
        </div>
        
        {/* 回忆录入口 */}
        <div 
          className="bg-[#8A735E] text-white p-8 rounded-[2.5rem] shadow-md flex items-center justify-between active:scale-95 transition-transform cursor-pointer"
          onClick={onViewMemoir}
        >
            <span className="text-3xl font-medium">翻看回忆录</span>
            <Book size={40} />
        </div>
      </div>
      
      {/* 底部导航 */}
      <div className="bg-white h-20 border-t border-[#F4F0EA] flex justify-around items-center px-6">
        <div className="flex flex-col items-center text-[#8A735E] font-medium cursor-pointer">
          <MessageCircle size={24} className="mb-1" />
          <span className="text-xs">聊天</span>
        </div>
        <div className="flex flex-col items-center text-[#D4C4B7] cursor-pointer">
          <Book size={24} className="mb-1" />
          <span className="text-xs">回忆录</span>
        </div>
      </div>
    </div>
  );
};

export default ElderlyDashboard;
