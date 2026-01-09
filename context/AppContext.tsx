import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Booking, Room, Facility, Collaborator, InventoryTransaction, 
  Expense, ShiftSchedule, AttendanceAdjustment, LeaveRequest, 
  ServiceItem, AppConfig, Shift, HousekeepingTask, WebhookConfig, 
  ToastMessage, GuestProfile
} from '../types';
import { storageService } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { MOCK_FACILITIES, MOCK_ROOMS, MOCK_SERVICES, MOCK_COLLABORATORS, MOCK_BOOKINGS } from '../constants';

interface AppContextType {
  currentUser: Collaborator | null;
  setCurrentUser: (user: Collaborator | null) => void;
  facilities: Facility[];
  rooms: Room[];
  bookings: Booking[];
  services: ServiceItem[];
  collaborators: Collaborator[];
  expenses: Expense[];
  inventoryTransactions: InventoryTransaction[];
  schedules: ShiftSchedule[];
  adjustments: AttendanceAdjustment[];
  leaveRequests: LeaveRequest[];
  housekeepingTasks: HousekeepingTask[];
  webhooks: WebhookConfig[];
  currentShift: Shift | null;
  toasts: ToastMessage[];
  isLoading: boolean;
  settings: any;

  // Actions
  refreshData: (force?: boolean) => Promise<void>;
  addBooking: (b: Booking) => Promise<boolean>;
  updateBooking: (b: Booking) => Promise<boolean>;
  upsertRoom: (r: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  addFacility: (f: Facility) => Promise<void>;
  updateFacility: (f: Facility) => Promise<void>;
  deleteFacility: (id: string) => Promise<void>;
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
  
  // Shifts & HR
  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCash: number, note: string) => Promise<void>;
  upsertSchedule: (s: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  upsertAdjustment: (a: AttendanceAdjustment) => Promise<void>;
  addLeaveRequest: (r: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (r: LeaveRequest) => Promise<void>;

  // Housekeeping
  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  handleLinenExchange: (task: HousekeepingTask, count: number) => Promise<void>;
  processMinibarUsage: (facility: string, room: string, items: {itemId: string, qty: number}[]) => Promise<void>;

  // Guests
  addGuestProfile: (p: GuestProfile) => Promise<void>;

  // Utils
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: number) => void;
  canAccess: (path: string) => boolean;
  checkAvailability: (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => boolean;
  triggerWebhook: (type: string, data: any) => Promise<void>;
  
  // Configs
  getGeminiApiKey: () => Promise<string | null>;
  setAppConfig: (cfg: AppConfig) => Promise<{ error: any }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
      const storedUser = storageService.getUser();
      if (storedUser) setCurrentUser(storedUser);
      refreshData();
  }, []);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: number) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = async (force = false) => {
      setIsLoading(true);
      try {
          // Fallback to Mocks if DB is empty or error (Simplified logic for stability)
          const { data: facData } = await supabase.from('facilities').select('*');
          if (facData && facData.length > 0) setFacilities(facData);
          else setFacilities(MOCK_FACILITIES);

          const { data: roomData } = await supabase.from('rooms').select('*');
          if (roomData && roomData.length > 0) setRooms(roomData);
          else setRooms(MOCK_ROOMS);

          const { data: bkData } = await supabase.from('bookings').select('*');
          if (bkData && bkData.length > 0) setBookings(bkData);
          else setBookings(MOCK_BOOKINGS);

          const { data: srvData } = await supabase.from('services').select('*');
          if (srvData && srvData.length > 0) setServices(srvData);
          else setServices(MOCK_SERVICES);

          const { data: colData } = await supabase.from('collaborators').select('*');
          if (colData && colData.length > 0) setCollaborators(colData);
          else setCollaborators(MOCK_COLLABORATORS);

          const { data: expData } = await supabase.from('expenses').select('*');
          setExpenses(expData || []);

          const { data: hkData } = await supabase.from('housekeeping_tasks').select('*');
          setHousekeepingTasks(hkData || []);

          const { data: webData } = await supabase.from('webhook_configs').select('*');
          setWebhooks(webData || []);

      } catch (error) {
          console.error("Refresh error", error);
          notify('error', 'Lỗi tải dữ liệu');
      } finally {
          setIsLoading(false);
      }
  };

  const getGeminiApiKey = async () => {
      const dbKey = await storageService.getAppConfig('GEMINI_API_KEY');
      if (dbKey && dbKey.length > 10) return dbKey;
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) return process.env.GEMINI_API_KEY;
      return null;
  };

  const setAppConfig = async (cfg: AppConfig) => {
      return await storageService.setAppConfig(cfg);
  };

  const addBooking = async (b: Booking): Promise<boolean> => {
      const { error } = await supabase.from('bookings').insert(b);
      if (error) { notify('error', 'Lỗi thêm booking'); return false; }
      setBookings(prev => [...prev, b]);
      return true;
  };

  const updateBooking = async (b: Booking): Promise<boolean> => {
      const { error } = await supabase.from('bookings').update(b).eq('id', b.id);
      if (error) { notify('error', 'Lỗi cập nhật booking'); return false; }
      setBookings(prev => prev.map(x => x.id === b.id ? b : x));
      return true;
  };

  const upsertRoom = async (r: Room) => {
      const { error } = await supabase.from('rooms').upsert(r);
      if (!error) {
          setRooms(prev => {
              const idx = prev.findIndex(x => x.id === r.id);
              if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
              return [...prev, r];
          });
      }
  };
  const deleteRoom = async (id: string) => {
      await supabase.from('rooms').delete().eq('id', id);
      setRooms(prev => prev.filter(x => x.id !== id));
  };

  const addFacility = async (f: Facility) => { setFacilities(p => [...p, f]); };
  const updateFacility = async (f: Facility) => { setFacilities(p => p.map(x => x.id === f.id ? f : x)); };
  const deleteFacility = async (id: string) => { setFacilities(p => p.filter(x => x.id !== id)); };

  const addCollaborator = async (c: Collaborator) => { setCollaborators(p => [...p, c]); };
  const updateCollaborator = async (c: Collaborator) => { setCollaborators(p => p.map(x => x.id === c.id ? c : x)); };
  const deleteCollaborator = async (id: string) => { setCollaborators(p => p.filter(x => x.id !== id)); };

  const addExpense = async (e: Expense) => { setExpenses(p => [...p, e]); };
  const updateExpense = async (e: Expense) => { setExpenses(p => p.map(x => x.id === e.id ? e : x)); };
  const deleteExpense = async (id: string) => { setExpenses(p => p.filter(x => x.id !== id)); };

  const addService = async (s: ServiceItem) => { setServices(p => [...p, s]); };
  const updateService = async (s: ServiceItem) => { setServices(p => p.map(x => x.id === s.id ? s : x)); };
  const deleteService = async (id: string) => { setServices(p => p.filter(x => x.id !== id)); };

  const addInventoryTransaction = async (t: InventoryTransaction) => { setInventoryTransactions(p => [...p, t]); };

  const openShift = async (startCash: number) => {
      if (!currentUser) return;
      const s: Shift = {
          id: `SHIFT-${Date.now()}`,
          staff_id: currentUser.id,
          staff_name: currentUser.collaboratorName,
          start_time: new Date().toISOString(),
          start_cash: startCash,
          total_revenue_cash: 0,
          total_expense_cash: 0,
          end_cash_expected: startCash,
          status: 'Open'
      };
      setCurrentShift(s);
      notify('success', 'Đã mở ca làm việc');
  };
  const closeShift = async (endCash: number, note: string) => {
      setCurrentShift(null);
      notify('success', 'Đã chốt ca');
  };

  const upsertSchedule = async (s: ShiftSchedule) => {
      setSchedules(p => {
          const idx = p.findIndex(x => x.id === s.id);
          if (idx >= 0) { const n = [...p]; n[idx] = s; return n; }
          return [...p, s];
      });
  };
  const deleteSchedule = async (id: string) => { setSchedules(p => p.filter(x => x.id !== id)); };

  const upsertAdjustment = async (a: AttendanceAdjustment) => {
      setAdjustments(p => {
          const idx = p.findIndex(x => x.staff_id === a.staff_id && x.month === a.month);
          if (idx >= 0) { const n = [...p]; n[idx] = a; return n; }
          return [...p, a];
      });
  };

  const addLeaveRequest = async (r: LeaveRequest) => { setLeaveRequests(p => [...p, r]); };
  const updateLeaveRequest = async (r: LeaveRequest) => { setLeaveRequests(p => p.map(x => x.id === r.id ? r : x)); };

  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => {
      setHousekeepingTasks(prev => {
          const newTasks = [...prev];
          tasks.forEach(t => {
              const idx = newTasks.findIndex(x => x.id === t.id);
              if (idx >= 0) newTasks[idx] = t;
              else newTasks.push(t);
          });
          return newTasks;
      });
  };

  const handleLinenExchange = async (task: HousekeepingTask, count: number) => { };
  const processMinibarUsage = async (facility: string, room: string, items: {itemId: string, qty: number}[]) => { };
  const addGuestProfile = async (p: GuestProfile) => { };

  const canAccess = (path: string) => true; 
  const checkAvailability = (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      return !bookings.some(b => {
          if (b.id === excludeId) return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
          const bStart = new Date(b.checkinDate);
          const bEnd = new Date(b.checkoutDate);
          return (start < bEnd && end > bStart);
      });
  };

  const triggerWebhook = async (type: string, data: any) => { console.log('Webhook', type, data); };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, facilities, rooms, bookings, services, collaborators, expenses,
      inventoryTransactions, schedules, adjustments, leaveRequests, housekeepingTasks, webhooks,
      currentShift, toasts, isLoading, settings: { expense_categories: [] },
      refreshData, addBooking, updateBooking, upsertRoom, deleteRoom, addFacility, updateFacility, deleteFacility,
      addCollaborator, updateCollaborator, deleteCollaborator, addExpense, updateExpense, deleteExpense,
      addService, updateService, deleteService, addInventoryTransaction,
      openShift, closeShift, upsertSchedule, deleteSchedule, upsertAdjustment,
      addLeaveRequest, updateLeaveRequest, syncHousekeepingTasks, handleLinenExchange, processMinibarUsage,
      addGuestProfile, notify, removeToast, canAccess, checkAvailability, triggerWebhook,
      getGeminiApiKey, setAppConfig
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};