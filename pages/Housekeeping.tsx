
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import { 
  Brush, CheckCircle, Calculator, Copy, User, Filter, 
  CheckSquare, Square, LogOut, BedDouble, AlertCircle, X, Zap, RotateCcw, BarChart3, Clock, RefreshCw, AlertTriangle, Flame, Star, HelpCircle, ThumbsUp, ThumbsDown, Calendar
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { HousekeepingTask } from '../types';

// Trọng số công việc để tính lương/điểm
const WORKLOAD_POINTS = {
    Checkout: 4, 
    Dirty: 2,   
    Stayover: 1,
    Vacant: 0
};

type ExtendedTask = HousekeepingTask & { 
    facilityName: string, 
    availableStaff: string[],
    isInquiry?: boolean // New flag for Stayover Inquiry
};
type WorkloadData = { points: number, tasks: number, salary: number };

export const Housekeeping: React.FC = () => {
  const { 
    facilities, rooms, bookings, housekeepingTasks, 
    syncHousekeepingTasks, updateFacility, collaborators, 
    notify, refreshData, upsertRoom, isLoading, currentUser 
  } = useAppContext();
  
  const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Done'>('All');
  const [filterType, setFilterType] = useState<'All' | 'Checkout' | 'Stayover' | 'Dirty'>('All');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  const [showStats, setShowStats] = useState(false);
  const [prices, setPrices] = useState({ checkout: 30000, stayover: 20000, dirty: 15000 });

  // Tự động làm mới dữ liệu khi vào trang để đảm bảo đồng bộ
  useEffect(() => {
      refreshData(true);
  }, []);

  const housekeepingStaffNames = useMemo(() => {
      return collaborators
          .filter(c => c.role === 'Buồng phòng')
          .map(c => c.collaboratorName);
  }, [collaborators]);

  const displayTasks = useMemo(() => {
    const taskList: ExtendedTask[] = [];
    const todayStr = getTodayStr();
    const isViewingToday = selectedDate === todayStr;

    // 1. Map các task CÓ THỰC trong DB
    const existingTasksMap = new Map<string, HousekeepingTask>();
    
    housekeepingTasks.forEach(t => {
        const key = `${t.facility_id}_${t.room_code}`;
        const taskDateStr = format(parseISO(t.created_at), 'yyyy-MM-dd');
        
        // Logic: Lấy task đúng ngày HOẶC task cũ chưa xong (khi xem hôm nay)
        const isDateMatch = taskDateStr === selectedDate;
        const isBacklog = isViewingToday && t.status !== 'Done' && taskDateStr < selectedDate;

        if (isDateMatch || isBacklog) {
            // Ưu tiên task mới nhất nếu trùng
            existingTasksMap.set(key, t);
        }
    });

    // 2. Duyệt qua từng phòng để ghép Task hoặc tạo Virtual Task
    rooms.forEach((r) => {
      const f = facilities.find(fac => fac.id === r.facility_id);
      if (!f) return;

      const uniqueKey = `${f.id}_${r.name}`;
      const existingTask = existingTasksMap.get(uniqueKey);

      let validFacilityStaff = housekeepingStaffNames;
      if (f.staff && f.staff.length > 0) {
          validFacilityStaff = f.staff.filter(name => housekeepingStaffNames.includes(name));
          if (validFacilityStaff.length === 0) validFacilityStaff = housekeepingStaffNames;
      }

      // --- STAYOVER INQUIRY LOGIC ---
      // Tạo task "Hỏi dọn" nếu khách ở dài ngày và chưa có task nào hôm nay
      let inquiryTask: ExtendedTask | null = null;
      if (isViewingToday && !existingTask && r.status !== 'Sửa chữa' && r.status !== 'Bẩn' && r.status !== 'Đang dọn') {
           const activeBooking = bookings.find(b => {
               return b.facilityName === f.facilityName && b.roomCode === r.name && b.status === 'CheckedIn';
           });

           if (activeBooking) {
               const checkInDate = parseISO(activeBooking.checkinDate);
               const todayDate = parseISO(todayStr);
               const checkoutDate = parseISO(activeBooking.checkoutDate);
               
               // Logic: Khách đã đến trước hôm nay (checkIn < Today) VÀ chưa đi hôm nay (checkout > Today)
               const isStayover = format(checkInDate, 'yyyy-MM-dd') < todayStr && format(checkoutDate, 'yyyy-MM-dd') > todayStr;

               if (isStayover) {
                   inquiryTask = {
                       id: `INQUIRY_${uniqueKey}`,
                       facility_id: f.id,
                       room_code: r.name,
                       task_type: 'Stayover',
                       status: 'Pending',
                       assignee: null,
                       priority: 'Normal',
                       created_at: new Date().toISOString(),
                       note: 'Khách đang ở - Cần hỏi dọn phòng?',
                       facilityName: f.facilityName,
                       availableStaff: validFacilityStaff,
                       points: 1,
                       isInquiry: true // Đánh dấu là task hỏi
                   } as ExtendedTask;
               }
           }
      }

      // --- LOGIC HIỂN THỊ CHÍNH (DISPLAY LOGIC) ---
      
      // CASE 1: Đã có Task thực tế trong DB (Ưu tiên số 1)
      if (existingTask) {
          // Check: Nếu là task "Khách từ chối" (Done) -> Ẩn khỏi danh sách (để "biến mất" theo yêu cầu)
          const isRefusal = existingTask.status === 'Done' && existingTask.note === 'Khách từ chối dọn phòng';
          
          if (isRefusal) {
              // KHÔNG hiển thị gì cả -> Task biến mất.
              // Lưu ý: inquiryTask cũng sẽ không được tạo lại vì existingTaskMap đã có record này.
          } else {
              // Check: Nếu là task cũ treo trên phòng đã sạch -> Rác -> Ẩn
              const isGarbage = r.status === 'Đã dọn' && existingTask.status !== 'Done' && format(parseISO(existingTask.created_at), 'yyyy-MM-dd') < todayStr;
              
              if (!isGarbage) {
                  taskList.push({
                      ...existingTask,
                      facilityName: f.facilityName,
                      availableStaff: validFacilityStaff
                  });
              }
          }
      }
      // CASE 2: Chưa có Task, hiển thị Inquiry (Nếu thỏa mãn điều kiện Stayover)
      else if (inquiryTask) {
          taskList.push(inquiryTask);
      }
      // CASE 3: Chưa có Task, nhưng phòng Bẩn/Đang dọn -> Tạo Virtual Task (Chỉ hôm nay)
      else if (isViewingToday && (r.status === 'Bẩn' || r.status === 'Đang dọn')) {
          taskList.push({
              id: `VIRTUAL_${uniqueKey}_${Date.now()}`,
              facility_id: f.id,
              room_code: r.name,
              task_type: 'Dirty',
              status: r.status === 'Đang dọn' ? 'In Progress' : 'Pending',
              assignee: null,
              priority: 'High',
              created_at: new Date().toISOString(),
              note: 'Phòng đang báo Bẩn (Đồng bộ tự động)',
              facilityName: f.facilityName,
              availableStaff: validFacilityStaff,
              points: 2
          });
      }
      // CASE 4: Dự báo tương lai (Future)
      else {
          const activeBooking = bookings.find(b => {
              if (b.facilityName !== f.facilityName || b.roomCode !== r.name) return false;
              if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
              const checkinStr = format(parseISO(b.checkinDate), 'yyyy-MM-dd');
              const checkoutStr = format(parseISO(b.checkoutDate), 'yyyy-MM-dd');
              return (selectedDate >= checkinStr && selectedDate <= checkoutStr);
          });

          if (activeBooking) {
              const checkoutDay = format(parseISO(activeBooking.checkoutDate), 'yyyy-MM-dd');
              let type: HousekeepingTask['task_type'] = 'Stayover';
              let note = 'Dọn phòng khách đang ở';
              
              if (checkoutDay === selectedDate) {
                  type = 'Checkout';
                  note = `Khách sẽ trả phòng lúc ${format(parseISO(activeBooking.checkoutDate), 'HH:mm')}`;
              }

              if (r.status !== 'Sửa chữa') {
                  taskList.push({
                      id: `PREDICT_${uniqueKey}`,
                      facility_id: f.id,
                      room_code: r.name,
                      task_type: type,
                      status: 'Pending',
                      assignee: null,
                      priority: type === 'Checkout' ? 'High' : 'Normal',
                      created_at: new Date().toISOString(),
                      note: note,
                      facilityName: f.facilityName,
                      availableStaff: validFacilityStaff,
                      points: WORKLOAD_POINTS[type]
                  });
              }
          }
      }
    });

    return taskList.sort((a, b) => {
       // 0. Sắp xếp ưu tiên Inquiry lên đầu
       if (a.isInquiry && !b.isInquiry) return -1;
       if (!a.isInquiry && b.isInquiry) return 1;

       // 1. Sắp xếp theo Trạng thái: Đang làm -> Chờ -> Xong
       const sOrder = { 'In Progress': 0, 'Pending': 1, 'Done': 2 };
       if (sOrder[a.status] !== sOrder[b.status]) return (sOrder[a.status] ?? 3) - (sOrder[b.status] ?? 3);
       
       // 2. Sắp xếp theo ĐỘ ƯU TIÊN (Priority): High -> Normal -> Low
       const priMap = { 'High': 0, 'Normal': 1, 'Low': 2 };
       const priA = priMap[a.priority] ?? 1;
       const priB = priMap[b.priority] ?? 1;
       if (priA !== priB) return priA - priB;

       // 3. Sắp xếp theo Loại việc: Checkout -> Dirty -> Stayover
       const pOrder = { 'Checkout': 0, 'Dirty': 1, 'Stayover': 2, 'Vacant': 3 };
       return (pOrder[a.task_type] ?? 4) - (pOrder[b.task_type] ?? 4);
    });
  }, [facilities, rooms, bookings, selectedDate, housekeepingTasks, housekeepingStaffNames]);

  const filteredTasks = useMemo(() => {
     return displayTasks.filter(t => {
        if (filterStatus !== 'All' && t.status !== filterStatus) return false;
        if (filterType !== 'All') {
            if (filterType === 'Dirty') return t.task_type === 'Dirty'; 
            return t.task_type === filterType;
        }
        return true;
     });
  }, [displayTasks, filterStatus, filterType]);

  const workload = useMemo(() => {
      const load: Record<string, WorkloadData> = {};
      housekeepingStaffNames.forEach(s => load[s] = { points: 0, tasks: 0, salary: 0 });

      displayTasks.forEach(t => {
          if (t.assignee && housekeepingStaffNames.includes(t.assignee)) {
             if (!load[t.assignee]) load[t.assignee] = { points: 0, tasks: 0, salary: 0 };
             const pt = WORKLOAD_POINTS[t.task_type] || 0;
             load[t.assignee].points += pt;
             load[t.assignee].tasks += 1;
             if (t.status === 'Done') {
                let price = prices.dirty;
                if(t.task_type === 'Checkout') price = prices.checkout;
                if(t.task_type === 'Stayover') price = prices.stayover;
                load[t.assignee].salary += price;
             }
          }
      });
      return { load, staffList: housekeepingStaffNames };
  }, [displayTasks, prices, housekeepingStaffNames]);

  const handleTaskUpdate = async (task: typeof displayTasks[0], updates: Partial<HousekeepingTask>) => {
      // Logic xử lý task Ảo (VIRTUAL/PREDICT) thành Task Thật khi có tương tác
      const taskToSave: HousekeepingTask = {
          id: (task.id.startsWith('VIRTUAL_') || task.id.startsWith('PREDICT_')) ? crypto.randomUUID() : task.id,
          facility_id: task.facility_id,
          room_code: task.room_code,
          task_type: task.task_type,
          status: updates.status || task.status,
          assignee: updates.assignee !== undefined ? updates.assignee : task.assignee,
          priority: updates.priority || task.priority,
          created_at: task.id.startsWith('VIRTUAL_') ? new Date().toISOString() : task.created_at, // Reset time nếu là task ảo mới tạo
          completed_at: updates.status === 'Done' ? new Date().toISOString() : task.completed_at,
          note: task.note,
          points: WORKLOAD_POINTS[task.task_type]
      };

      if (updates.assignee && taskToSave.status === 'Pending') {
          taskToSave.status = 'In Progress';
      }

      // 1. Lưu task xuống DB
      await syncHousekeepingTasks([taskToSave]);

      // 2. Đồng bộ ngược trạng thái phòng (Quan trọng)
      const roomObj = rooms.find(r => r.facility_id === task.facility_id && r.name === task.room_code);
      if (roomObj) {
         let newRoomStatus = roomObj.status;
         if (taskToSave.status === 'Done') newRoomStatus = 'Đã dọn';
         else if (taskToSave.status === 'In Progress') newRoomStatus = 'Đang dọn';
         else if (taskToSave.status === 'Pending' && roomObj.status === 'Đã dọn') newRoomStatus = 'Bẩn'; // Nếu reopen task
         
         if (newRoomStatus !== roomObj.status) {
            await upsertRoom({ ...roomObj, status: newRoomStatus });
         }
      }
      
      notify('success', 'Đã cập nhật trạng thái đồng bộ.');
  };

  const handleStayoverResponse = async (task: ExtendedTask, isConfirmed: boolean) => {
      if (isConfirmed) {
          // A. KHÁCH CẦN DỌN:
          // Tạo task thật -> Trạng thái Pending (Chờ làm) -> Hiển thị trên bảng để phân công
          const realTask: HousekeepingTask = {
              id: crypto.randomUUID(),
              facility_id: task.facility_id,
              room_code: task.room_code,
              task_type: 'Stayover',
              status: 'Pending',
              priority: 'Normal',
              created_at: new Date().toISOString(),
              note: 'Khách yêu cầu dọn (Stayover)',
              points: 1,
              assignee: null
          };
          await syncHousekeepingTasks([realTask]);
          notify('success', `Đã tạo yêu cầu dọn phòng ${task.room_code}`);
      } else {
          // B. KHÁCH TỪ CHỐI:
          // Tạo task thật -> Trạng thái Done (Hoàn thành/Bỏ qua) -> BIẾN MẤT khỏi bảng
          const realTask: HousekeepingTask = {
              id: crypto.randomUUID(),
              facility_id: task.facility_id,
              room_code: task.room_code,
              task_type: 'Stayover',
              status: 'Done', 
              priority: 'Low',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              note: 'Khách từ chối dọn phòng',
              points: 0, 
              assignee: currentUser?.collaboratorName || 'System'
          };
          await syncHousekeepingTasks([realTask]);
          notify('info', `Đã ghi nhận khách từ chối dọn phòng ${task.room_code}`);
      }
  };

  const handleAutoAssign = async () => {
      const tasksByFac: Record<string, typeof displayTasks> = {};
      displayTasks.forEach(t => {
         if (t.status !== 'Done' && !t.assignee && !t.isInquiry) {
             if (!tasksByFac[t.facility_id]) tasksByFac[t.facility_id] = [];
             tasksByFac[t.facility_id].push(t);
         }
      });

      const tasksToUpdate: HousekeepingTask[] = [];

      Object.keys(tasksByFac).forEach(facId => {
          const tasks = tasksByFac[facId];
          if (tasks.length === 0) return;
          const availableStaffForFac = tasks[0].availableStaff; 
          if (availableStaffForFac.length === 0) return;

          // Sắp xếp ưu tiên High trước
          tasks.sort((a, b) => {
              const priMap = { 'High': 0, 'Normal': 1, 'Low': 2 };
              return (priMap[a.priority] ?? 1) - (priMap[b.priority] ?? 1);
          });

          const currentLoad: Record<string, number> = {};
          availableStaffForFac.forEach(s => currentLoad[s] = workload.load[s]?.points || 0);

          tasks.forEach(task => {
              let minLoad = Infinity;
              let selectedStaff = availableStaffForFac[0];
              availableStaffForFac.forEach(s => {
                  if (currentLoad[s] < minLoad) { minLoad = currentLoad[s]; selectedStaff = s; }
              });

              tasksToUpdate.push({
                  id: (task.id.startsWith('VIRTUAL_') || task.id.startsWith('PREDICT_')) ? crypto.randomUUID() : task.id,
                  facility_id: task.facility_id,
                  room_code: task.room_code,
                  task_type: task.task_type,
                  status: 'In Progress',
                  assignee: selectedStaff,
                  priority: task.priority,
                  created_at: task.id.startsWith('VIRTUAL_') ? new Date().toISOString() : task.created_at,
                  note: task.note,
                  points: WORKLOAD_POINTS[task.task_type]
              });
              currentLoad[selectedStaff] += (WORKLOAD_POINTS[task.task_type] || 0);
          });
      });

      if (tasksToUpdate.length > 0) {
          await syncHousekeepingTasks(tasksToUpdate);
          for (const t of tasksToUpdate) {
              const r = rooms.find(room => room.facility_id === t.facility_id && room.name === t.room_code);
              if (r) await upsertRoom({ ...r, status: 'Đang dọn' });
          }
          notify('success', `Đã phân công ${tasksToUpdate.length} phòng.`);
      } else {
          notify('info', 'Không có nhiệm vụ nào cần phân bổ.');
      }
  };

  const handleBulkAction = async (action: 'Assign' | 'Status', value: string) => {
      const tasks = displayTasks.filter(t => selectedTaskIds.includes(t.id));
      const updates: HousekeepingTask[] = [];
      tasks.forEach(t => {
          const newTask: HousekeepingTask = {
              id: (t.id.startsWith('VIRTUAL_') || t.id.startsWith('PREDICT_')) ? crypto.randomUUID() : t.id,
              facility_id: t.facility_id,
              room_code: t.room_code,
              task_type: t.task_type,
              status: action === 'Status' ? (value as any) : t.status,
              assignee: action === 'Assign' ? (value || null) : t.assignee,
              priority: t.priority,
              created_at: t.id.startsWith('VIRTUAL_') ? new Date().toISOString() : t.created_at,
              completed_at: (action === 'Status' && value === 'Done') ? new Date().toISOString() : undefined,
              note: t.note,
              points: WORKLOAD_POINTS[t.task_type]
          };
          if (action === 'Assign' && value) newTask.status = 'In Progress';
          updates.push(newTask);
      });
      await syncHousekeepingTasks(updates);
      
      for (const t of updates) {
          const r = rooms.find(room => room.facility_id === t.facility_id && room.name === t.room_code);
          if (r) {
              const newS = t.status === 'Done' ? 'Đã dọn' : t.status === 'In Progress' ? 'Đang dọn' : 'Bẩn';
              await upsertRoom({ ...r, status: newS });
          }
      }

      notify('success', 'Đã cập nhật hàng loạt.');
      setSelectedTaskIds([]);
  };

  const getCardStyle = (type: string, status: string, isInquiry?: boolean) => {
     if (isInquiry) return 'bg-sky-50 border-sky-300 ring-1 ring-sky-300';
     if (status === 'Done') return 'bg-white border-slate-200 opacity-60 grayscale';
     if (status === 'In Progress') return 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500';
     switch (type) {
        case 'Checkout': return 'bg-red-50 border-red-200 shadow-red-100';
        case 'Stayover': return 'bg-blue-50 border-blue-200 shadow-blue-100';
        case 'Dirty': return 'bg-yellow-50 border-yellow-200 shadow-yellow-100';
        default: return 'bg-white border-slate-200';
     }
  };

  return (
    <div className="space-y-6 animate-enter h-[calc(100vh-100px)] flex flex-col">
      {/* TOOLBAR - MOBILE OPTIMIZED (COMPACT HORIZONTAL SCROLL) */}
      <div className="md:hidden bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 mb-2">
          {/* Row 1: Header & Tools */}
          <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0"><Brush size={18} /></div>
                  <div>
                      <h1 className="text-sm font-bold text-slate-800 leading-tight">Điều phối BP</h1>
                      <div className="flex items-center gap-1 mt-0.5">
                          <Calendar size={10} className="text-slate-400"/>
                          <input type="date" className="text-xs font-medium text-slate-500 bg-transparent outline-none p-0 w-[85px]" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={() => refreshData()} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Reload"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                  <button onClick={() => setShowStats(true)} className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="Tính công"><Calculator size={18} /></button>
              </div>
          </div>

          {/* Row 2: Scrollable Actions/Filters OR Bulk Actions */}
          {selectedTaskIds.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 animate-in slide-in-from-right-5 fade-in">
                  <span className="shrink-0 text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1.5 rounded-lg border border-brand-100">{selectedTaskIds.length} chọn</span>
                  <select className="shrink-0 text-xs border border-brand-200 rounded-lg px-2 py-1.5 outline-none bg-white min-w-[100px]" onChange={(e) => handleBulkAction('Assign', e.target.value)} value="">
                      <option value="" disabled>-- Giao --</option>
                      {workload.staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="">(Hủy)</option>
                  </select>
                  <button onClick={() => handleBulkAction('Status', 'Done')} className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm">Xong</button>
                  <button onClick={() => setSelectedTaskIds([])} className="shrink-0 p-1.5 text-slate-400 bg-slate-50 rounded-lg"><X size={16}/></button>
              </div>
          ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  <button onClick={handleAutoAssign} className="shrink-0 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-transform">
                      <Zap size={12} className="fill-yellow-300 text-yellow-300" /> <span className="whitespace-nowrap">Tự động</span>
                  </button>
                  
                  <div className="w-[1px] h-5 bg-slate-200 flex-shrink-0 mx-1"></div>

                  {(['All', 'Checkout', 'Stayover', 'Dirty'] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                          {t === 'All' ? 'Tất cả' : t}
                      </button>
                  ))}
              </div>
          )}
      </div>

      {/* TOOLBAR - DESKTOP (ORIGINAL) */}
      <div className="hidden md:block bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Brush size={24} /></div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800">Điều phối Buồng phòng</h1>
                  <input type="date" className="text-sm font-medium text-slate-500 bg-transparent outline-none cursor-pointer" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={() => refreshData()} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100" title="Đồng bộ lại DB"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
               <button onClick={handleAutoAssign} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200 hover:from-violet-700 hover:to-indigo-700 transition-all active:scale-95 font-bold text-sm">
                  <Zap size={18} className="fill-yellow-300 text-yellow-300" /> Phân chia tự động
               </button>
               <button onClick={() => setShowStats(true)} className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200" title="Tính công"><Calculator size={20} /></button>
            </div>
         </div>
         
         <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-400 uppercase mr-1 flex items-center gap-1"><Filter size={12}/> Lọc:</span>
               {(['All', 'Checkout', 'Stayover', 'Dirty'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>{t === 'All' ? 'Tất cả' : t}</button>
               ))}
            </div>
            {selectedTaskIds.length > 0 && (
               <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                   <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">{selectedTaskIds.length} chọn</span>
                   <select className="text-xs border border-brand-200 rounded-lg px-2 py-1.5 outline-none bg-white min-w-[120px]" onChange={(e) => handleBulkAction('Assign', e.target.value)} value="">
                      <option value="" disabled>-- Giao cho --</option>
                      {workload.staffList.map(s => <option key={s} value={s}>{s}</option>)}
                      <option value="">(Hủy giao)</option>
                   </select>
                   <button onClick={() => handleBulkAction('Status', 'Done')} className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 shadow-sm">Xong hết</button>
                   <button onClick={() => setSelectedTaskIds([])} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={16}/></button>
               </div>
            )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
         {Object.entries(filteredTasks.reduce((acc, t) => {
             acc[t.facilityName] = acc[t.facilityName] || [];
             acc[t.facilityName].push(t);
             return acc;
         }, {} as Record<string, ExtendedTask[]>)).map(([facName, tasks]: [string, ExtendedTask[]]) => (
            <div key={facName} className="mb-6">
               <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm sticky top-0 bg-[#f8fafc] py-2 z-10">
                  <div className="w-1 h-4 bg-brand-500 rounded-full"></div> {facName} <span className="text-slate-400 font-normal text-xs">({tasks.length})</span>
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {tasks.map(task => {
                     const isSelected = selectedTaskIds.includes(task.id);
                     const isVirtual = task.id.startsWith('VIRTUAL_');
                     return (
                        <div key={task.id} onClick={() => !task.isInquiry && setSelectedTaskIds(prev => prev.includes(task.id) ? prev.filter(i => i !== task.id) : [...prev, task.id])}
                           className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer select-none group flex flex-col justify-between min-h-[120px] ${getCardStyle(task.task_type, task.status, task.isInquiry)} ${isSelected ? 'ring-2 ring-brand-500 ring-offset-2 border-brand-500 z-10' : 'hover:-translate-y-1 hover:shadow-md'}`}
                        >
                           {/* Priority & Select Checkbox */}
                           {!task.isInquiry && (
                               <div className="absolute top-2 right-2 flex items-center gap-1">
                                  {task.status !== 'Done' && (
                                      <button onClick={(e) => { e.stopPropagation(); handleTaskUpdate(task, { priority: task.priority === 'High' ? 'Normal' : 'High' }); }} className="p-1 hover:bg-slate-100 rounded-full transition-colors" title={task.priority === 'High' ? "Hủy ưu tiên" : "Đánh dấu ưu tiên"}>
                                          {task.priority === 'High' ? <Star size={16} className="text-yellow-400 fill-yellow-400 drop-shadow-sm"/> : <Star size={16} className="text-slate-300 hover:text-yellow-400"/>}
                                      </button>
                                  )}
                                  {isSelected ? <CheckSquare size={18} className="text-brand-600 fill-brand-100"/> : <div className="w-4 h-4 rounded border border-slate-300 group-hover:border-brand-400 bg-white/50"></div>}
                               </div>
                           )}

                           {task.priority === 'High' && task.status !== 'Done' && !task.isInquiry && (
                                <span className="absolute -top-2 -left-2 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-lg z-20 shadow-md flex items-center gap-1 animate-pulse border border-white">
                                    <Flame size={10} fill="currentColor" /> GẤP
                                </span>
                           )}

                           {/* Task Info */}
                           <div>
                              <div className="flex items-center gap-2 mb-1 mt-1">
                                  <span className={`text-xl font-bold ${task.isInquiry ? 'text-sky-700' : 'text-slate-800'}`}>{task.room_code}</span>
                                  {isVirtual && <span title="Đồng bộ tự động từ trạng thái phòng" className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
                                  {task.isInquiry && <span title="Cần hỏi ý kiến khách" className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>}
                              </div>
                              <div className="flex items-center gap-1.5 mb-1">
                                 {task.task_type === 'Checkout' && <LogOut size={14} className="text-red-500"/>}
                                 {task.task_type === 'Stayover' && <BedDouble size={14} className="text-blue-500"/>}
                                 {task.task_type === 'Dirty' && <AlertCircle size={14} className="text-yellow-500"/>}
                                 <span className={`text-xs font-bold uppercase ${task.task_type === 'Checkout' ? 'text-red-600' : task.isInquiry ? 'text-sky-600' : 'text-blue-600'}`}>
                                     {task.isInquiry ? 'Khách ở' : task.task_type}
                                 </span>
                              </div>
                              {task.note && <p className="text-[10px] text-slate-500 line-clamp-1 italic">{task.note}</p>}
                              {task.status === 'In Progress' && <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-bold animate-pulse"><Clock size={10}/> Đang dọn...</div>}
                           </div>

                           {/* ACTION AREA */}
                           {task.isInquiry ? (
                               <div className="mt-2 pt-2 border-t border-sky-200 flex items-center justify-between gap-2">
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleStayoverResponse(task, false); }}
                                      className="flex-1 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1"
                                   >
                                       <ThumbsDown size={12}/> Từ chối
                                   </button>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleStayoverResponse(task, true); }}
                                      className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 shadow-sm"
                                   >
                                       <ThumbsUp size={12}/> Cần dọn
                                   </button>
                               </div>
                           ) : (
                               <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 max-w-[60%]">
                                     <User size={12} className="text-slate-400 shrink-0"/>
                                     <select className="bg-transparent text-xs font-medium text-slate-700 outline-none w-full truncate cursor-pointer hover:text-brand-600"
                                        value={task.assignee || ''}
                                        onChange={(e) => handleTaskUpdate(task, { assignee: e.target.value })}
                                     >
                                        <option value="">--</option>
                                        {task.availableStaff.map(s => <option key={s} value={s}>{s}</option>)}
                                     </select>
                                  </div>
                                  <button onClick={() => handleTaskUpdate(task, { status: task.status === 'Done' ? 'Pending' : 'Done' })}
                                     className={`p-1.5 rounded-full transition-colors ${task.status === 'Done' ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-brand-600 hover:bg-brand-50'}`}
                                  >
                                     <CheckCircle size={16} fill={task.status === 'Done' ? 'currentColor' : 'none'} />
                                  </button>
                               </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            </div>
         ))}
      </div>

      {/* STATS BAR */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.03)]">
          <div className="flex gap-4 overflow-x-auto pb-1 custom-scrollbar">
              {workload.staffList.length === 0 && <span className="text-xs text-slate-400">Chưa có nhân viên Buồng phòng nào.</span>}
              {workload.staffList.map(staff => {
                  const info = workload.load[staff];
                  const maxPoints = Math.max(...Object.values(workload.load).map((w: any) => w.points), 1);
                  const percent = (info.points / maxPoints) * 100;
                  const color = info.points > 15 ? 'bg-red-500' : info.points > 8 ? 'bg-orange-500' : 'bg-green-500';
                  return (
                      <div key={staff} className="flex flex-col min-w-[120px]">
                          <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-slate-700 truncate max-w-[80px]">{staff}</span>
                              <span className="font-mono text-slate-500">{info.points}đ</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">{info.tasks} phòng</div>
                      </div>
                  )
              })}
          </div>
      </div>
      
      <Modal isOpen={showStats} onClose={() => setShowStats(false)} title={`Bảng Lương Dự Kiến (${format(new Date(selectedDate), 'dd/MM')})`} size="lg">
         <div className="space-y-6">
            <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                        <th className="p-3">Nhân viên</th>
                        <th className="p-3 text-center">Đã xong</th>
                        <th className="p-3 text-center">Điểm</th>
                        <th className="p-3 text-right">Lương (tạm tính)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {Object.entries(workload.load).map(([staff, data]: [string, WorkloadData]) => (
                        <tr key={staff}>
                            <td className="p-3 font-medium">{staff}</td>
                            <td className="p-3 text-center">{data.tasks}</td>
                            <td className="p-3 text-center font-bold text-slate-600">{data.points}</td>
                            <td className="p-3 text-right font-bold text-brand-600">{data.salary.toLocaleString()} ₫</td>
                        </tr>
                    ))}
                </tbody>
            </table>
         </div>
      </Modal>
    </div>
  );
};
