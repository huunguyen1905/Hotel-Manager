
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Bookings } from './pages/Bookings';
import { Rooms } from './pages/Rooms';
import { Collaborators } from './pages/Collaborators';
import { Expenses } from './pages/Expenses';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { Housekeeping } from './pages/Housekeeping';
import { Customers } from './pages/Customers';
import { Inventory } from './pages/Inventory';
import { StaffPortal } from './pages/StaffPortal';
import { ToastContainer } from './components/ToastContainer';
import { Menu, Bell, Search } from 'lucide-react';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser, canAccess } = useAppContext();
    const location = useLocation();
  
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    
    if (!canAccess(location.pathname)) {
        if (currentUser.role === 'Buồng phòng') return <Navigate to="/staff-portal" replace />;
        return <Navigate to="/dashboard" replace />;
    }
  
    return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();

  // Listen to screen resize to handle mobile/desktop states correctly
  useEffect(() => {
    const handleResize = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (!mobile) setSidebarOpen(true);
        else setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!currentUser) return <Navigate to="/login" replace />;

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/': return 'Tổng Quan';
      case '/dashboard': return 'Dashboard';
      case '/bookings': return 'Lịch Đặt Phòng';
      case '/rooms': return 'Quản Lý Phòng';
      case '/housekeeping': return 'Buồng Phòng';
      case '/customers': return 'Khách Hàng (CRM)';
      case '/inventory': return 'Kho & Vật Tư';
      case '/collaborators': return 'Nhân Sự';
      case '/expenses': return 'Tài Chính';
      case '/settings': return 'Cấu Hình';
      default: return 'Hotel Manager Pro';
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden selection:bg-brand-500 selection:text-white">
      <ToastContainer />
      
      {/* Backdrop for Mobile Only */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Wrapper: fixed on mobile, relative on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-[100] md:relative 
        ${sidebarOpen ? 'translate-x-0 w-[280px] md:w-72' : '-translate-x-full md:translate-x-0 md:w-20'} 
        transition-all duration-300 ease-spring shrink-0
      `}>
        <Sidebar isOpen={sidebarOpen} toggle={toggleSidebar} />
      </div>
      
      {/* Vùng Content - Chứa Header và Main */}
      <div id="main-layout-container" className="flex-1 flex flex-col min-w-0 h-full relative z-0">
        <header className="h-16 px-4 md:px-6 flex items-center justify-between bg-white border-b border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] shrink-0 z-40">
           <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={toggleSidebar} 
               className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
             >
               <Menu size={20} />
             </button>
             <div className="h-6 w-[1px] bg-slate-200 mx-1 md:mx-2"></div>
             <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 truncate">
                {getPageTitle(location.pathname)}
             </h2>
           </div>

           <div className="flex items-center gap-2 md:gap-4">
             <div className="hidden lg:flex items-center bg-slate-100 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-brand-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-500/10 transition-all w-72 group">
                <Search size={16} className="text-slate-400 group-focus-within:text-brand-500 transition-colors mr-2" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm..." 
                  className="bg-transparent border-none outline-none text-sm text-slate-700 w-full placeholder:text-slate-400"
                />
             </div>

             <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-colors">
                <Bell size={20} />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>
             
             <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center bg-brand-600 text-white font-bold text-xs">
                  {currentUser.collaboratorName.charAt(0)}
                </div>
             </div>
           </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc] p-3 md:p-6 scroll-smooth">
          <div className="h-full w-full flex flex-col animate-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><Layout><Bookings /></Layout></ProtectedRoute>} />
          <Route path="/rooms" element={<ProtectedRoute><Layout><Rooms /></Layout></ProtectedRoute>} />
          <Route path="/housekeeping" element={<ProtectedRoute><Layout><Housekeeping /></Layout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Layout><Inventory /></Layout></ProtectedRoute>} />
          <Route path="/collaborators" element={<ProtectedRoute><Layout><Collaborators /></Layout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Layout><Expenses /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

          {/* Staff Portal: Standalone view */}
          <Route path="/staff-portal" element={<ProtectedRoute><StaffPortal /></ProtectedRoute>} />
          
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
