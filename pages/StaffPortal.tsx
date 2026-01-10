
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, CheckCircle, Clock, MapPin, 
  ChevronRight, CheckSquare, Square, 
  ArrowLeft, ListChecks, Info, Shirt, Loader2, Beer, Package, Plus, Minus, RefreshCw, ArchiveRestore, LayoutDashboard, AlertTriangle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { HousekeepingTask, ChecklistItem, RoomRecipeItem, ServiceItem, LendingItem } from '../types';
import { storageService } from '../services/storage';
import { ROOM_RECIPES } from '../constants';

const DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: '1', text: 'Thay ga giường và vỏ gối', completed: false },
    { id: '2', text: 'Lau dọn nhà vệ sinh', completed: false },
    { id: '3', text: 'Hút bụi và Lau sàn', completed: false },
    { id: '4', text: 'Xịt thơm phòng', completed: false },
];

const PlayIcon = ({ size = 20, fill = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

export const StaffPortal: React.FC = () => {
  const { 
    facilities, rooms, housekeepingTasks, syncHousekeepingTasks, services, bookings,
    currentUser, setCurrentUser, notify, upsertRoom, 
    refreshData, isLoading, handleLinenExchange, processMinibarUsage, processCheckoutLinenReturn
  } = useAppContext();
  
  const [activeTask, setActiveTask] = useState<(HousekeepingTask & { facilityName: string, roomType?: string }) | null>(null);
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State quản lý tiêu hao (Minibar, Amenity)
  const [consumedItems, setConsumedItems] = useState<Record<string, number>>({});
  
  // State quản lý thu hồi đồ vải (Linen Return - Actual Count)
  const [returnedLinenCounts, setReturnedLinenCounts] = useState<Record<string, number>>({});

  const navigate = useNavigate();
  
  const handleLogout = () => {
    setCurrentUser(null);
    storageService.saveUser(null);
    navigate('/login');
  };

  const handleRefresh = async () => {
    try {
        await refreshData(false);
        notify('success', 'Đã cập nhật dữ liệu mới nhất');
    } catch (err) {
        notify('error', 'Không thể kết nối máy chủ');
    }
  };

  const myTasks = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const taskList: (HousekeepingTask & { facilityName: string, roomStatus: string, roomType: string })[] = [];

    const dbTasksMap = new Map<string, HousekeepingTask>();
    housekeepingTasks.forEach(t => {
        const tDate = format(parseISO(t.created_at), 'yyyy-MM-dd');
        if (t.status !== 'Done' || tDate === todayStr) {
            dbTasksMap.set(`${t.facility_id}_${t.room_code}`, t);
        }
    });

    rooms.forEach(room => {
        const facility = facilities.find(f => f.id === room.facility_id);
        if (!facility) return;
        
        // Logic: Nếu không phải Buồng phòng (vd Admin/Quản lý), hiển thị ALL tasks
        // Nếu là Buồng phòng, chỉ hiển thị task thuộc cơ sở được phân công (hoặc all nếu ko phân công)
        const canViewAll = currentUser?.role !== 'Buồng phòng';
        const isAssigned = !facility.staff || facility.staff.length === 0 || (currentUser && facility.staff.includes(currentUser.collaboratorName));
        
        if (!canViewAll && !isAssigned) return;

        if (room.status === 'Đã dọn') {
            const existingTask = dbTasksMap.get(`${room.facility_id}_${room.name}`);
            if (existingTask && existingTask.status === 'Done') {
                 taskList.push({
                    ...existingTask,
                    facilityName: facility.facilityName,
                    roomStatus: room.status,
                    roomType: room.type || '1GM8'
                });
            }
            return; 
        }

        if (room.status === 'Bẩn' || room.status === 'Đang dọn') {
            const existingTask = dbTasksMap.get(`${room.facility_id}_${room.name}`);
            if (existingTask) {
                taskList.push({
                    ...existingTask,
                    status: room.status === 'Đang dọn' ? 'In Progress' : existingTask.status === 'Done' ? 'Pending' : existingTask.status,
                    facilityName: facility.facilityName,
                    roomStatus: room.status,
                    roomType: room.type || '1GM8'
                });
            } else {
                taskList.push({
                    id: `VIRTUAL_${room.facility_id}_${room.name}`,
                    facility_id: room.facility_id,
                    room_code: room.name,
                    task_type: 'Dirty', 
                    status: room.status === 'Đang dọn' ? 'In Progress' : 'Pending',
                    assignee: currentUser?.collaboratorName || null,
                    priority: 'High',
                    created_at: new Date().toISOString(),
                    note: 'Phòng báo Bẩn (Tự động đồng bộ)',
                    facilityName: facility.facilityName,
                    roomStatus: room.status,
                    roomType: room.type || '1GM8'
                });
            }
        }
    });

    return taskList.sort((a,b) => {
        const sOrder = { 'In Progress': 0, 'Pending': 1, 'Done': 2 };
        if (sOrder[a.status] !== sOrder[b.status]) return (sOrder[a.status] ?? 3) - (sOrder[b.status] ?? 3);
        const pOrder = { 'Checkout': 0, 'Dirty': 1, 'Stayover': 2, 'Vacant': 3 };
        return (pOrder[a.task_type] ?? 4) - (pOrder[b.task_type] ?? 4);
    });
  }, [facilities, rooms, housekeepingTasks, currentUser]);

  const workloadStats = useMemo(() => {
    const total = myTasks.length;
    const completed = myTasks.filter(t => t.status === 'Done').length;
    return { total, completed, pending: total - completed };
  }, [myTasks]);

  // --- LOGIC LOAD CÔNG THỨC ---
  const recipeItems = useMemo(() => {
      if (!activeTask || !activeTask.roomType) return [];
      const recipe = ROOM_RECIPES[activeTask.roomType];
      if (!recipe) return [];

      // Map Recipe Items to Service Items details
      return recipe.items.map(rItem => {
          // Find service by ID first, then Name
          const service = services.find(s => s.id === rItem.itemId || s.name === rItem.itemId);
          return {
              ...service,
              requiredQty: rItem.quantity,
              fallbackName: rItem.itemId
          };
      });
  }, [activeTask, services]);

  // --- LOGIC LẤY DANH SÁCH THU HỒI (RECIPE + LENDING) ---
  const checkoutReturnList = useMemo(() => {
      if (!activeTask || activeTask.task_type !== 'Checkout') return [];
      
      const combinedMap = new Map<string, { id: string, name: string, qty: number, isExtra: boolean }>();

      // 1. Add Recipe Items (Standard)
      recipeItems.forEach(item => {
          if (item.category === 'Linen' || item.category === 'Asset') {
              const id = item.id || item.fallbackName;
              combinedMap.set(id, {
                  id: id,
                  name: item.name || item.fallbackName,
                  qty: item.requiredQty,
                  isExtra: false
              });
          }
      });

      // 2. Add Extra Lending Items from Booking
      // Find latest booking for this room that is CheckedOut today or CheckedIn
      const today = new Date();
      const booking = bookings.find(b => 
          b.facilityName === activeTask.facilityName && 
          b.roomCode === activeTask.room_code && 
          (b.status === 'CheckedIn' || (b.status === 'CheckedOut' && parseISO(b.checkoutDate).toDateString() === today.toDateString()))
      );

      if (booking && booking.lendingJson) {
          try {
              const lends: LendingItem[] = JSON.parse(booking.lendingJson);
              lends.forEach(l => {
                  if (l.quantity > 0) {
                      const existing = combinedMap.get(l.item_id);
                      if (existing) {
                          existing.qty += l.quantity;
                          existing.isExtra = true; // Mark as having extra
                      } else {
                          combinedMap.set(l.item_id, {
                              id: l.item_id,
                              name: l.item_name,
                              qty: l.quantity,
                              isExtra: true
                          });
                      }
                  }
              });
          } catch(e) {}
      }

      return Array.from(combinedMap.values());
  }, [activeTask, recipeItems, bookings]);

  // --- INITIALIZE ACTUAL COUNTS ON TASK OPEN ---
  useEffect(() => {
      if (activeTask?.task_type === 'Checkout' && checkoutReturnList.length > 0) {
          const initialCounts: Record<string, number> = {};
          checkoutReturnList.forEach(item => {
              initialCounts[item.id] = item.qty; // Default actual = expected (Full return)
          });
          setReturnedLinenCounts(initialCounts);
      } else {
          setReturnedLinenCounts({});
      }
  }, [activeTask, checkoutReturnList]);

  const openTaskDetail = (task: typeof myTasks[0]) => {
      if (task.status === 'Done') return;
      setActiveTask(task);
      const savedChecklist = task.checklist ? JSON.parse(task.checklist) : [...DEFAULT_CHECKLIST];
      setLocalChecklist(savedChecklist);
      setConsumedItems({}); // Reset consumables
  };

  const toggleCheckItem = (id: string) => {
      setLocalChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const updateConsumed = (itemId: string, delta: number) => {
      setConsumedItems(prev => {
          const current = prev[itemId] || 0;
          const next = Math.max(0, current + delta);
          return { ...prev, [itemId]: next };
      });
  };

  const updateReturnedLinen = (itemId: string, delta: number) => {
      setReturnedLinenCounts(prev => {
          const current = prev[itemId] || 0;
          const next = Math.max(0, current + delta);
          return { ...prev, [itemId]: next };
      });
  };

  const handleStartTask = async () => {
      if (!activeTask || isProcessing) return;
      setIsProcessing(true);
      try {
        const isVirtual = activeTask.id.startsWith('VIRTUAL_');
        const taskToSync: HousekeepingTask = {
            ...activeTask,
            id: isVirtual ? crypto.randomUUID() : activeTask.id,
            status: 'In Progress',
            started_at: new Date().toISOString(),
            assignee: currentUser?.collaboratorName || activeTask.assignee,
            points: 2
        };
        await Promise.all([
            syncHousekeepingTasks([taskToSync]),
            (async () => {
                const room = rooms.find(r => r.facility_id === activeTask.facility_id && r.name === activeTask.room_code);
                if (room && room.status !== 'Đang dọn') await upsertRoom({ ...room, status: 'Đang dọn' });
            })()
        ]);
        setActiveTask({ ...taskToSync, facilityName: activeTask.facilityName, roomType: activeTask.roomType });
        notify('info', `Đã bắt đầu dọn phòng ${activeTask.room_code}`);
      } catch (e) {
        notify('error', 'Có lỗi xảy ra, vui lòng thử lại');
      } finally {
        setIsProcessing(false);
      }
  };

  const handleComplete = async () => {
      if (!activeTask || isProcessing) return;
      
      // Validation: Bắt buộc check hết checklist
      if (localChecklist.some(i => !i.completed)) {
          if (!confirm('Bạn chưa hoàn thành hết checklist. Vẫn muốn hoàn tất?')) return;
      }

      setIsProcessing(true);
      try {
        // 1. Process Minibar & Amenities (Consumables)
        const itemsToProcess = (Object.entries(consumedItems) as [string, number][])
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => ({ itemId, qty }));
        
        await processMinibarUsage(activeTask.facilityName, activeTask.room_code, itemsToProcess);

        // 2. Process Linen Exchange / Return (Lost & Found Logic)
        let linenNote = '';
        if (activeTask.task_type === 'Checkout') {
            const missingItems: string[] = [];
            const returnItemsPayload: { itemId: string, qty: number }[] = [];

            checkoutReturnList.forEach(item => {
                const actual = returnedLinenCounts[item.id] ?? item.qty;
                const expected = item.qty;
                
                // Add to payload for warehouse return (Only what was actually found)
                if (actual > 0) {
                    returnItemsPayload.push({ itemId: item.name, qty: actual });
                }

                // Check Variance
                if (actual < expected) {
                    missingItems.push(`${item.name} x${expected - actual}`);
                }
            });

            if (returnItemsPayload.length > 0) {
                await processCheckoutLinenReturn(activeTask.facilityName, activeTask.room_code, returnItemsPayload);
                linenNote = ` (Thu hồi: ${returnItemsPayload.length} loại)`;
            }
            
            // Auto append Lost Item Note
            if (missingItems.length > 0) {
                linenNote += `\n[BÁO MẤT/HỎNG]: ${missingItems.join(', ')}`;
            }
        } else {
            // STAYOVER: Record consumption only (Manual input assumed for now)
        }
        
        // 3. Update Task Status
        const updatedTask: HousekeepingTask = {
            ...activeTask,
            status: 'Done',
            checklist: JSON.stringify(localChecklist),
            completed_at: new Date().toISOString(),
            linen_exchanged: activeTask.task_type === 'Checkout' ? checkoutReturnList.reduce((sum, i) => sum + (returnedLinenCounts[i.id] ?? i.qty), 0) : 0,
            note: (activeTask.note || '') + linenNote
        };

        await syncHousekeepingTasks([updatedTask]);

        // 4. Update Room Status
        const roomObj = rooms.find(r => r.facility_id === activeTask.facility_id && r.name === activeTask.room_code);
        if (roomObj) {
            await upsertRoom({ ...roomObj, status: 'Đã dọn' });
            notify('success', `Hoàn thành P.${activeTask.room_code}.`);
        }
        
        setActiveTask(null);
      } catch (e) {
        console.error(e);
        notify('error', 'Có lỗi xử lý. Vui lòng thử lại.');
      } finally {
        setIsProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans max-w-md mx-auto shadow-2xl relative">
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-200">
                    {currentUser?.collaboratorName?.charAt(0) || 'U'}
                </div>
                <div>
                    <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase">Housekeeper App</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{currentUser?.collaboratorName}</p>
                </div>
            </div>
            <div className="flex gap-2">
                {currentUser?.role !== 'Buồng phòng' && (
                    <button onClick={() => navigate('/dashboard')} className="p-2 text-slate-400 hover:text-brand-600 transition-colors" title="Về Dashboard">
                        <LayoutDashboard size={20} />
                    </button>
                )}
                <button onClick={handleRefresh} disabled={isLoading} className={`p-2 transition-colors ${isLoading ? 'text-brand-600 animate-spin' : 'text-slate-400 hover:text-brand-600'}`}>
                    <RefreshCw size={20} />
                </button>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>
        </header>

        <div className="p-4 pt-6">
            <div className={`rounded-2xl p-4 shadow-sm border bg-white border-slate-100`}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle className="text-green-500" size={16}/> Tiến độ dọn dẹp
                    </h3>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-brand-100 text-brand-700`}>
                        {workloadStats.completed}/{workloadStats.total}
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 bg-brand-500`} style={{ width: `${(workloadStats.completed / (workloadStats.total || 1)) * 100}%` }}></div>
                </div>
            </div>
        </div>

        <div className="flex-1 px-4 pb-24 space-y-4 overflow-y-auto">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Cần thực hiện</h2>
            {myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={40} className="text-emerald-400" />
                    </div>
                    <p className="font-bold text-sm">Tuyệt vời! Tất cả phòng đã sạch.</p>
                </div>
            ) : (
                myTasks.map(task => (
                    <div 
                        key={task.id} 
                        onClick={() => openTaskDetail(task)}
                        className={`
                            bg-white rounded-2xl p-5 shadow-sm border-2 transition-all active:scale-[0.97] relative group
                            ${task.status === 'Done' ? 'border-slate-100 opacity-60' : 
                              task.status === 'In Progress' ? 'border-brand-500 shadow-brand-100 ring-2 ring-brand-500/10' : 'border-white'}
                        `}
                    >
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${task.task_type === 'Checkout' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                        <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-4">
                                 <h2 className="text-3xl font-black text-slate-800">{task.room_code}</h2>
                                 <div className="space-y-1">
                                     <div className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border w-fit ${task.task_type === 'Checkout' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>
                                         {task.task_type}
                                     </div>
                                     <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                         <MapPin size={10}/> {task.facilityName} - {task.roomType}
                                     </div>
                                 </div>
                             </div>
                             {task.status !== 'Done' && <ChevronRight className="text-slate-300" size={20} />}
                        </div>
                        {task.status === 'In Progress' && <div className="mt-4 flex items-center gap-1 text-[10px] text-emerald-600 font-bold animate-pulse"><Clock size={10}/> Đang dọn...</div>}
                    </div>
                ))
            )}
        </div>

        {activeTask && (
            <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
                <div className="bg-white border-b border-slate-100 p-4 flex items-center gap-4 shrink-0">
                    <button onClick={() => setActiveTask(null)} disabled={isProcessing} className="p-2 -ml-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-800">Phòng {activeTask.room_code}</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{activeTask.roomType} ({ROOM_RECIPES[activeTask.roomType || '1GM8']?.description})</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar pb-32">
                    {/* INFO BOX */}
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 border border-slate-200/50">
                        <div className="bg-white p-2 rounded-xl text-slate-400 shadow-sm"><Info size={20}/></div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ghi chú</span>
                            <p className="text-sm font-bold text-slate-700 italic">"{activeTask.note || 'Không có ghi chú'}"</p>
                        </div>
                    </div>

                    {/* SECTION 1: Checklist Công Việc */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <ListChecks size={18} className="text-brand-600"/> 1. Checklist Dọn Dẹp
                            </h3>
                            <span className="text-[10px] font-black text-slate-400">{localChecklist.filter(i => i.completed).length}/{localChecklist.length}</span>
                        </div>
                        <div className="space-y-3">
                            {localChecklist.map(item => (
                                <button key={item.id} onClick={() => toggleCheckItem(item.id)} className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${item.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                                    <span className={`text-sm font-bold ${item.completed ? 'text-emerald-700 line-through opacity-60' : 'text-slate-700'}`}>{item.text}</span>
                                    {item.completed ? <CheckSquare className="text-emerald-600" size={20}/> : <Square className="text-slate-300" size={20}/>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 2: Báo Cáo Minibar & Đồ Vải (Only when Active) */}
                    {activeTask.status === 'In Progress' && (
                        <>
                            <div className="h-px bg-slate-100 my-4"></div>
                            
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Beer size={18} className="text-orange-500"/> 2. Kiểm tra Minibar & Đồ dùng
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-2 italic">Hãy nhập số lượng khách đã dùng/bóc vỏ để tính tiền.</p>

                            <div className="space-y-3">
                                {recipeItems.filter(i => i.category === 'Minibar' || i.category === 'Amenity').map((item, idx) => {
                                    const consumed = consumedItems[item.id || item.fallbackName] || 0;
                                    const isMinibar = item.category === 'Minibar';
                                    
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <div className="font-bold text-slate-700 text-sm">{item.name || item.fallbackName}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase">
                                                    Setup chuẩn: {item.requiredQty} {item.unit} {isMinibar && <span className="text-orange-500 font-bold ml-1">(Có phí)</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateConsumed(item.id || item.fallbackName, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                <span className={`w-6 text-center font-black ${consumed > 0 ? 'text-red-600' : 'text-slate-300'}`}>{consumed}</span>
                                                <button onClick={() => updateConsumed(item.id || item.fallbackName, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="h-px bg-slate-100 my-4"></div>

                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <ArchiveRestore size={18} className="text-blue-500"/> 3. Thu hồi Đồ vải (Linen)
                            </h3>
                            {activeTask.task_type === 'Checkout' ? (
                                <div className="space-y-3">
                                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs font-bold border border-blue-100 flex items-center gap-2 mb-2">
                                        <Info size={16}/> Kiểm đếm số lượng thực tế mang ra khỏi phòng (Lost & Found).
                                    </div>
                                    {checkoutReturnList.map((item, idx) => {
                                        const actual = returnedLinenCounts[item.id] ?? item.qty;
                                        const diff = actual - item.qty;
                                        
                                        return (
                                        <div key={idx} className={`flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm ${diff < 0 ? 'border-red-200 bg-red-50' : 'border-blue-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <Shirt size={20} className={diff < 0 ? "text-red-400" : "text-blue-400"}/>
                                                <div>
                                                    <div className="font-bold text-slate-700 text-sm">{item.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                        Chuẩn: {item.qty} 
                                                        {item.isExtra && <span className="text-purple-600 ml-1 font-bold">(+Mượn)</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Counter UI */}
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateReturnedLinen(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                <div className="flex flex-col items-center w-12">
                                                    <span className={`text-lg font-black ${diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>{actual}</span>
                                                    {diff !== 0 && (
                                                        <span className={`text-[8px] font-bold uppercase ${diff < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                            {diff < 0 ? `Thiếu ${Math.abs(diff)}` : `Dư ${diff}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={() => updateReturnedLinen(item.id, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {checkoutReturnList.length === 0 && <div className="text-center text-xs text-slate-400 italic">Không có đồ vải cần thu hồi.</div>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-[10px] text-slate-400 mb-2 italic">Stayover: Nhập số lượng đồ bẩn bạn mang ra khỏi phòng (để đổi sạch).</p>
                                    {recipeItems.filter(i => i.category === 'Linen').map((item, idx) => {
                                        const consumed = consumedItems[item.id || item.fallbackName] || 0;
                                        return (
                                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <div>
                                                    <div className="font-bold text-slate-700 text-sm">{item.name || item.fallbackName}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase">Setup chuẩn: {item.requiredQty}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => updateConsumed(item.id || item.fallbackName, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                    <span className={`w-6 text-center font-black ${consumed > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{consumed}</span>
                                                    <button onClick={() => updateConsumed(item.id || item.fallbackName, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-3 pb-8">
                    {activeTask.status === 'Pending' ? (
                        <button 
                            onClick={handleStartTask}
                            disabled={isProcessing}
                            className={`w-full bg-brand-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all text-sm tracking-widest ${isProcessing ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <PlayIcon size={20} fill="white" />} 
                            {isProcessing ? 'ĐANG XỬ LÝ...' : 'BẮT ĐẦU DỌN'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleComplete}
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all text-sm tracking-widest bg-emerald-600 text-white shadow-emerald-100 ${isProcessing ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                             {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />} 
                             {isProcessing ? 'ĐANG CẬP NHẬT...' : 'HOÀN TẤT & TRỪ KHO'}
                        </button>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
