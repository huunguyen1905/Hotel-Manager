
import React from 'react';
import { Users, CalendarDays, ClipboardList, LayoutDashboard, Palmtree } from 'lucide-react';

export type HRTabType = 'overview' | 'employees' | 'shifts' | 'timesheet' | 'leave';

interface HRTabsProps {
  activeTab: HRTabType;
  onTabChange: (tab: HRTabType) => void;
}

export const HRTabs: React.FC<HRTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'overview' as HRTabType, label: 'Tổng Quan', icon: LayoutDashboard },
    { id: 'employees' as HRTabType, label: 'Nhân Sự', icon: Users },
    { id: 'shifts' as HRTabType, label: 'Lịch Ca', icon: CalendarDays },
    { id: 'leave' as HRTabType, label: 'Nghỉ Phép', icon: Palmtree },
    { id: 'timesheet' as HRTabType, label: 'Công & Lương', icon: ClipboardList },
  ];

  return (
    <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit mb-6 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap
              ${isActive 
                ? 'bg-white text-brand-600 shadow-sm border-b-2 border-brand-500' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}
            `}
          >
            <Icon size={18} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};