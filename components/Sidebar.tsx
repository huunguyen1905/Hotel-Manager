
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, CalendarCheck, DoorOpen, Users, 
  Wallet, Settings, LogOut, Brush, ChevronRight, Contact, Package, Clock, X, Smartphone
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { storageService } from '../services/storage';
import { ShiftModal } from './ShiftModal';

export const Sidebar: React.FC<{ isOpen: boolean; toggle: () => void }> = ({ isOpen, toggle }) => {
  const { currentUser, setCurrentUser, canAccess, currentShift } = useAppContext();
  const navigate = useNavigate();
  const [isShiftModalOpen, setShiftModalOpen] = useState(false);

  const handleLogout = () => {
    // Thực hiện đăng xuất ngay lập tức
    setCurrentUser(null);
    storageService.saveUser(null); // Clear storage
    navigate('/login');
  };

  const menuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { to: '/bookings', icon: CalendarCheck, label: 'Lịch đặt phòng' },
    { to: '/rooms', icon: DoorOpen, label: 'Phòng & Cơ sở' },
    { to: '/housekeeping', icon: Brush, label: 'Buồng phòng' },
    { to: '/staff-portal', icon: Smartphone, label: 'App Nhân Viên' },
    { to: '/inventory', icon: Package, label: 'Kho & Vật tư' },
    { to: '/customers', icon: Contact, label: 'Khách hàng (CRM)' }, 
    { to: '/collaborators', icon: Users, label: 'Nhân sự' },
    { to: '/expenses', icon: Wallet, label: 'Tài chính' },
    { to: '/settings', icon: Settings, label: 'Cấu hình' },
  ];
  
  return (
    <>
    <aside 
      className={`h-full bg-[#0f172a] text-slate-300 flex flex-col border-r border-slate-800 shadow-xl overflow-hidden transition-all duration-300 w-full`}
    >
      {/* Header Sidebar */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 bg-[#020617] justify-between">
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-brand-400 flex items-center justify-center text-white shadow-[0_0_15px_rgba(20,184,166,0.4)] shrink-0">
             <span className="font-bold font-sans">H</span>
          </div>
          <div className={`transition-all duration-300 ${(isOpen || window.innerWidth < 768) ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
             <h1 className="font-bold text-white text-base tracking-tight">HotelPro</h1>
          </div>
        </div>
        
        {/* Close button for mobile */}
        <button onClick={toggle} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-3">
          <button 
             onClick={() => setShiftModalOpen(true)}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-all mb-2 shadow-lg
                ${currentShift ? 'bg-green-600/10 text-green-400 border border-green-600/20 hover:bg-green-600/20' : 'bg-blue-600 text-white hover:bg-blue-500'}
             `}
          >
              <Clock size={18} className="shrink-0"/>
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                  {currentShift ? 'Đang Giao Ca' : 'Mở Ca Mới'}
              </span>
          </button>
      </div>

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.filter(i => canAccess(i.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => window.innerWidth < 768 && toggle()} // Auto close on mobile click
            title={!isOpen ? item.label : ''}
            className={({ isActive }) => `
              relative flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group mb-1
              ${isActive 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                : 'hover:bg-slate-800/80 hover:text-white text-slate-400'}
            `}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 text-sm ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
                  {item.label}
                </span>

                {(!isOpen && window.innerWidth >= 768) && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
                )}
                
                {isActive && (isOpen || window.innerWidth < 768) && (
                   <ChevronRight size={14} className="ml-auto opacity-50" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800/80 bg-[#020617]">
        <button 
           onClick={handleLogout}
           className={`flex items-center gap-3 w-full p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all group ${(!isOpen && window.innerWidth >= 768) ? 'justify-center' : ''}`}
        >
          <LogOut size={20} className="shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200 ${(isOpen || window.innerWidth < 768) ? 'w-auto opacity-100' : 'w-0 opacity-0 hidden'}`}>
             Đăng xuất
          </span>
        </button>
      </div>
    </aside>

    <ShiftModal isOpen={isShiftModalOpen} onClose={() => setShiftModalOpen(false)} />
    </>
  );
};
