import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { 
  Booking, Facility, Room, Collaborator, Expense, ServiceItem, HousekeepingTask, 
  Settings, WebhookConfig, Shift, ToastMessage, ShiftSchedule, AttendanceAdjustment, InventoryTransaction, GuestProfile, LeaveRequest, ServiceUsage, AppConfig, RoomRecipe, LendingItem
} from '../types';
import { storageService } from '../services/storage';
import { supabase } from '../services/supabaseClient'; 
import { ROLE_PERMISSIONS, DEFAULT_SETTINGS, ROOM_RECIPES as INITIAL_RECIPES } from '../constants';
import { format, parseISO, isSameDay } from 'date-fns';

interface AppContextType {
  facilities: Facility[];
  rooms: Room[];
  bookings: Booking[];
  collaborators: Collaborator[];
  expenses: Expense[];
  services: ServiceItem[];
  inventoryTransactions: InventoryTransaction[];
  housekeepingTasks: HousekeepingTask[];
  webhooks: WebhookConfig[];
  schedules: ShiftSchedule[];
  adjustments: AttendanceAdjustment[];
  leaveRequests: LeaveRequest[];
  roomRecipes: Record<string, RoomRecipe>; 
  currentShift: Shift | null;
  currentUser: Collaborator | null;
  settings: Settings;
  toasts: ToastMessage[];
  isLoading: boolean;

  setCurrentUser: (user: Collaborator | null) => void;
  refreshData: (silent?: boolean) => Promise<void>;
  notify: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: number) => void;
  canAccess: (path: string) => boolean;

  addBooking: (b: Booking) => Promise<boolean>;
  updateBooking: (b: Booking) => Promise<boolean>;
  
  addFacility: (f: Facility) => Promise<void>;
  updateFacility: (f: Facility) => Promise<void>;
  deleteFacility: (id: string, name?: string) => Promise<void>;

  upsertRoom: (r: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;

  addCollaborator: (c: Collaborator) => Promise<void>;
  updateCollaborator: (c: Collaborator) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;

  addExpense: (e: Expense) => Promise<void>;
  updateExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addService: (s: ServiceItem) => Promise<void>;
  updateService: (s: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  addInventoryTransaction: (t: InventoryTransaction) => Promise<void>;
  
  // Logic Kho Đồ Vải (Linen Logic)
  handleLinenCheckIn: (booking: Booking) => Promise<void>;
  handleLinenExchange: (task: HousekeepingTask, dirtyQuantity: number) => Promise<void>;
  processMinibarUsage: (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => Promise<void>;
  processLendingUsage: (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => Promise<void>;
  processCheckoutLinenReturn: (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => Promise<void>; 

  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  
  addWebhook: (w: WebhookConfig) => Promise<void>;
  updateWebhook: (w: WebhookConfig) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  triggerWebhook: (event: string, payload: any) => Promise<void>;
  
  // Configs
  getGeminiApiKey: () => Promise<string | null>;
  setAppConfig: (cfg: AppConfig) => Promise<void>;
  
  addGuestProfile: (p: GuestProfile) => Promise<void>;

  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCash: number, note: string) => Promise<void>;

  upsertSchedule: (s: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  
  upsertAdjustment: (a: AttendanceAdjustment) => Promise<void>;
  addLeaveRequest: (req: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (req: LeaveRequest) => Promise<void>;

  updateSettings: (s: Settings) => Promise<void>;
  updateRoomRecipe: (key: string, recipe: RoomRecipe) => Promise<void>; 
  deleteRoomRecipe: (key: string) => Promise<void>; 
  
  checkAvailability: (facilityName: string, roomCode: string, checkin: string, checkout: string, excludeId?: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  
  // Initialize recipes from constants, in a real app this would come from DB
  const [roomRecipes, setRoomRecipes] = useState<Record<string, RoomRecipe>>(INITIAL_RECIPES);

  // Lazy initialize user from storage to safely handle access
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(() => {
      try {
          return storageService.getUser();
      } catch (e) {
          console.error("Failed to load user", e);
          return null;
      }
  });
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const bookingsRef = useRef<Booking[]>([]);

  const currentShift = shifts.find(s => s.staff_id === currentUser?.id && s.status === 'Open') || null;

  useEffect(() => {
      bookingsRef.current = bookings;
  }, [bookings]);

  const refreshData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [f, r, b, c, e, s, t, h, w, sh, sch, adj, lr, st, rr] = await Promise.all([
        storageService.getFacilities(),
        storageService.getRooms(),
        storageService.getBookings(),
        storageService.getCollaborators(),
        storageService.getExpenses(),
        storageService.getServices(),
        storageService.getInventoryTransactions(),
        storageService.getHousekeepingTasks(),
        storageService.getWebhooks(),
        storageService.getShifts(),
        storageService.getSchedules(),
        storageService.getAdjustments(),
        storageService.getLeaveRequests(),
        // NEW: Load Settings & Recipes
        storageService.getSettings(),
        storageService.getRoomRecipes()
      ]);
      setFacilities(f);
      setRooms(r);
      setBookings(b);
      setCollaborators(c);
      setExpenses(e);
      setServices(s);
      setInventoryTransactions(t);
      setHousekeepingTasks(h);
      setWebhooks(w);
      setShifts(sh);
      setSchedules(sch);
      setAdjustments(adj);
      setLeaveRequests(lr);
      // Update new state
      setSettings(st);
      setRoomRecipes(rr);
    } catch (err) {
      console.warn('Refresh Data error:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    const channels = supabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => handleRealtimeUpdate('rooms', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'housekeeping_tasks' }, (payload) => handleRealtimeUpdate('housekeeping_tasks', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => handleRealtimeUpdate('bookings', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_items' }, (payload) => handleRealtimeUpdate('service_items', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => handleRealtimeUpdate('leave_requests', payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => refreshData(true)) // Reload settings if changed
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_recipes' }, () => refreshData(true)) // Reload recipes if changed
      .subscribe();

    const interval = setInterval(() => { refreshData(true); }, 60000); 
    return () => { supabase.removeChannel(channels); clearInterval(interval); };
  }, []);

  const handleRealtimeUpdate = (table: string, payload: any) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const updateStateList = (setter: React.Dispatch<React.SetStateAction<any[]>>, idField = 'id') => {
          setter(prev => {
              if (eventType === 'INSERT') {
                  if (prev.some(item => item[idField] === newRecord[idField])) return prev;
                  return [newRecord, ...prev]; 
              }
              if (eventType === 'UPDATE') {
                  return prev.map(item => item[idField] === newRecord[idField] ? newRecord : item);
              }
              if (eventType === 'DELETE') {
                  return prev.filter(item => item[idField] !== oldRecord[idField]);
              }
              return prev;
          });
      };
      if (table === 'rooms') updateStateList(setRooms);
      if (table === 'housekeeping_tasks') updateStateList(setHousekeepingTasks);
      if (table === 'bookings') updateStateList(setBookings);
      if (table === 'service_items') updateStateList(setServices);
      if (table === 'leave_requests') updateStateList(setLeaveRequests);
  };

  const notify = (type: ToastMessage['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  };
  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const canAccess = (path: string) => {
    if (!currentUser) return false;
    const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
    return allowed.some(p => path === p || path.startsWith(p + '/'));
  };

  // --- INVENTORY LOGIC ---
  const handleLinenCheckIn = async (booking: Booking) => {
      // Logic cũ: Trừ kho sạch khi khách vào (optional, vì giờ ta trừ khi dọn phòng)
      // Giữ lại để đảm bảo tính nhất quán nếu cần
  };

  const handleLinenExchange = async (task: HousekeepingTask, dirtyQuantity: number) => {
      // Hàm này dùng cho đổi 1-1 (Stayover)
      // Logic: Kho Sạch (-qty) --> Kho Bẩn (+qty)
      // KHÔNG ẢNH HƯỞNG In_Circulation (vì lượng đồ trong phòng không đổi)
      if (dirtyQuantity <= 0) return;
      
      // ... logic cũ ...
      // Ở đây ta đơn giản hóa: Vì không biết chính xác món nào, ta sẽ không trừ kho ở đây nữa
      // Mà sẽ dùng hàm processCheckoutLinenReturn cho chính xác.
      // Hàm này tạm thời giữ nguyên cho tương thích ngược nếu có gọi ở đâu đó
  };

  // CORE LOGIC: MINIBAR PROCESSING
  const processMinibarUsage = async (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => {
      if (items.length === 0) return;

      // 1. Tìm Booking đang Active của phòng này
      const activeBooking = bookingsRef.current.find(b => 
          b.facilityName === facilityName && 
          b.roomCode === roomCode && 
          (b.status === 'CheckedIn' || b.status === 'Confirmed')
      );

      // 2. Trừ kho & Tạo Transaction
      for (const item of items) {
          const serviceDef = services.find(s => s.id === item.itemId);
          if (!serviceDef) continue;

          // Trừ kho
          const newStock = Math.max(0, (serviceDef.stock || 0) - item.qty);
          await storageService.updateService({ ...serviceDef, stock: newStock });

          // Lưu lịch sử kho
          const trans: InventoryTransaction = {
              id: `TR-MB-${Date.now()}-${Math.random()}`,
              created_at: new Date().toISOString(),
              staff_id: currentUser?.id || 'SYSTEM',
              staff_name: currentUser?.collaboratorName || 'Buồng phòng',
              item_id: serviceDef.id,
              item_name: serviceDef.name,
              type: serviceDef.price > 0 ? 'MINIBAR_SOLD' : 'AMENITY_USED',
              quantity: item.qty,
              price: serviceDef.costPrice || 0,
              total: (serviceDef.costPrice || 0) * item.qty,
              facility_name: facilityName,
              note: activeBooking ? `Khách dùng (Booking ${activeBooking.id})` : 'Khách dùng (Không tìm thấy Booking)'
          };
          await storageService.addInventoryTransaction(trans);

          // 3. Nếu có Booking & Món có tính tiền -> Cộng vào bill khách
          if (activeBooking && serviceDef.price > 0) {
              const currentServices: ServiceUsage[] = activeBooking.servicesJson ? JSON.parse(activeBooking.servicesJson) : [];
              
              // Kiểm tra xem món này đã có trong list chưa để cộng dồn
              const existingIndex = currentServices.findIndex(s => s.serviceId === serviceDef.id);
              if (existingIndex >= 0) {
                  currentServices[existingIndex].quantity += item.qty;
                  currentServices[existingIndex].total = currentServices[existingIndex].quantity * currentServices[existingIndex].price;
              } else {
                  currentServices.push({
                      serviceId: serviceDef.id,
                      name: serviceDef.name,
                      price: serviceDef.price,
                      quantity: item.qty,
                      total: serviceDef.price * item.qty,
                      time: new Date().toISOString()
                  });
              }
              
              // Recalculate totals
              const serviceTotal = currentServices.reduce((sum, s) => sum + s.total, 0);
              const totalRevenue = activeBooking.price + activeBooking.extraFee + serviceTotal;
              
              // Update Booking Optimistically
              const updatedBooking = {
                  ...activeBooking,
                  servicesJson: JSON.stringify(currentServices),
                  totalRevenue: totalRevenue,
                  remainingAmount: totalRevenue - (activeBooking.totalRevenue - activeBooking.remainingAmount) // Recalc remaining
              };
              
              setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
              await storageService.updateBooking(updatedBooking);
          }
      }
      refreshData(true);
  };

  // CORE LOGIC: LENDING PROCESSING (Assets/Linen OUT)
  const processLendingUsage = async (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => {
      if (items.length === 0) return;

      for (const item of items) {
          const serviceDef = services.find(s => s.id === item.itemId);
          if (!serviceDef) continue;

          // Logic Mượn đồ: Trừ kho sạch -> Chuyển sang "Đang lưu hành" (In Circulation)
          const newStock = Math.max(0, (serviceDef.stock || 0) - item.qty);
          const newCirculation = (serviceDef.in_circulation || 0) + item.qty;
          
          await storageService.updateService({ 
              ...serviceDef, 
              stock: newStock,
              in_circulation: newCirculation
          });

          // Lưu Transaction (Type OUT - Xuất dùng/Mượn)
          const trans: InventoryTransaction = {
              id: `TR-LEND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              created_at: new Date().toISOString(),
              staff_id: currentUser?.id || 'SYSTEM',
              staff_name: currentUser?.collaboratorName || 'Lễ tân',
              item_id: serviceDef.id,
              item_name: serviceDef.name,
              type: 'OUT', // Xuất dùng/mượn
              quantity: item.qty,
              price: 0,
              total: 0,
              facility_name: facilityName,
              note: `Khách mượn tại phòng ${roomCode}`
          };
          await storageService.addInventoryTransaction(trans);
      }
      refreshData(true);
  };

  // CORE LOGIC: CHECKOUT RETURN (Linen/Assets IN to Dirty)
  const processCheckoutLinenReturn = async (facilityName: string, roomCode: string, items: {itemId: string, qty: number}[]) => {
      if (items.length === 0) return;

      for (const item of items) {
          const serviceDef = services.find(s => s.id === item.itemId || s.name === item.itemId);
          if (!serviceDef) continue;

          // Logic Checkout: "Đang lưu hành" -> "Kho Bẩn" (Chờ giặt)
          const newCirculation = Math.max(0, (serviceDef.in_circulation || 0) - item.qty);
          const newLaundry = (serviceDef.laundryStock || 0) + item.qty;
          
          await storageService.updateService({ 
              ...serviceDef, 
              in_circulation: newCirculation,
              laundryStock: newLaundry
          });

          // Lưu Transaction (Log để đối soát, không phải transaction tài chính)
          // Không tạo Transaction quá chi tiết để tránh spam bảng log, chỉ cập nhật state
      }
      refreshData(true);
  };

  // APP CONFIGS
  const getGeminiApiKey = async () => {
      // Priority 1: Check DB
      const dbKey = await storageService.getAppConfig('GEMINI_API_KEY');
      if (dbKey && dbKey.length > 10) return dbKey;
      
      // Priority 2: Check Environment
      if (process.env.API_KEY && process.env.API_KEY.length > 10) return process.env.API_KEY;
      
      return null;
  };

  const setAppConfig = async (cfg: AppConfig) => {
      await storageService.setAppConfig(cfg);
  };

  const addBooking = async (b: Booking): Promise<boolean> => {
    const isAvailable = checkAvailability(b.facilityName, b.roomCode, b.checkinDate, b.checkoutDate);
    if (!isAvailable) { notify('error', 'Phòng vừa bị đặt bởi người khác! Vui lòng làm mới.'); return false; }
    const tempId = b.id; 
    setBookings(prev => [...prev, b]);
    try { await storageService.addBooking(b); return true; } 
    catch (err) { setBookings(prev => prev.filter(item => item.id !== tempId)); notify('error', 'Lỗi kết nối Server.'); return false; }
  };
  
  const updateBooking = async (b: Booking): Promise<boolean> => {
    const oldBookings = [...bookings];
    setBookings(prev => prev.map(item => item.id === b.id ? b : item));
    try { await storageService.updateBooking(b); return true; } 
    catch (err) { setBookings(oldBookings); notify('error', 'Không thể cập nhật Booking.'); return false; }
  };

  const addFacility = async (f: Facility) => { setFacilities(prev => [...prev, f]); await storageService.addFacility(f); notify('success', 'Đã thêm cơ sở'); };
  const updateFacility = async (f: Facility) => { setFacilities(prev => prev.map(item => item.id === f.id ? f : item)); await storageService.updateFacility(f); };
  const deleteFacility = async (id: string, facilityName?: string) => { 
      const { error } = await storageService.deleteFacility(id, facilityName); 
      if (!error) { setFacilities(prev => prev.filter(item => item.id !== id)); setRooms(prev => prev.filter(r => r.facility_id !== id)); notify('info', 'Đã xóa cơ sở'); }
  };

  const upsertRoom = async (r: Room) => {
    setRooms(prev => { const exists = prev.some(item => item.id === r.id); if (exists) return prev.map(item => item.id === r.id ? r : item); return [...prev, r]; });
    try { await storageService.upsertRoom(r); } catch (err) { refreshData(true); }
  };
  const deleteRoom = async (id: string) => { const oldRooms = [...rooms]; setRooms(prev => prev.filter(item => item.id !== id)); const { error } = await storageService.deleteRoom(id); if (error) setRooms(oldRooms); };

  const addCollaborator = async (c: Collaborator) => { setCollaborators(prev => [...prev, c]); await storageService.addCollaborator(c); };
  const updateCollaborator = async (c: Collaborator) => { setCollaborators(prev => prev.map(item => item.id === c.id ? c : item)); await storageService.updateCollaborator(c); };
  const deleteCollaborator = async (id: string) => { setCollaborators(prev => prev.filter(item => item.id !== id)); await storageService.deleteCollaborator(id); };

  const addExpense = async (e: Expense) => { setExpenses(prev => [...prev, e]); await storageService.addExpense(e); };
  const updateExpense = async (e: Expense) => { setExpenses(prev => prev.map(item => item.id === e.id ? e : item)); await storageService.updateExpense(e); };
  const deleteExpense = async (id: string) => { setExpenses(prev => prev.filter(item => item.id !== id)); await storageService.deleteExpense(id); };

  const addService = async (s: ServiceItem) => { setServices(prev => [...prev, s]); await storageService.addService(s); };
  const updateService = async (s: ServiceItem) => { setServices(prev => prev.map(item => item.id === s.id ? s : item)); await storageService.updateService(s); };
  const deleteService = async (id: string) => { setServices(prev => prev.filter(item => item.id !== id)); await storageService.deleteService(id); };
  const addInventoryTransaction = async (t: InventoryTransaction) => { setInventoryTransactions(prev => [t, ...prev]); await storageService.addInventoryTransaction(t); };

  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => {
      setHousekeepingTasks(prev => {
          const newMap = new Map(prev.map(t => [t.id, t]));
          tasks.forEach(t => newMap.set(t.id, t));
          return Array.from(newMap.values());
      });
      await storageService.syncHousekeepingTasks(tasks);
  };

  const addWebhook = async (w: WebhookConfig) => { setWebhooks(prev => [...prev, w]); await storageService.addWebhook(w); };
  const updateWebhook = async (w: WebhookConfig) => { setWebhooks(prev => prev.map(item => item.id === w.id ? w : item)); await storageService.updateWebhook(w); };
  const deleteWebhook = async (id: string) => { setWebhooks(prev => prev.filter(item => item.id !== id)); await storageService.deleteWebhook(id); };
  const triggerWebhook = async (event: string, payload: any) => {
      const activeHooks = webhooks.filter(w => w.is_active && w.event_type === event);
      activeHooks.forEach(async (hook) => { try { await fetch(hook.url, { method: 'POST', body: JSON.stringify(payload) }); } catch (err) {} });
  };
  
  const addGuestProfile = async (p: GuestProfile) => { await storageService.addGuestProfile(p); };

  const openShift = async (startCash: number) => {
      if (!currentUser) return;
      const shift: Shift = { id: `SH${Date.now()}`, staff_id: currentUser.id, staff_name: currentUser.collaboratorName, start_time: new Date().toISOString(), start_cash: startCash, total_revenue_cash: 0, total_expense_cash: 0, end_cash_expected: 0, status: 'Open' };
      setShifts(prev => [...prev, shift]); await storageService.addShift(shift);
  };
  const closeShift = async (endCash: number, note: string) => {
      if (!currentShift) return;
      const updatedShift: Shift = { ...currentShift, end_time: new Date().toISOString(), end_cash_actual: endCash, note, status: 'Closed' };
      setShifts(prev => prev.map(s => s.id === currentShift.id ? updatedShift : s)); await storageService.updateShift(updatedShift);
  };

  const upsertSchedule = async (s: ShiftSchedule) => { setSchedules(prev => { const exists = prev.some(item => item.id === s.id); if (exists) return prev.map(item => item.id === s.id ? s : item); return [...prev, s]; }); await storageService.upsertSchedule(s); };
  const deleteSchedule = async (id: string) => { setSchedules(prev => prev.filter(item => item.id !== id)); await storageService.deleteSchedule(id); };
  const upsertAdjustment = async (a: AttendanceAdjustment) => { setAdjustments(prev => { const index = prev.findIndex(item => item.staff_id === a.staff_id && item.month === a.month); if (index > -1) return prev.map((item, i) => i === index ? a : item); return [...prev, a]; }); await storageService.upsertAdjustment(a); };

  const addLeaveRequest = async (req: LeaveRequest) => { setLeaveRequests(prev => [req, ...prev]); await storageService.addLeaveRequest(req); };
  const updateLeaveRequest = async (req: LeaveRequest) => { setLeaveRequests(prev => prev.map(r => r.id === req.id ? req : r)); await storageService.updateLeaveRequest(req); };

  // --- NEW PERSISTENCE METHODS ---
  const updateSettings = async (s: Settings) => { 
      setSettings(s);
      await storageService.saveSettings(s);
  };
  
  const updateRoomRecipe = async (key: string, recipe: RoomRecipe) => {
      setRoomRecipes(prev => ({ ...prev, [key]: recipe }));
      await storageService.upsertRoomRecipe(recipe);
  };
  
  const deleteRoomRecipe = async (key: string) => {
      setRoomRecipes(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
      });
      await storageService.deleteRoomRecipe(key);
  };

  const checkAvailability = (facilityName: string, roomCode: string, checkin: string, checkout: string, excludeId?: string) => {
      const inDate = new Date(checkin).getTime();
      const outDate = new Date(checkout).getTime();
      return !bookingsRef.current.some(b => {
          if (b.id === excludeId || b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          const bIn = new Date(b.checkinDate).getTime();
          const bOut = new Date(b.checkoutDate).getTime();
          return (inDate < bOut && outDate > bIn);
      });
  };

  return (
    <AppContext.Provider value={{
       facilities, rooms, bookings, collaborators, expenses, services, inventoryTransactions, housekeepingTasks, webhooks, schedules, adjustments, leaveRequests, roomRecipes, currentShift, currentUser, settings, toasts, isLoading,
       setCurrentUser, refreshData, notify, removeToast, canAccess,
       addBooking, updateBooking, 
       addFacility, updateFacility, deleteFacility,
       upsertRoom, deleteRoom,
       addCollaborator, updateCollaborator, deleteCollaborator,
       addExpense, updateExpense, deleteExpense,
       addService, updateService, deleteService, addInventoryTransaction,
       handleLinenCheckIn, handleLinenExchange, processMinibarUsage, processLendingUsage, processCheckoutLinenReturn,
       syncHousekeepingTasks, 
       addWebhook, updateWebhook, deleteWebhook, triggerWebhook,
       getGeminiApiKey, setAppConfig,
       addGuestProfile,
       openShift, closeShift,
       upsertSchedule, deleteSchedule, upsertAdjustment,
       addLeaveRequest, updateLeaveRequest,
       updateSettings, updateRoomRecipe, deleteRoomRecipe, checkAvailability
    }}>
      {children}
    </AppContext.Provider>
  );
};