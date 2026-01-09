
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Plus, Search, Calendar, LayoutGrid, Filter, User, RotateCw, AlertCircle, CheckCircle, LogIn, LogOut, Moon, Clock, ShieldCheck, X, DollarSign, Brush, BedDouble, MoreVertical, Sparkles, ArrowRightLeft, Home, Briefcase, ShoppingCart, Pencil, Settings, Users, XCircle } from 'lucide-react';
import { addDays, format, parseISO, isSameDay, endOfDay, isWeekend, addMonths, endOfMonth, eachDayOfInterval, eachHourOfInterval, getHours, differenceInHours, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { BookingModal } from '../components/BookingModal';
import { SwapRoomModal } from '../components/SwapRoomModal'; // Import Component Mới
import { Booking, BookingStatus, Room, Guest } from '../types';

type CalendarViewMode = 'Day' | 'Week' | 'Month';

export const Bookings: React.FC = () => {
  const { bookings, facilities, rooms, housekeepingTasks, refreshData, upsertRoom, syncHousekeepingTasks, notify } = useAppContext();
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('grid'); // Default to Grid for Room Map preference
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('Day');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false); // State cho Swap Modal
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [swappingBooking, setSwappingBooking] = useState<Booking | null>(null); // Data cho Swap Modal
  const [modalInitialTab, setModalInitialTab] = useState<'info' | 'services' | 'payment'>('info'); // NEW STATE
  const [isCancellationMode, setIsCancellationMode] = useState(false); // New state for cancellation mode
  
  const [defaultBookingData, setDefaultBookingData] = useState<Partial<Booking>>({}); // For new bookings
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  
  // NEW: State cho bộ lọc ngày trong Grid View
  const [filterByDate, setFilterByDate] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Force Refresh on Mount to ensure DB sync
  useEffect(() => {
      refreshData();
      const interval = setInterval(() => setNow(new Date()), 60000); 
      return () => clearInterval(interval);
  }, []);

  // --- Date Range Calculation ---
  const dateRange = useMemo(() => {
      let start: Date, end: Date, columns: Date[];
      
      if (calendarMode === 'Day') {
          start = new Date(currentDate); start.setHours(0,0,0,0);
          end = endOfDay(currentDate);
          columns = eachHourOfInterval({ start, end }); // 24 hours
      } else if (calendarMode === 'Month') {
          start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          end = endOfMonth(currentDate);
          columns = eachDayOfInterval({ start, end });
      } else {
          // Week Default
          start = new Date(currentDate);
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          start.setHours(0,0,0,0);

          end = addDays(start, 6);
          columns = eachDayOfInterval({ start, end });
      }
      return { start, end, columns };
  }, [currentDate, calendarMode]);

  const navigateDate = (direction: number) => {
      if (calendarMode === 'Day') setCurrentDate(addDays(currentDate, direction));
      else if (calendarMode === 'Month') setCurrentDate(addMonths(currentDate, direction));
      else setCurrentDate(addDays(currentDate, direction * 7));
  };

  const filteredBookings = useMemo(() => {
    // 1. Lọc dữ liệu theo Search và Cơ sở
    const filtered = bookings.filter(b => {
      const customerName = b.customerName || '';
      const bookingId = b.id || '';
      const matchSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          bookingId.includes(searchTerm);
      const matchFacility = filterFacility ? b.facilityName === filterFacility : true;
      
      return matchSearch && matchFacility;
    });

    return filtered;
  }, [bookings, searchTerm, filterFacility]);

  // --- ROOM MAP LOGIC (CRITICAL FIX) ---
  const roomMapData = useMemo(() => {
      const displayFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);
      
      return displayFacilities.map(fac => {
          const facilityRooms = rooms.filter(r => r.facility_id === fac.id).sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
          
          const roomsWithStatus = facilityRooms.map(room => {
              // 1. Find active booking (LOGIC QUAN TRỌNG: Ưu tiên CheckedIn, sau đó mới tới Confirmed hôm nay)
              const activeBooking = bookings.find(b => {
                  if (b.facilityName !== fac.facilityName || b.roomCode !== room.name) return false;
                  if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false; // Bỏ qua đơn đã hủy/trả

                  // Nếu đang CheckedIn -> Luôn hiện (bất kể ngày nào, vì khách đang ở)
                  if (b.status === 'CheckedIn') return true;

                  // Nếu Confirmed -> Chỉ hiện nếu ngày Check-in trùng hôm nay hoặc đang trong khoảng thời gian ở (ví dụ checkin hôm qua nhưng chưa đổi status)
                  if (b.status === 'Confirmed') {
                      const checkin = parseISO(b.checkinDate);
                      const checkout = parseISO(b.checkoutDate);
                      // Checkin hôm nay HOẶC (Checkin < Now < Checkout)
                      return isSameDay(checkin, now) || (checkin <= now && checkout >= now);
                  }
                  return false;
              });

              // 2. Find pending booking (Next arrival)
              const nextBooking = !activeBooking ? bookings
                  .filter(b => b.facilityName === fac.facilityName && b.roomCode === room.name && b.status === 'Confirmed' && parseISO(b.checkinDate) > now)
                  .sort((a,b) => parseISO(a.checkinDate).getTime() - parseISO(b.checkinDate).getTime())[0] : null;

              // 3. Find active housekeeping task
              const activeTask = housekeepingTasks.find(t => 
                  t.facility_id === fac.id && 
                  t.room_code === room.name && 
                  t.status !== 'Done'
              );

              // 4. Determine Display Status
              let status: 'Vacant' | 'Occupied' | 'Reserved' | 'Dirty' | 'Cleanup' | 'Overdue' = 'Vacant';
              
              if (activeBooking) {
                  if (activeBooking.status === 'CheckedIn') {
                      status = 'Occupied';
                      if (now > parseISO(activeBooking.checkoutDate)) {
                          status = 'Overdue';
                      }
                  } else {
                      status = 'Reserved'; // Confirmed but not CheckedIn yet
                  }
              } else {
                  // Chỉ khi không có khách mới xét trạng thái dọn dẹp
                  if (room.status === 'Bẩn') status = 'Dirty';
                  else if (room.status === 'Đang dọn' || activeTask?.status === 'In Progress') status = 'Cleanup';
              }

              return {
                  ...room,
                  currentStatus: status,
                  booking: activeBooking,
                  nextBooking,
                  task: activeTask
              };
          });

          return {
              facility: fac,
              rooms: roomsWithStatus
          };
      });
  }, [facilities, rooms, bookings, housekeepingTasks, filterFacility, now]);

  // --- STATS CALCULATION (FIXED) ---
  const roomStats = useMemo(() => {
      let total = 0;
      let available = 0;
      let occupied = 0;
      let dirty = 0;
      let incoming = 0;
      let outgoing = 0;

      roomMapData.forEach(fac => {
          fac.rooms.forEach(r => {
              total++;
              
              // 1. Tính Occupied & Outgoing (Chỉ tính khi đã CheckedIn)
              if (r.booking && r.booking.status === 'CheckedIn') {
                  occupied++;
                  if (isSameDay(parseISO(r.booking.checkoutDate), now)) {
                      outgoing++;
                  }
              }

              // 2. Tính Incoming (Sắp đến)
              // TH1: Đã gán vào phòng (Reserved trên sơ đồ) nhưng chưa CheckIn
              if (r.booking && r.booking.status === 'Confirmed' && isSameDay(parseISO(r.booking.checkinDate), now)) {
                  incoming++;
              }
              // TH2: Chưa gán vào phòng chính (phòng đang trống/bẩn) nhưng có nextBooking hôm nay
              else if (!r.booking && r.nextBooking && isSameDay(parseISO(r.nextBooking.checkinDate), now)) {
                  incoming++;
              }

              // 3. Tính trạng thái phòng vật lý
              if (r.currentStatus === 'Dirty' || r.currentStatus === 'Cleanup') {
                  dirty++;
              } else if (r.currentStatus === 'Vacant') {
                  available++;
              }
          });
      });

      return { total, available, occupied, dirty, incoming, outgoing };
  }, [roomMapData, now]);

  // --- ACTIONS ---
  const handleQuickClean = async (room: Room) => {
      if (!confirm(`Xác nhận phòng ${room.name} đã dọn xong?`)) return;
      await upsertRoom({ ...room, status: 'Đã dọn' });
      
      // Auto close tasks
      const tasks = housekeepingTasks.filter(t => t.facility_id === room.facility_id && t.room_code === room.name && t.status !== 'Done');
      if (tasks.length > 0) {
          const closedTasks = tasks.map(t => ({ ...t, status: 'Done' as const, completed_at: new Date().toISOString() }));
          await syncHousekeepingTasks(closedTasks);
      }
      notify('success', `Đã cập nhật phòng ${room.name} sạch.`);
  };

  // Click Handler for Room Card
  const handleRoomClick = (room: any, facilityName: string) => {
      if (room.booking) {
          // Nếu có booking -> Mở Edit
          setEditingBooking(room.booking);
          setModalInitialTab('info'); // Default tab
          setDefaultBookingData({}); // Reset default data to ensure clean edit
          setIsCancellationMode(false);
          setIsModalOpen(true);
      } else {
          // Nếu phòng trống -> Mở New Booking với data điền sẵn
          setEditingBooking(null);
          setModalInitialTab('info');
          
          // Logic ngày mặc định: Checkin Now, Checkout Tomorrow Noon
          const checkin = new Date();
          const checkout = new Date();
          checkout.setDate(checkout.getDate() + 1);
          checkout.setHours(12, 0, 0, 0);

          setDefaultBookingData({
              facilityName: facilityName,
              roomCode: room.name,
              price: room.price || 0,
              checkinDate: checkin.toISOString(),
              checkoutDate: checkout.toISOString(),
              status: 'Confirmed'
          });
          setIsCancellationMode(false);
          setIsModalOpen(true);
      }
  };

  // NEW: Helper to open specific tabs
  const openBookingAction = (booking: Booking, tab: 'services' | 'payment') => {
      setEditingBooking(booking);
      setModalInitialTab(tab);
      setIsCancellationMode(false);
      setIsModalOpen(true);
  };

  // Helper to open cancellation mode
  const openBookingCancellation = (booking: Booking) => {
      setEditingBooking(booking);
      setIsCancellationMode(true);
      setModalInitialTab('info'); 
      setIsModalOpen(true);
  };

  // Handler for Swap Room Action
  const handleSwapClick = (booking: Booking, e: React.MouseEvent) => {
      e.stopPropagation(); // Stop trigging card click
      setSwappingBooking(booking);
      setIsSwapModalOpen(true);
  };

  // --- CORE LOGIC UPDATE: SYNC ROOM STATUS WITH HOUSEKEEPING TASKS ---
  const timelineRows = useMemo(() => {
    let rows: any[] = [];
    const displayFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);

    displayFacilities.forEach(facility => {
      rows.push({ type: 'facility', name: facility.facilityName });
      
      const facilityRooms = rooms
        .filter(r => r.facility_id === facility.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      facilityRooms.forEach((room) => {
        let displayStatus = room.status;
        const activeTask = housekeepingTasks.find(t => 
            t.facility_id === facility.id && 
            t.room_code === room.name && 
            t.status === 'In Progress'
        );
        if (activeTask && room.status !== 'Đã dọn') {
            displayStatus = 'Đang dọn';
        }

        rows.push({ 
          type: 'room', 
          facility: facility.facilityName,
          code: room.name,
          status: displayStatus, 
          price: room.price || facility.facilityPrice
        });
      });
    });
    return rows;
  }, [facilities, rooms, filterFacility, housekeepingTasks]);

  const getBookingsForRow = (facility: string, room: string) => {
    return filteredBookings.filter(b => b.facilityName === facility && b.roomCode === room);
  };

  const getViewConfig = () => {
      switch (calendarMode) {
          case 'Day': return { minWidth: 2400, colLabel: 'HH:mm' }; 
          case 'Week': return { minWidth: 1400, colLabel: 'dd/MM' }; 
          case 'Month': return { minWidth: 1800, colLabel: 'dd' }; 
      }
  };
  const viewConfig = getViewConfig();

  const getCurrentTimePositionPercent = () => {
    if (calendarMode === 'Day') {
        const minutes = now.getHours() * 60 + now.getMinutes();
        return (minutes / 1440) * 100;
    } 
    return -1; 
  };
  
  const getBookingStyle = (b: Booking, isActiveTime: boolean) => {
      const status = b.status || 'Confirmed';
      const isOverdue = status === 'CheckedIn' && now > parseISO(b.checkoutDate);
      
      let baseClass = "text-white shadow-sm border-transparent";
      
      if (status === 'CheckedOut') {
          baseClass = "bg-slate-400 border-slate-500 text-slate-100 opacity-70 grayscale";
      } else if (isOverdue) {
          baseClass = "bg-red-600 border-red-700 text-white animate-pulse shadow-red-500/50";
      } else if (status === 'CheckedIn') {
          baseClass = "bg-green-600 border-green-700 text-white shadow-green-500/30";
      } else {
          baseClass = "bg-blue-600 border-blue-700 text-white";
      }
      return baseClass;
  };

  // Reusable Compact Stats Component (Visible on Mobile)
  const CompactStatsBar = () => (
      <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-x-3 gap-y-2 w-full pb-2 md:hidden">
         <div className="flex items-center gap-2 bg-slate-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-slate-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-slate-400 shadow-sm"><Home size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-slate-500 uppercase">Trống:</span>
                 <span className="font-black text-slate-700 text-sm">{roomStats.available}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-emerald-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-emerald-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-emerald-600 shadow-sm"><User size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-emerald-600 uppercase">Đang ở:</span>
                 <span className="font-black text-emerald-700 text-sm">{roomStats.occupied}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-amber-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-amber-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-amber-600 shadow-sm"><Brush size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-amber-600 uppercase">Bẩn:</span>
                 <span className="font-black text-amber-700 text-sm">{roomStats.dirty}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-blue-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-blue-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-blue-600 shadow-sm"><Briefcase size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-blue-600 uppercase">Đến/Đi:</span>
                 <span className="font-black text-blue-700 text-sm">{roomStats.incoming} / {roomStats.outgoing}</span>
             </div>
         </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4 animate-enter">
      
      {/* HEADER SECTION - Unified or Specific */}
      {viewMode === 'grid' ? (
        // COMPACT HEADER FOR GRID VIEW
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-center shrink-0 z-20 relative animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-1 flex-wrap items-center gap-4 w-full xl:w-auto">
                 <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                     <button onClick={() => setViewMode('timeline')} className="p-2 rounded-md transition-all text-slate-500 hover:text-slate-700" title="Xem Lịch Timeline"><Calendar size={18}/></button>
                     <button onClick={() => setViewMode('grid')} className="p-2 rounded-md transition-all bg-white text-brand-600 shadow-sm font-medium" title="Sơ đồ phòng (Grid)"><LayoutGrid size={18}/></button>
                 </div>
                 <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                 {/* Stats */}
                 <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-x-3 md:gap-x-6 gap-y-2 w-full md:w-auto pb-1 md:pb-0">
                     {/* Reuse stats logic, but inline for Grid */}
                     <div className="flex items-center gap-2 bg-slate-50 rounded-lg pr-3 pl-1.5 py-1 border border-slate-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-slate-400 shadow-sm"><Home size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Trống:</span>
                             <span className="font-black text-slate-700 text-sm">{roomStats.available}</span>
                         </div>
                     </div>
                     {/* ... (Other stats similar to compact bar) ... */}
                     <div className="flex items-center gap-2 bg-emerald-50 rounded-lg pr-3 pl-1.5 py-1 border border-emerald-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-emerald-600 shadow-sm"><User size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-emerald-600 uppercase">Đang ở:</span>
                             <span className="font-black text-emerald-700 text-sm">{roomStats.occupied}</span>
                         </div>
                     </div>
                     <div className="flex items-center gap-2 bg-amber-50 rounded-lg pr-3 pl-1.5 py-1 border border-amber-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-amber-600 shadow-sm"><Brush size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-amber-600 uppercase">Bẩn:</span>
                             <span className="font-black text-amber-700 text-sm">{roomStats.dirty}</span>
                         </div>
                     </div>
                 </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto justify-end">
                <div className="relative group w-full md:max-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                    <input type="text" placeholder="Tìm..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50 focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <select className="appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer text-slate-700 font-medium min-w-[100px] md:min-w-[120px]" value={filterFacility} onChange={e => setFilterFacility(e.target.value)}>
                    <option value="">Tất cả</option>
                    {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
                </select>
                <button onClick={() => refreshData()} className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 shrink-0" title="Làm mới"><RotateCw size={18} /></button>
                <button onClick={() => { setEditingBooking(null); setDefaultBookingData({}); setIsCancellationMode(false); setIsModalOpen(true); }} className="bg-brand-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0">
                    <Plus size={18} /> <span className="hidden sm:inline">Đặt phòng</span>
                </button>
            </div>
        </div>
      ) : (
        // OPTIMIZED TIMELINE VIEW HEADER
        <>
            {/* 1. COMPACT STATS FOR MOBILE (Hidden on Desktop) */}
            <CompactStatsBar />

            {/* 2. BIG STATS FOR DESKTOP (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-4 gap-4 shrink-0">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phòng trống</div>
                        <div className="text-2xl font-black text-slate-800">{roomStats.available} <span className="text-sm font-medium text-slate-400">/ {roomStats.total}</span></div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Home size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div>
                        <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Đang ở</div>
                        <div className="text-2xl font-black text-slate-800">{roomStats.occupied}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><User size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <div>
                        <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Phòng bẩn</div>
                        <div className="text-2xl font-black text-slate-800">{roomStats.dirty}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Brush size={20}/></div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="flex-1">
                        <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Sắp đến / Đi</div>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                            <span className="flex items-center gap-1"><LogIn size={14} className="text-blue-500"/> {roomStats.incoming}</span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1"><LogOut size={14} className="text-rose-500"/> {roomStats.outgoing}</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Briefcase size={20}/></div>
                </div>
            </div>

            {/* 3. COMPACT TOOLBAR FOR TIMELINE */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center shrink-0 z-20 relative">
                <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 w-full xl:w-auto">
                    <div className="flex gap-3 w-full md:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                            <button onClick={() => setViewMode('timeline')} className="p-2 rounded-md transition-all bg-white text-brand-600 shadow-sm font-medium"><Calendar size={18}/></button>
                            <button onClick={() => setViewMode('grid')} className="p-2 rounded-md transition-all text-slate-500 hover:text-slate-700"><LayoutGrid size={18}/></button>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 flex-1 md:flex-none justify-center">
                            {(['Day', 'Week', 'Month'] as CalendarViewMode[]).map(m => (
                                <button key={m} onClick={() => setCalendarMode(m)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${calendarMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {m === 'Day' ? 'Ngày' : m === 'Week' ? 'Tuần' : 'Tháng'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden w-full md:w-auto">
                        <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft size={18} className="text-slate-500" /></button>
                        <span className="flex-1 px-4 text-sm font-semibold text-slate-700 min-w-[120px] text-center capitalize whitespace-nowrap">
                        {calendarMode === 'Day' ? format(currentDate, 'EEEE, dd/MM', { locale: vi }) : 
                            calendarMode === 'Month' ? format(currentDate, 'MMMM yyyy', { locale: vi }) : 
                            `${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM')}`}
                        </span>
                        <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-50 border-l border-slate-100"><ChevronRight size={18} className="text-slate-500"/></button>
                    </div>
                    
                    <button onClick={() => setCurrentDate(new Date())} className="hidden md:block text-xs font-semibold text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg border border-brand-200 transition-colors shrink-0">Hôm nay</button>
                </div>

                <div className="flex items-center gap-2 w-full xl:w-auto">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input type="text" placeholder="Tìm..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50 focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    
                    <select className="hidden md:block appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer text-slate-900 min-w-[120px]" value={filterFacility} onChange={e => setFilterFacility(e.target.value)}>
                        <option value="">Tất cả cơ sở</option>
                        {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
                    </select>

                    <button onClick={() => refreshData()} className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Làm mới"><RotateCw size={18} /></button>

                    <button onClick={() => { setEditingBooking(null); setDefaultBookingData({}); setIsCancellationMode(false); setIsModalOpen(true); }} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-brand-700 shadow-md transition-all active:scale-95 whitespace-nowrap">
                        <Plus size={18} /> <span className="hidden md:inline">Đặt phòng</span>
                    </button>
                </div>
            </div>
        </>
      )}

      {/* 2. MAIN VIEW AREA */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative z-0">
        
        {viewMode === 'timeline' ? (
          <div className="flex-1 overflow-auto relative custom-scrollbar" ref={scrollContainerRef}>
             {/* Sticky Header */}
             <div 
               className="sticky top-0 z-30 bg-white border-b border-slate-200 flex" 
               style={{ minWidth: `${viewConfig.minWidth}px` }}
             >
               {/* Corner Cell */}
               <div className="w-16 md:w-48 shrink-0 p-2 md:p-3 font-bold text-slate-700 border-r border-slate-200 bg-slate-50 sticky left-0 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.02)] flex items-center justify-center">
                  <span className="text-[10px] md:text-xs uppercase tracking-widest text-slate-400 text-center">Phòng<span className="hidden md:inline"> / Giờ</span></span>
               </div>

               {/* Time Columns Header */}
               <div className="flex-1 flex divide-x divide-slate-100">
                 {dateRange.columns.map(col => {
                   const isToday = isSameDay(col, new Date());
                   const isWknd = isWeekend(col);
                   const isCurrentHour = calendarMode === 'Day' && isToday && col.getHours() === now.getHours();

                   return (
                     <div 
                        key={col.toISOString()} 
                        className={`
                            flex-1 text-center py-2 text-xs font-bold border-b border-slate-100 relative group
                            ${isToday && calendarMode !== 'Day' ? 'bg-blue-50/30' : isWknd ? 'bg-slate-50/50' : ''} 
                            ${isCurrentHour ? 'bg-red-50 text-red-600' : 'text-slate-600'}
                        `}
                     >
                       <div className="relative z-10">
                           {calendarMode === 'Day' ? format(col, 'HH:mm') : format(col, 'dd/MM')}
                           {calendarMode === 'Week' && <div className="text-[9px] font-normal text-slate-400 uppercase mt-0.5">{format(col, 'EEEE', {locale: vi})}</div>}
                       </div>
                       <div className="absolute top-full left-1/2 w-[1px] h-[1000px] bg-brand-500/20 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none z-0"></div>
                     </div>
                   );
                 })}
               </div>
             </div>

             {/* Timeline Body */}
             <div 
                className="relative bg-[linear-gradient(90deg,transparent_49%,rgba(241,245,249,0.5)_50%,transparent_51%)] bg-[length:calc(100%/24)_100%]" 
                style={{ 
                    minWidth: `${viewConfig.minWidth}px`,
                    backgroundSize: calendarMode === 'Day' ? `calc(100% / 24) 100%` : 
                                    calendarMode === 'Week' ? `calc(100% / 7) 100%` : 
                                    `calc(100% / ${dateRange.columns.length}) 100%`
                }}
             >
               
               {/* GLOBAL CURRENT TIME RED LINE */}
               {isSameDay(currentDate, now) && (
                  <div className="absolute inset-0 flex pointer-events-none z-20">
                      <div className="w-16 md:w-48 shrink-0"></div>
                      <div className="flex-1 relative h-full">
                          <div 
                            className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] transition-all duration-1000 ease-linear"
                            style={{ left: `${getCurrentTimePositionPercent()}%` }}
                          >
                             <div className="absolute -top-[5px] -translate-x-1/2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-50">
                                {format(now, 'HH:mm')}
                             </div>
                             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                          </div>
                      </div>
                  </div>
               )}

               {timelineRows.map((row, idx) => {
                 if(row.type === 'facility') return (
                   <div key={idx} className="bg-slate-100/90 backdrop-blur-sm px-4 py-2 font-bold text-sm text-slate-800 border-y border-slate-200 sticky left-0 z-20 w-full text-left uppercase tracking-wider shadow-sm">
                     {row.name}
                   </div>
                 );

                 return (
                   <div key={idx} className="flex border-b border-slate-100 min-h-[60px] md:min-h-[80px] hover:bg-slate-50/50 transition-colors group relative">
                     <div className={`
                        w-16 md:w-48 shrink-0 border-r border-slate-200 p-1 md:p-3 flex flex-col justify-center sticky left-0 z-20 transition-all shadow-[4px_0_5px_rgba(0,0,0,0.01)] group-hover:bg-white text-center md:text-left
                        ${row.status === 'Đã dọn' ? 'bg-white' : row.status === 'Bẩn' ? 'bg-red-50/50' : row.status === 'Đang dọn' ? 'bg-blue-50/50' : 'bg-yellow-50/50'}
                     `}>
                       <div className="flex flex-col md:flex-row md:justify-between items-center mb-1">
                          <span className="font-bold text-xs md:text-lg text-slate-800 break-all">{row.code}</span>
                          <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full mt-1 md:mt-0 ${row.status === 'Đã dọn' ? 'bg-green-500' : row.status === 'Bẩn' ? 'bg-red-500' : row.status === 'Đang dọn' ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                       </div>
                       <div className="flex justify-between items-baseline hidden md:flex">
                          <span className="text-[10px] text-slate-400 font-medium">Giá chuẩn:</span>
                          <span className="text-xs font-bold text-slate-600">{(row.price || 0).toLocaleString()}</span>
                       </div>
                       <span className={`text-[9px] px-1 py-0.5 rounded mt-1 w-fit font-bold uppercase tracking-wider hidden md:block
                            ${row.status === 'Đã dọn' ? 'bg-green-100 text-green-700' : 
                              row.status === 'Bẩn' ? 'bg-red-100 text-red-700' : 
                              row.status === 'Đang dọn' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}
                          `}>
                            {row.status}
                       </span>
                     </div>
                     
                     <div className="flex-1 relative">
                         <div className="absolute inset-0 flex divide-x divide-slate-100 pointer-events-none">
                            {dateRange.columns.map((c, i) => <div key={i} className="flex-1"></div>)}
                         </div>

                         {getBookingsForRow(row.facility, row.code).map(booking => {
                              const bookingStart = parseISO(booking.checkinDate);
                              const bookingEnd = parseISO(booking.checkoutDate);
                              const isOverdue = booking.status === 'CheckedIn' && now > bookingEnd;
                              
                              let leftPercent = 0;
                              let widthPercent = 0;

                              if (calendarMode === 'Day') {
                                  const dayStart = new Date(currentDate); dayStart.setHours(0,0,0,0);
                                  const dayEnd = endOfDay(currentDate);
                                  
                                  if (bookingEnd <= dayStart || bookingStart >= dayEnd) return null;

                                  const effectiveStart = bookingStart < dayStart ? dayStart : bookingStart;
                                  const effectiveEnd = bookingEnd > dayEnd ? dayEnd : bookingEnd;

                                  const startMins = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
                                  const durationMins = (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
                                  
                                  leftPercent = (startMins / 1440) * 100;
                                  widthPercent = (durationMins / 1440) * 100;
                              } else {
                                  const viewStart = dateRange.start;
                                  const viewEnd = dateRange.end;
                                  const totalDuration = viewEnd.getTime() - viewStart.getTime();

                                  if (bookingEnd <= viewStart || bookingStart >= viewEnd) return null;

                                  const effectiveStart = bookingStart < viewStart ? viewStart : bookingStart;
                                  const effectiveEnd = bookingEnd > viewEnd ? viewEnd : bookingEnd;

                                  leftPercent = ((effectiveStart.getTime() - viewStart.getTime()) / totalDuration) * 100;
                                  widthPercent = ((effectiveEnd.getTime() - effectiveStart.getTime()) / totalDuration) * 100;
                              }

                              const isActive = now >= bookingStart && now < bookingEnd;
                              const cardStyle = getBookingStyle(booking, isActive);

                              return (
                                <div 
                                  key={booking.id}
                                  className={`
                                    absolute top-1 bottom-1 md:top-2 md:bottom-2 rounded-md md:rounded-lg border text-xs overflow-hidden z-10 cursor-pointer 
                                    hover:z-50 hover:scale-[1.02] hover:shadow-xl transition-all duration-200 group/booking
                                    flex flex-col justify-center px-1 md:px-2
                                    ${cardStyle}
                                  `}
                                  style={{ 
                                    left: `${leftPercent}%`, 
                                    width: `max(4px, ${widthPercent}%)`,
                                    zIndex: booking.status === 'CheckedOut' ? 5 : isOverdue ? 15 : 10
                                  }}
                                  onClick={() => { setEditingBooking(booking); setIsCancellationMode(false); setIsModalOpen(true); }}
                                >
                                  {widthPercent > 2 && ( 
                                      <>
                                          <div className="font-bold truncate text-[10px] md:text-[11px] leading-tight flex items-center gap-1">
                                            {isOverdue ? <AlertCircle size={10} className="shrink-0 animate-bounce" fill="white" stroke="red" /> : 
                                             booking.status === 'CheckedIn' ? <LogIn size={10} className="shrink-0"/> :
                                             booking.status === 'CheckedOut' ? <LogOut size={10} className="shrink-0"/> : null}
                                            <span className="truncate drop-shadow-md">{booking.customerName}</span>
                                            {booking.isDeclared && <ShieldCheck size={10} className="text-white fill-emerald-500 ml-1 shrink-0 hidden md:block" />}
                                          </div>
                                          {widthPercent > 5 && (
                                              <div className="text-[8px] md:text-[9px] opacity-90 truncate font-mono mt-0.5 flex justify-between hidden md:flex">
                                                  <span>{format(bookingStart, 'HH:mm')}</span>
                                                  <span>{format(bookingEnd, 'HH:mm')}</span>
                                              </div>
                                          )}
                                      </>
                                  )}
                                  
                                  {/* Tooltip */}
                                  <div className="hidden group-hover/booking:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-2xl z-[60] text-xs pointer-events-none">
                                     <div className="flex justify-between items-start mb-1">
                                         <div className="font-bold text-sm flex items-center gap-1">
                                             {booking.customerName}
                                             {booking.isDeclared && <ShieldCheck size={12} className="text-emerald-400" />}
                                         </div>
                                         <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                                            ${booking.status === 'CheckedIn' ? 'bg-green-50 text-white' : 
                                              booking.status === 'CheckedOut' ? 'bg-slate-500 text-slate-200' : 'bg-blue-50 text-white'}
                                         `}>{booking.status === 'CheckedIn' ? 'Đang ở' : booking.status === 'CheckedOut' ? 'Đã trả' : 'Đã đặt'}</span>
                                     </div>
                                     {booking.groupName && <div className="text-xs text-purple-200 font-bold mb-1">Đoàn: {booking.groupName}</div>}
                                     <div className="text-slate-300 mb-2">{booking.customerPhone}</div>
                                     <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-600 pt-2">
                                        <div>IN: {format(bookingStart, 'HH:mm dd/MM')}</div>
                                        <div>OUT: {format(bookingEnd, 'HH:mm dd/MM')}</div>
                                     </div>
                                     {isOverdue && <div className="text-red-400 font-bold mt-1 uppercase">⚠ Quá giờ trả phòng!</div>}
                                     <div className="mt-2 text-right font-bold text-brand-400">{booking.totalRevenue.toLocaleString()} ₫</div>
                                     <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                  </div>
                                </div>
                              )
                         })}
                     </div>
                   </div>
                 )
               })}
             </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar p-2 md:p-4 bg-slate-50">
             {/* ROOM MAP (GRID VIEW) */}
             <div className="space-y-6 md:space-y-8">
                 {roomMapData.map((data) => (
                     <div key={data.facility.id}>
                         <div className="flex items-center gap-3 mb-3 md:mb-4 sticky top-0 bg-slate-50 py-2 z-10">
                             <div className="w-1 h-6 bg-brand-500 rounded-full"></div>
                             <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm md:text-base">{data.facility.facilityName}</h3>
                             <span className="text-[10px] md:text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.rooms.length} phòng</span>
                         </div>
                         {/* MOBILE OPTIMIZATION: grid-cols-2 on small screens */}
                         <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-4">
                             {data.rooms.map(room => {
                                 // Define Colors based on status
                                 let headerColor = 'bg-slate-100 border-slate-200 text-slate-600';
                                 let bodyBorder = 'border-slate-200';
                                 let statusLabel = 'Phòng trống';
                                 
                                 if (room.currentStatus === 'Occupied') {
                                     headerColor = 'bg-emerald-600 border-emerald-600 text-white';
                                     bodyBorder = 'border-emerald-200';
                                     statusLabel = 'Đang có khách';
                                 } else if (room.currentStatus === 'Overdue') {
                                     headerColor = 'bg-red-600 border-red-600 text-white animate-pulse';
                                     bodyBorder = 'border-red-200 shadow-red-100';
                                     statusLabel = 'Quá giờ trả';
                                 } else if (room.currentStatus === 'Reserved') { // New Visual for Confirmed Today
                                     headerColor = 'bg-blue-600 border-blue-600 text-white';
                                     bodyBorder = 'border-blue-200';
                                     statusLabel = 'Sắp đến';
                                 } else if (room.currentStatus === 'Dirty') {
                                     headerColor = 'bg-amber-100 border-amber-200 text-amber-800';
                                     bodyBorder = 'border-amber-200';
                                     statusLabel = 'Chưa dọn';
                                 } else if (room.currentStatus === 'Cleanup') {
                                     headerColor = 'bg-blue-100 border-blue-200 text-blue-800';
                                     bodyBorder = 'border-blue-200';
                                     statusLabel = 'Đang dọn';
                                 }

                                 const b = room.booking;
                                 const percentTime = b ? Math.min(100, Math.max(0, (now.getTime() - parseISO(b.checkinDate).getTime()) / (parseISO(b.checkoutDate).getTime() - parseISO(b.checkinDate).getTime()) * 100)) : 0;

                                 // Logic tính số lượng khách
                                 let guestStats = { total: 0, male: 0, female: 0, other: 0 };
                                 if (b && b.guestsJson) {
                                     try {
                                         const guests: Guest[] = JSON.parse(b.guestsJson);
                                         guestStats.total = guests.length;
                                         guests.forEach(g => {
                                             const gender = (g.gender || '').toLowerCase();
                                             if (gender.includes('nam')) guestStats.male++;
                                             else if (gender.includes('nữ')) guestStats.female++;
                                             else guestStats.other++;
                                         });
                                     } catch (e) {}
                                 }

                                 return (
                                     <div key={room.id} className={`bg-white rounded-xl border-2 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-lg group ${bodyBorder} relative min-h-[140px] md:min-h-[180px]`}>
                                         
                                         {/* Card Header - Updated with Action Buttons */}
                                         <div className={`px-2 py-2 md:px-4 md:py-3 flex justify-between items-start border-b ${headerColor} relative overflow-hidden`}>
                                             {/* GROUP BADGE */}
                                             {b?.groupName && (
                                                 <div className="absolute top-0 left-0 bg-purple-600 text-white text-[8px] md:text-[9px] px-1.5 md:px-2 py-0.5 rounded-br-lg font-bold z-10 shadow-sm uppercase tracking-wider">
                                                     {b.groupName}
                                                 </div>
                                             )}

                                             <div className={b?.groupName ? 'mt-2 md:mt-3' : ''}>
                                                 <div className="text-lg md:text-2xl font-black leading-none">{room.name}</div>
                                                 <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1 flex items-center gap-1 whitespace-nowrap">
                                                     {statusLabel}
                                                     {b?.isDeclared && <ShieldCheck size={10} fill="currentColor" className="text-white hidden md:block"/>}
                                                 </div>
                                             </div>
                                             <div className="text-right flex flex-col items-end gap-1">
                                                 {/* ACTION GROUP (SWAP ONLY - VISIBLE ON HOVER) */}
                                                 {b && (
                                                     <div className="flex gap-1 mb-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                                                         <button 
                                                            onClick={(e) => handleSwapClick(b, e)}
                                                            className="p-1 md:p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors shadow-sm"
                                                            title="Đổi phòng"
                                                         >
                                                             <ArrowRightLeft size={12} className="md:w-[14px] md:h-[14px]"/>
                                                         </button>
                                                     </div>
                                                 )}
                                                 
                                                 <div className="text-[8px] md:text-[10px] font-bold opacity-80 uppercase hidden md:block">{room.type}</div>
                                             </div>
                                         </div>

                                         {/* Card Body - CLICK TO BOOK */}
                                         <div className="p-2 md:p-4 flex-1 flex flex-col cursor-pointer" onClick={() => handleRoomClick(room, data.facility.facilityName)}>
                                             {b ? (
                                                 <div className="space-y-1.5 md:space-y-3">
                                                     <div>
                                                         <div className="font-bold text-slate-800 text-xs md:text-sm truncate" title={b.customerName}>{b.customerName}</div>
                                                         
                                                         {/* NEW: Guest Info Badge */}
                                                         {guestStats.total > 0 && (
                                                             <div className="flex items-center gap-2 mt-1 text-[9px] md:text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md w-fit border border-slate-100 shadow-sm">
                                                                 <div className="flex items-center gap-1" title={`${guestStats.total} Khách`}>
                                                                     <Users size={10} className="text-slate-400 md:w-[12px] md:h-[12px]"/> {guestStats.total}
                                                                 </div>
                                                                 {/* Hide detail on mobile to save space */}
                                                                 <div className="hidden md:flex items-center gap-0.5 text-blue-600 pl-2 border-l border-slate-200">
                                                                     <span className="text-[9px]">Nam</span> {guestStats.male}
                                                                 </div>
                                                                 <div className="hidden md:flex items-center gap-0.5 text-rose-500 pl-2 border-l border-slate-200">
                                                                     <span className="text-[9px]">Nữ</span> {guestStats.female}
                                                                 </div>
                                                             </div>
                                                         )}

                                                         <div className="flex justify-between items-center text-[9px] md:text-[10px] text-slate-500 font-medium mt-1">
                                                             <span>{format(parseISO(b.checkinDate), 'dd/MM')}</span>
                                                             <span className="text-slate-300">➜</span>
                                                             <span>{format(parseISO(b.checkoutDate), 'dd/MM')}</span>
                                                         </div>
                                                     </div>
                                                     
                                                     {/* Time Progress */}
                                                     <div className="h-1 md:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                         <div className={`h-full ${room.currentStatus === 'Overdue' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${percentTime}%`}}></div>
                                                     </div>

                                                     {/* Payment Status */}
                                                     {b.remainingAmount > 0 ? (
                                                         <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 md:p-2 flex items-center justify-between">
                                                             <div className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase">Chưa TT</div>
                                                             <div className="text-[10px] md:text-xs font-black text-red-700">{(b.remainingAmount/1000).toFixed(0)}k</div>
                                                         </div>
                                                     ) : (
                                                         <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-1.5 md:p-2 flex items-center justify-between">
                                                             <div className="text-[9px] md:text-[10px] font-bold text-emerald-600 uppercase">Đã TT</div>
                                                             <div className="text-[10px] md:text-xs font-black text-emerald-700"><CheckCircle size={12}/></div>
                                                         </div>
                                                     )}
                                                 </div>
                                             ) : (
                                                 <div className="flex-1 flex flex-col items-center justify-center text-center py-2 opacity-50 hover:opacity-100 transition-opacity">
                                                     {room.currentStatus === 'Dirty' ? (
                                                         <>
                                                             <Brush size={24} className="text-amber-400 mb-1 md:w-[32px] md:h-[32px] md:mb-2"/>
                                                             <span className="text-[10px] md:text-xs font-bold text-amber-600">Cần dọn</span>
                                                         </>
                                                     ) : room.currentStatus === 'Cleanup' ? (
                                                         <>
                                                             <Sparkles size={24} className="text-blue-400 mb-1 animate-pulse md:w-[32px] md:h-[32px] md:mb-2"/>
                                                             <span className="text-[10px] md:text-xs font-bold text-blue-600">Đang dọn...</span>
                                                         </>
                                                     ) : (
                                                         <>
                                                             <BedDouble size={24} className="text-slate-300 mb-1 md:w-[32px] md:h-[32px] md:mb-2"/>
                                                             <span className="text-[10px] md:text-xs font-bold text-slate-400">Sẵn sàng</span>
                                                             <span className="text-xs md:text-sm font-black text-brand-600 mt-0.5">{(room.price || 0).toLocaleString()}đ</span>
                                                         </>
                                                     )}
                                                 </div>
                                             )}
                                         </div>

                                         {/* Card Footer Actions */}
                                         <div className="border-t border-slate-100 p-1.5 md:p-2 bg-slate-50/50">
                                             {b ? (
                                                 <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                                                     <button 
                                                        onClick={(e) => { e.stopPropagation(); openBookingAction(b, 'services'); }}
                                                        className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-blue-100 text-blue-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-blue-50 transition-all hover:border-blue-200 uppercase tracking-tight"
                                                     >
                                                         <ShoppingCart size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Dịch vụ</span>
                                                     </button>
                                                     
                                                     {b.status === 'Confirmed' ? (
                                                         <button 
                                                            onClick={(e) => { e.stopPropagation(); openBookingCancellation(b); }}
                                                            className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-rose-100 text-rose-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-rose-50 transition-all hover:border-rose-200 uppercase tracking-tight"
                                                         >
                                                             <XCircle size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Hủy phòng</span>
                                                         </button>
                                                     ) : (
                                                         <button 
                                                            onClick={(e) => { e.stopPropagation(); openBookingAction(b, 'payment'); }}
                                                            className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-rose-100 text-rose-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-rose-50 transition-all hover:border-rose-200 uppercase tracking-tight"
                                                         >
                                                             <LogOut size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Trả phòng</span>
                                                         </button>
                                                     )}
                                                 </div>
                                             ) : (
                                                 <div className="flex">
                                                     <button 
                                                        onClick={() => handleQuickClean(room)}
                                                        disabled={room.currentStatus === 'Vacant'}
                                                        className={`flex-1 text-[9px] md:text-[10px] font-bold uppercase py-1.5 rounded transition-all flex items-center justify-center gap-1
                                                            ${room.currentStatus === 'Vacant' ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-emerald-600 shadow-sm border border-emerald-100 hover:bg-emerald-50'}
                                                        `}
                                                     >
                                                         <CheckCircle size={12} className="md:w-[12px] md:h-[12px]"/> <span className="hidden sm:inline">Báo sạch</span>
                                                     </button>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
        )}
      </div>

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setIsCancellationMode(false); }} 
        booking={editingBooking}
        defaultData={defaultBookingData} 
        initialTab={modalInitialTab} 
        initialCancellation={isCancellationMode}
      />

      {swappingBooking && (
          <SwapRoomModal
            isOpen={isSwapModalOpen}
            onClose={() => setIsSwapModalOpen(false)}
            booking={swappingBooking}
          />
      )}
    </div>
  );
};
