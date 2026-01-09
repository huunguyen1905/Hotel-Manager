
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
import { Menu, Bell, Search, AlertOctagon, AlertTriangle, Copy, Check } from 'lucide-react';
import { storageService } from './services/storage';

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
  const [isMockData, setIsMockData] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const [copied, setCopied] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (!mobile) setSidebarOpen(true);
        else setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    
    // Check connection status periodically
    const checkInterval = setInterval(() => {
        if (storageService.isUsingMock()) setIsMockData(true);
    }, 2000);

    // Initial Schema Check
    storageService.checkSchema().then(res => {
        if (res.missing) setSchemaError(true);
    });

    return () => {
        window.removeEventListener('resize', handleResize);
        clearInterval(checkInterval);
    };
  }, []);

  const handleCopySQL = () => {
      const sql = `
-- 1. RESET BẢNG CŨ (QUAN TRỌNG: Để sửa lỗi kiểu dữ liệu)
DROP TABLE IF EXISTS room_recipes CASCADE;
DROP TABLE IF EXISTS service_items CASCADE;

-- 2. TẠO LẠI BẢNG Service Items (Kho)
CREATE TABLE service_items (
  id TEXT PRIMARY KEY,
  name TEXT,
  price NUMERIC DEFAULT 0,
  costprice NUMERIC DEFAULT 0,
  unit TEXT,
  stock NUMERIC DEFAULT 0,
  minstock NUMERIC DEFAULT 0,
  category TEXT,
  totalassets NUMERIC DEFAULT 0,
  laundrystock NUMERIC DEFAULT 0,
  in_circulation NUMERIC DEFAULT 0,
  default_qty NUMERIC DEFAULT 0
);

-- 3. TẠO LẠI BẢNG Room Recipes (Định mức)
CREATE TABLE room_recipes (
  id TEXT PRIMARY KEY,
  description TEXT,
  items_json JSONB DEFAULT '[]'
);

-- 4. BẢNG Settings
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  raw_json JSONB
);

-- 5. Cập nhật Booking (Các cột mới)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lendingJson TEXT DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guestsJson TEXT DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS isDeclared BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS groupId TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS groupName TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS isGroupLeader BOOLEAN DEFAULT FALSE;

-- 6. Cập nhật Phòng
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS view TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS price_saturday NUMERIC;

-- 7. Cấp quyền
ALTER TABLE room_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for users" ON room_recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for users" ON service_items FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
`;
      navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

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
      
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[95] transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-[100] md:relative 
        ${sidebarOpen ? 'translate-x-0 w-[280px] md:w-72' : '-translate-x-full md:translate-x-0 md:w-20'} 
        transition-all duration-300 ease-spring shrink-0
      `}>
        <Sidebar isOpen={sidebarOpen} toggle={toggleSidebar} />
      </div>
      
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

        {isMockData && (
            <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 animate-pulse">
                <AlertOctagon size={16}/> MẤT KẾT NỐI DATABASE - DỮ LIỆU ĐANG LƯU TRÊN RAM (SẼ MẤT KHI F5)
            </div>
        )}

        {schemaError && !isMockData && (
            <div className="bg-amber-50 border-b border-amber-200 p-4 animate-in slide-in-from-top">
                <div className="flex items-start gap-3 max-w-5xl mx-auto">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0 mt-1">
                        <AlertTriangle size={20}/>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">Cập nhật Database cần thiết</h3>
                        <p className="text-xs text-amber-700 mt-1 mb-2 leading-relaxed">
                            Hệ thống phát hiện Database thiếu bảng hoặc cột dữ liệu (cho tính năng Cấu hình, Định mức, Kho...). 
                            Vui lòng chạy lệnh sau trong <b>Supabase SQL Editor</b> để khắc phục:
                        </p>
                        
                        <div className="relative group">
                            <div className="absolute right-2 top-2">
                                <button 
                                    onClick={handleCopySQL}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded shadow-sm border border-slate-200 transition-all"
                                >
                                    {copied ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                                    {copied ? 'Đã chép' : 'Sao chép SQL'}
                                </button>
                            </div>
                            <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg text-[10px] font-mono overflow-x-auto border border-slate-700 leading-relaxed custom-scrollbar">
{`-- 1. RESET BẢNG CŨ (QUAN TRỌNG: Để sửa lỗi kiểu dữ liệu)
DROP TABLE IF EXISTS room_recipes CASCADE;
DROP TABLE IF EXISTS service_items CASCADE;

-- 2. TẠO LẠI BẢNG Service Items (Kho)
CREATE TABLE service_items (
  id TEXT PRIMARY KEY,
  name TEXT,
  ... (Sao chép để lấy full)
`}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc] p-3 md:p-6 scroll-smooth">
          <div className="h-full w-full flex flex-col animate-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export const App = () => {
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

export default App;
