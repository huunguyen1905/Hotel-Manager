
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, Calendar, Wallet, TrendingDown, Clock, LogIn, LogOut, BedDouble, 
  CreditCard, Brush, Package, CheckCircle2, ChevronRight, Zap, Star, DollarSign,
  UserX, ShieldAlert
} from 'lucide-react';
import { 
  format, endOfDay, endOfMonth, endOfYear, 
  eachDayOfInterval, isWithinInterval, isSameDay, parseISO, differenceInHours
} from 'date-fns';
import { vi } from 'date-fns/locale';

type TimeFilter = 'day' | 'month' | 'year';

export const Dashboard: React.FC = () => {
  const { bookings, rooms, expenses, services, leaveRequests } = useAppContext();
  const [filter, setFilter] = useState<TimeFilter>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  // --- CORE CALCULATION LOGIC (CEO VIEW) ---
  const dashboardData = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    let start: Date, end: Date;
    let chartData = [];

    if (filter === 'day') {
      start = new Date(selectedDate);
      start.setHours(0,0,0,0);
      end = endOfDay(selectedDate);
    } else if (filter === 'month') {
      start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      end = endOfMonth(selectedDate);
    } else {
      start = new Date(selectedDate.getFullYear(), 0, 1);
      end = endOfYear(selectedDate);
    }

    // 1. FINANCIALS
    let totalCashRevenue = 0;
    let totalTransferRevenue = 0;
    let totalRevenue = 0;
    let totalExpense = 0;
    let totalBookingValue = 0;
    
    bookings.forEach(b => {
      const payments = JSON.parse(b.paymentsJson || '[]');
      payments.forEach((p: any) => {
        const pDate = new Date(p.ngayThanhToan);
        if (isWithinInterval(pDate, { start, end })) {
          const amount = Number(p.soTien);
          totalRevenue += amount;
          const isCash = p.method === 'Cash' || (!p.method && !(p.ghiChu || '').toLowerCase().match(/ck|chuyển|transfer|thẻ/));
          if (isCash) totalCashRevenue += amount;
          else totalTransferRevenue += amount;
        }
      });
      
      const bDate = b.actualCheckIn ? new Date(b.actualCheckIn) : new Date(b.checkinDate);
      if (isWithinInterval(bDate, { start, end }) && b.status !== 'Cancelled') {
        totalBookingValue += b.totalRevenue;
      }
    });

    expenses.forEach(e => {
      const eDate = new Date(e.expenseDate);
      if (isWithinInterval(eDate, { start, end })) totalExpense += e.amount;
    });

    // 2. OPERATIONAL KPI
    let checkinsToday = 0;
    let checkoutsToday = 0;
    let occupiedRooms = 0;
    const totalRoomsCount = rooms.length || 1;

    bookings.forEach(b => {
       if (b.status === 'Cancelled') return;
       
       // Sửa lỗi logic: Ưu tiên dùng thời gian thực tế (Actual) để tính KPI
       // Nếu khách đến/đi sớm hoặc muộn hơn lịch, Dashboard vẫn phải hiện đúng trong ngày đó
       const bIn = (b.actualCheckIn) ? parseISO(b.actualCheckIn) : parseISO(b.checkinDate);
       
       // Nếu đã Checkout thì dùng actualCheckOut, nếu chưa thì dùng lịch checkoutDate
       const bOut = (b.status === 'CheckedOut' && b.actualCheckOut) 
            ? parseISO(b.actualCheckOut) 
            : parseISO(b.checkoutDate);
       
       // Tính KPI Checkin/Checkout
       if (isSameDay(bIn, selectedDate)) checkinsToday++;
       if (isSameDay(bOut, selectedDate)) checkoutsToday++;
       
       // Tính KPI Công suất phòng (Chỉ tính những phòng ĐANG có khách trong khoảng thời gian xem)
       // Không tính phòng đã trả (CheckedOut)
       // Use native startOfDay logic
       const viewStart = new Date(bIn); viewStart.setHours(0,0,0,0);
       const viewEnd = endOfDay(bOut);
       
       if (isWithinInterval(selectedDate, { start: viewStart, end: viewEnd }) && b.status !== 'CheckedOut') {
          occupiedRooms++;
       }
    });

    const occupancyRate = Math.round((occupiedRooms / totalRoomsCount) * 100);

    // 3. HR INSIGHTS (NEW)
    const leavesToday = leaveRequests.filter(lr => 
        lr.status === 'Approved' && 
        todayStr >= lr.start_date && 
        todayStr <= lr.end_date
    );
    const pendingLeaves = leaveRequests.filter(lr => lr.status === 'Pending');

    // 4. CHART & FORECAST
    if (filter === 'month') {
       const days = eachDayOfInterval({ start, end });
       chartData = days.map(day => {
          let rev = 0;
          let forecast = 0;
          bookings.forEach(b => {
             const payments = JSON.parse(b.paymentsJson || '[]');
             payments.forEach((p: any) => {
                if(isSameDay(new Date(p.ngayThanhToan), day)) rev += Number(p.soTien);
             });
             // Forecast: Dự báo doanh thu dựa trên ngày Check-in của các đơn Confirmed/CheckedIn
             if(isSameDay(parseISO(b.checkinDate), day) && (b.status === 'Confirmed' || b.status === 'CheckedIn')) {
                forecast += b.totalRevenue;
             }
          });
          return { name: format(day, 'dd'), Revenue: rev, Forecast: forecast };
       });
    } else {
       for(let i=0; i< (filter === 'day' ? 24 : 12); i++) {
          chartData.push({ name: filter === 'day' ? `${i}h` : `T${i+1}`, Revenue: Math.random() * 500000, Forecast: Math.random() * 200000 });
       }
    }

    // 5. TODAY'S OPS (ALERTS)
    const alerts = {
        pendingLeaves, 
        leavesToday,   
        upcomingCheckouts: bookings.filter(b => b.status === 'CheckedIn' && isSameDay(parseISO(b.checkoutDate), today) && differenceInHours(parseISO(b.checkoutDate), today) <= 2),
        dirtyRooms: rooms.filter(r => r.status === 'Bẩn'),
        unpaidBookings: bookings.filter(b => b.status === 'CheckedIn' && b.remainingAmount > 0),
        lowStock: services.filter(s => (s.stock || 0) <= (s.minStock || 0))
    };

    return {
       totalRevenue, totalCashRevenue, totalTransferRevenue, totalExpense, totalBookingValue,
       netProfit: totalRevenue - totalExpense,
       checkinsToday, checkoutsToday, occupancyRate,
       alerts, chartData
    };
  }, [bookings, expenses, rooms, services, leaveRequests, filter, selectedDate]);

  // --- SUB-COMPONENTS ---
  const KPICard = ({ title, value, sub, icon: Icon, colorClass, trend, isMain, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`bg-white p-5 rounded-2xl shadow-soft border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer ${isMain ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
    >
       <div className="flex justify-between items-start mb-2">
          <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 text-opacity-100`}>
             <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
          </div>
          {trend && (
             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                +{trend}%
             </span>
          )}
       </div>
       <div>
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
          <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>
       </div>
    </div>
  );

  const AlertItem = ({ icon: Icon, color, title, desc, actionLabel, onClick }: any) => (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors group">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color} bg-opacity-10 ${color.replace('bg-', 'text-')}`}>
                <Icon size={18} />
            </div>
            <div>
                <div className="text-sm font-bold text-slate-700">{title}</div>
                <div className="text-[11px] text-slate-400">{desc}</div>
            </div>
        </div>
        {actionLabel && (
            <button 
                onClick={onClick}
                className="text-[11px] font-bold text-brand-600 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 transition-all flex items-center gap-1 shrink-0"
            >
                {actionLabel} <ChevronRight size={12}/>
            </button>
        )}
    </div>
  );

  return (
    <div className="space-y-6 animate-enter pb-10">
      
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
               Quản trị Hệ thống <Star size={20} className="text-yellow-400 fill-yellow-400" />
            </h1>
            <p className="text-slate-500 text-sm font-medium flex items-center gap-1">
               <Calendar size={14}/> {format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}
            </p>
         </div>

         <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
             {(['day', 'month', 'year'] as TimeFilter[]).map((f) => (
                <button
                   key={f}
                   onClick={() => setFilter(f)}
                   className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                      filter === f ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'
                   }`}
                >
                   {f === 'day' ? 'Ngày' : f === 'month' ? 'Tháng' : 'Năm'}
                </button>
             ))}
             <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
             <input 
                type={filter === 'day' ? "date" : filter === 'month' ? "month" : "number"}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none p-1"
                value={filter === 'day' ? format(selectedDate, 'yyyy-MM-dd') : filter === 'month' ? format(selectedDate, 'yyyy-MM') : format(selectedDate, 'yyyy')}
                onChange={e => setSelectedDate(new Date(e.target.value))}
             />
         </div>
      </div>

      {/* 2. KPI GRID (8 CARDS - Added Staff Leave) */}
      <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard 
                title="Thực thu (Dòng tiền)" 
                value={`${dashboardData.totalRevenue.toLocaleString()} ₫`} 
                sub={`TM: ${dashboardData.totalCashRevenue.toLocaleString()} | CK: ${dashboardData.totalTransferRevenue.toLocaleString()}`} 
                icon={Wallet} 
                colorClass="bg-blue-600 text-blue-600" 
                isMain 
                onClick={() => navigate('/bookings')}
              />
              <KPICard 
                title="Chi phí vận hành" 
                value={`${dashboardData.totalExpense.toLocaleString()} ₫`} 
                sub="Toàn bộ hóa đơn chi phí" 
                icon={TrendingDown} 
                colorClass="bg-red-500 text-red-500" 
                onClick={() => navigate('/expenses')}
              />
              <KPICard title="Lợi nhuận ròng" value={`${dashboardData.netProfit.toLocaleString()} ₫`} sub={dashboardData.netProfit >= 0 ? "Thặng dư tài chính" : "Đang thâm hụt"} icon={DollarSign} colorClass="bg-emerald-500 text-emerald-500" />
              <KPICard title="Giá trị Booking" value={`${dashboardData.totalBookingValue.toLocaleString()} ₫`} sub="Doanh số ghi nhận trong kỳ" icon={TrendingUp} colorClass="bg-indigo-500 text-indigo-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Công suất phòng" value={`${dashboardData.occupancyRate}%`} sub={`Đang ở ${dashboardData.occupancyRate}% tổng phòng`} icon={BedDouble} colorClass="bg-orange-500 text-orange-500" trend={12} />
              <KPICard title="Check-in Hôm nay" value={dashboardData.checkinsToday} sub="Lượt khách dự kiến đến" icon={LogIn} colorClass="bg-blue-500 text-blue-500" />
              <KPICard title="Check-out Hôm nay" value={dashboardData.checkoutsToday} sub="Lượt khách dự kiến trả (hoặc đã trả)" icon={LogOut} colorClass="bg-rose-500 text-rose-500" />
              <KPICard 
                  title="Nhân sự vắng mặt" 
                  value={dashboardData.alerts.leavesToday.length} 
                  sub={dashboardData.alerts.leavesToday.length > 0 ? dashboardData.alerts.leavesToday.map(r => r.staff_name).join(', ') : 'Đủ quân số'} 
                  icon={UserX} 
                  colorClass={dashboardData.alerts.leavesToday.length > 0 ? "bg-purple-500 text-purple-500" : "bg-slate-400 text-slate-400"} 
                  onClick={() => navigate('/collaborators')}
              />
          </div>
      </div>

      {/* 3. TODAY'S OPS & CHART SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* LEFT: TODAY'S OPS (Action Center) */}
         <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Zap size={20} className="text-brand-600 fill-brand-600"/> Today's Ops
                </h3>
                <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Trung tâm điều hành</span>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* PRIORITY ALERTS: HR */}
                {dashboardData.alerts.pendingLeaves.length > 0 && (
                    <AlertItem 
                        icon={ShieldAlert} 
                        color="bg-purple-600" 
                        title="Duyệt đơn nghỉ phép" 
                        desc={`${dashboardData.alerts.pendingLeaves.length} nhân viên đang chờ duyệt đơn`} 
                        actionLabel="Duyệt ngay" 
                        onClick={() => navigate('/collaborators')}
                    />
                )}

                {/* OPERATIONAL ALERTS */}
                {dashboardData.alerts.upcomingCheckouts.length > 0 && (
                    <AlertItem 
                        icon={Clock} 
                        color="bg-rose-500" 
                        title="Sắp Check-out" 
                        desc={`${dashboardData.alerts.upcomingCheckouts.length} phòng trả trong 2h tới`} 
                        actionLabel="Xử lý" 
                        onClick={() => navigate('/bookings')}
                    />
                )}
                {dashboardData.alerts.dirtyRooms.length > 0 && (
                    <AlertItem 
                        icon={Brush} 
                        color="bg-yellow-500" 
                        title="Phòng cần dọn" 
                        desc={`${dashboardData.alerts.dirtyRooms.length} phòng đang ở trạng thái bẩn`} 
                        actionLabel="Điều phối" 
                        onClick={() => navigate('/housekeeping')}
                    />
                )}
                {dashboardData.alerts.unpaidBookings.length > 0 && (
                    <AlertItem 
                        icon={CreditCard} 
                        color="bg-orange-500" 
                        title="Chưa thanh toán" 
                        desc={`${dashboardData.alerts.unpaidBookings.length} khách đang ở còn nợ tiền`} 
                        actionLabel="Thu tiền" 
                        onClick={() => navigate('/bookings')}
                    />
                )}
                {dashboardData.alerts.lowStock.length > 0 && (
                    <AlertItem 
                        icon={Package} 
                        color="bg-red-500" 
                        title="Hết hàng kho" 
                        desc={`${dashboardData.alerts.lowStock.length} vật tư sắp hết trong kho`} 
                        actionLabel="Nhập kho" 
                        onClick={() => navigate('/inventory')}
                    />
                )}
                
                {Object.values(dashboardData.alerts).every((a: any) => a.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <CheckCircle2 size={40} className="mb-2 text-green-300"/>
                        <p className="text-sm font-bold">Vận hành đang ổn định</p>
                    </div>
                )}
            </div>
            
            <button 
                onClick={() => navigate('/bookings')}
                className="mt-4 w-full py-3 bg-slate-50 border border-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all shrink-0"
            >
                Xem toàn bộ lịch trình hôm nay
            </button>
         </div>

         {/* RIGHT: REVENUE FORECAST CHART */}
         <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-soft border border-slate-100 h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                   <TrendingUp size={20} className="text-brand-600"/> 
                   Dòng tiền & Dự báo (Forecast)
                </h3>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-brand-500"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Thực thu</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-300"></div><span className="text-[10px] font-bold text-slate-400 uppercase">Dự báo</span></div>
                </div>
            </div>
            
            <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorFore" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} tickFormatter={v => `${v/1000}k`} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                        formatter={(value: number) => value.toLocaleString() + ' ₫'}
                     />
                     <Area type="monotone" dataKey="Forecast" name="Dự tính (Chưa về)" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorFore)" />
                     <Area type="monotone" dataKey="Revenue" name="Thực thu" stroke="#14b8a6" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-[11px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
                <span>Dữ liệu dựa trên thanh toán thực tế và lịch đặt phòng Confirmed</span>
                <span className="text-brand-600">HotelPro Analytics Engine v2.0</span>
            </div>
         </div>

      </div>
    </div>
  );
};
