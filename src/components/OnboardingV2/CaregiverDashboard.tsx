/**
 * 拾光叙 Onboarding v2 - 子女端仪表盘
 * 
 * 亲情看板与投递筒
 */

import React from 'react';
import { 
  Bell, 
  Plus, 
  Image as ImageIcon, 
  Book, 
  User, 
  Award, 
  Zap,
  RefreshCw,
  ChevronLeft
} from 'lucide-react';
import { OnboardingFormData } from './shared';

interface CaregiverDashboardProps {
  formData: OnboardingFormData;
  isAnimating?: boolean;
  onAddPhoto?: () => void;
  onExit?: () => void;
  onSwitchTrack?: () => void;
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({ 
  formData, 
  isAnimating = false,
  onAddPhoto,
  onExit,
  onSwitchTrack
}) => {
  // 模拟动态数据
  const activities = [
    {
      id: 1,
      icon: Award,
      color: 'bg-orange-100',
      iconColor: 'text-orange-600',
      text: `${formData.name || '长辈'} 给你的照片盖了 [朕已阅] 印章！`,
      time: '10 分钟前'
    },
    {
      id: 2,
      icon: Zap,
      color: 'bg-blue-100',
      iconColor: 'text-blue-600',
      text: `小叙刚刚为 ${formData.name || '长辈'} 生成了一张【${formData.year + 30}年的高光回忆海报】，快去点赞吧！`,
      time: '2 小时前'
    }
  ];

  const tags = ['#今日午饭', '#下班路上', '#家里神兽'];

  return (
    <div className={`flex flex-col h-screen bg-[#F4F0EA] text-[#4A4238] transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
      {/* 顶部：长辈状态仪表盘 */}
      <div className="bg-white rounded-b-[2.5rem] pt-12 px-6 pb-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] z-10 relative">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold tracking-wide">拾光书房</h1>
          <div className="flex items-center gap-2">
            {/* 切换端入口 */}
            <button
              onClick={onSwitchTrack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F4F0EA] text-[#8A735E] text-sm font-medium hover:bg-[#E8E2D9] transition-colors"
              type="button"
              title="切换到老人端"
            >
              <RefreshCw size={16} />
              老人端
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
            <div className="bg-[#FDFBF7] p-2 rounded-full shadow-sm">
              <Bell size={24} className="text-[#8A735E]" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[#E8E2D9] overflow-hidden border-2 border-white shadow-sm">
               <img 
                 src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name || 'elderly')}&backgroundColor=E8E2D9`} 
                 alt="avatar" 
               />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-xl font-bold">{formData.name || '长辈'} <span className="text-sm font-normal text-[#A89F91] ml-2">在线</span></h2>
            {/* 呼吸效果状态栏 */}
            <div className="mt-1 flex items-center gap-2 text-sm text-[#8A735E]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8A735E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8A735E]"></span>
              </span>
              刚刚在书房录制了一段 3 分钟的语音
            </div>
          </div>
        </div>
      </div>

      {/* 核心操作区：极简投递筒 */}
      <div className="px-6 -mt-3 relative z-20">
        <div 
          className="bg-[#4A4238] text-white p-6 rounded-[2rem] shadow-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#3A342C] transition-colors"
          onClick={onAddPhoto}
        >
           <div className="bg-white/20 p-4 rounded-full mb-4">
             <Plus size={36} className="text-white" />
           </div>
           <h3 className="text-lg font-medium mb-1">拍张照片，扔进爸妈的客厅</h3>
           <p className="text-white/60 text-sm mb-4">长辈相框将即时收到提醒</p>
           <div className="flex gap-2 flex-wrap justify-center">
             {tags.map((tag, index) => (
               <span key={index} className="px-3 py-1 bg-white/10 rounded-full text-xs">{tag}</span>
             ))}
           </div>
        </div>
      </div>

      {/* 下半部分：互动反馈流 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 hide-scrollbar">
        <h4 className="text-sm font-bold text-[#A89F91] mb-4">时光动态</h4>
        <div className="space-y-4">
           {activities.map(activity => (
             <div key={activity.id} className="bg-white p-4 rounded-2xl shadow-sm flex gap-4">
                <div className={`w-10 h-10 rounded-full ${activity.color} flex items-center justify-center shrink-0`}>
                  <activity.icon size={20} className={activity.iconColor} />
                </div>
                <div>
                  <p className="text-[#4A4238] text-sm font-medium mb-1">{activity.text}</p>
                  <p className="text-[#A89F91] text-xs">{activity.time}</p>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* 底部导航栏 */}
      <div className="bg-white h-20 border-t border-[#F4F0EA] flex justify-around items-center px-6 pb-safe">
         <div className="flex flex-col items-center text-[#8A735E] font-medium cursor-pointer">
           <ImageIcon size={24} className="mb-1" />
           <span className="text-xs">投递</span>
         </div>
         <div className="flex flex-col items-center text-[#D4C4B7] hover:text-[#8A735E] transition-colors cursor-pointer">
           <Book size={24} className="mb-1" />
           <span className="text-xs">回忆库</span>
         </div>
         <div className="flex flex-col items-center text-[#D4C4B7] hover:text-[#8A735E] transition-colors cursor-pointer">
           <User size={24} className="mb-1" />
           <span className="text-xs">我</span>
         </div>
      </div>
    </div>
  );
};

export default CaregiverDashboard;
