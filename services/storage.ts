
import { supabase } from './supabaseClient';
import { Facility, Room, Booking, Collaborator, Expense, ServiceItem, HousekeepingTask, WebhookConfig, Shift, ShiftSchedule, AttendanceAdjustment, InventoryTransaction, GuestProfile, LeaveRequest } from '../types';
import { MOCK_FACILITIES, MOCK_ROOMS, MOCK_COLLABORATORS, MOCK_BOOKINGS, MOCK_SERVICES } from '../constants';

const logError = (message: string, error: any) => {
  console.warn(message, error);
};

const isTableMissingError = (error: any) => {
    return error?.code === '42P01' || error?.code === 'PGRST205';
};

const safeFetch = async <T>(promise: Promise<{ data: T[] | null; error: any }>, fallback: T[]): Promise<T[]> => {
    try {
        const { data, error } = await promise;
        if (error) {
            if (!isTableMissingError(error)) logError('Database API Error', error);
            return fallback;
        }
        return (data && data.length > 0) ? data : fallback;
    } catch (err) {
        logError('Network Error: Falling back to Mock Data', err);
        return fallback;
    }
};

// Helper để lấy ngày đầu năm hiện tại (Dùng để lọc dữ liệu cũ)
const getDataStartDate = () => {
    // Lấy dữ liệu từ 6 tháng trước để đảm bảo báo cáo và lịch sử gần đây vẫn hiển thị đủ
    // Dữ liệu cũ hơn sẽ được lưu trữ (Archive) nhưng không tải về Client để tránh lag.
    const d = new Date();
    d.setDate(1); // Set to 1st to avoid overflow
    d.setMonth(d.getMonth() - 6);
    return d.toISOString();
};

export const storageService = {
  // Facilities
  getFacilities: async (): Promise<Facility[]> => {
    return safeFetch(supabase.from('facilities').select('*').order('id', { ascending: true }), MOCK_FACILITIES);
  },
  addFacility: async (item: Facility) => {
    const { staff, ...payload } = item; 
    const { error } = await supabase.from('facilities').insert(payload);
    if (error) logError('Error adding facility', error);
  },
  updateFacility: async (item: Facility) => {
    const { staff, ...payload } = item;
    const { error } = await supabase.from('facilities').update(payload).eq('id', item.id);
    if (error) logError('Error updating facility', error);
  },
  
  deleteFacility: async (id: string, facilityName?: string) => {
    try {
        await supabase.from('housekeeping_tasks').delete().eq('facility_id', id);
        await supabase.from('rooms').delete().eq('facility_id', id);
        if (facilityName) {
            await supabase.from('bookings').delete().eq('facilityName', facilityName);
            await supabase.from('expenses').delete().eq('facilityName', facilityName);
        }
        const { error } = await supabase.from('facilities').delete().eq('id', id);
        return { error: error || null };
    } catch (err) {
        return { error: err };
    }
  },

  // Rooms
  getRooms: async (): Promise<Room[]> => {
     return safeFetch(supabase.from('rooms').select('*'), MOCK_ROOMS);
  },
  upsertRoom: async (item: Room) => {
     const { error } = await supabase.from('rooms').upsert(item);
     if (error) logError('Error upserting room', error);
  },
  deleteRoom: async (id: string) => {
     const { error } = await supabase.from('rooms').delete().eq('id', id);
     return { error: error || null };
  },
  
  // Collaborators
  getCollaborators: async (): Promise<Collaborator[]> => {
    return safeFetch(supabase.from('collaborators').select('*'), MOCK_COLLABORATORS);
  },
  addCollaborator: async (item: Collaborator) => {
    const { error } = await supabase.from('collaborators').insert(item);
    if (error) logError('Error adding collaborator', error);
  },
  updateCollaborator: async (item: Collaborator) => {
    const { error } = await supabase.from('collaborators').update(item).eq('id', item.id);
    if (error) logError('Error updating collaborator', error);
  },
  deleteCollaborator: async (id: string) => {
    await supabase.from('shifts').delete().eq('staff_id', id);
    const { error } = await supabase.from('collaborators').delete().eq('id', id);
    return { error: error || null };
  },

  // Shift Schedules
  getSchedules: async (): Promise<ShiftSchedule[]> => {
    // Chỉ lấy lịch phân ca từ đầu năm nay
    const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const data = await safeFetch(supabase.from('shift_schedules').select('*').gte('date', startYear), []);
    
    return data.map((s: any) => {
        let type = s.shift_type;
        if (type === 'Ca 1' || type === 'Morning') type = 'Sáng';
        if (type === 'Ca 2' || type === 'Night') type = 'Tối';
        if (type === 'Afternoon') type = 'Chiều';
        return { ...s, shift_type: type };
    });
  },
  upsertSchedule: async (item: ShiftSchedule) => {
    const sanitized = { ...item };
    if (sanitized.shift_type === 'Ca 1' as any) sanitized.shift_type = 'Sáng';
    if (sanitized.shift_type === 'Ca 2' as any) sanitized.shift_type = 'Tối';
    
    const { error } = await supabase.from('shift_schedules').upsert(sanitized);
    if (error) logError('Error upserting schedule', error);
    return { error };
  },
  deleteSchedule: async (id: string) => {
    const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
    if (error) logError('Error deleting schedule', error);
  },

  // Attendance Adjustments
  getAdjustments: async (): Promise<AttendanceAdjustment[]> => {
    return safeFetch(supabase.from('attendance_adjustments').select('*'), []);
  },
  upsertAdjustment: async (item: AttendanceAdjustment) => {
    const { error } = await supabase.from('attendance_adjustments').upsert(item);
    if (error) logError('Error upserting adjustment', error);
  },

  // LEAVE REQUESTS (NEW)
  getLeaveRequests: async (): Promise<LeaveRequest[]> => {
      // Chỉ lấy yêu cầu trong năm nay để tránh nặng
      const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
      return safeFetch(
          supabase.from('leave_requests').select('*').gte('created_at', startYear).order('created_at', { ascending: false }),
          []
      );
  },
  addLeaveRequest: async (item: LeaveRequest) => {
      const { error } = await supabase.from('leave_requests').insert(item);
      if (error && !isTableMissingError(error)) logError('Error adding leave request', error);
      return { error };
  },
  updateLeaveRequest: async (item: LeaveRequest) => {
      // FIX: Dùng update + eq thay vì upsert để đảm bảo cập nhật đúng dòng (tránh lỗi conflict hoặc RLS)
      const { error } = await supabase.from('leave_requests').update(item).eq('id', item.id);
      if (error && !isTableMissingError(error)) logError('Error updating leave request', error);
      return { error };
  },

  // Bookings (SCALABILITY FIX: Date Filtering)
  getBookings: async (): Promise<Booking[]> => {
    // Lọc: Chỉ lấy booking có ngày checkout > 6 tháng trước. 
    // Các booking quá cũ (đã xong từ năm ngoái) sẽ không tải về để giảm tải RAM.
    const limitDate = getDataStartDate();
    
    const rawData = await safeFetch(
        supabase.from('bookings')
            .select('*')
            .or(`checkoutDate.gte.${limitDate},status.eq.Confirmed,status.eq.CheckedIn`), // Lấy cái mới HOẶC cái đang active
        MOCK_BOOKINGS
    );

    // MAPPER: Lấy isDeclared từ cleaningJson nếu column isDeclared không tồn tại trong DB
    return rawData.map(b => {
        let isDeclared = b.isDeclared;
        // Nếu DB chưa có cột isDeclared (undefined) nhưng có trong JSON, lấy ra
        if (isDeclared === undefined && b.cleaningJson) {
            try {
                const cleanObj = JSON.parse(b.cleaningJson);
                if (cleanObj && typeof cleanObj === 'object' && cleanObj.isDeclared === true) {
                    isDeclared = true;
                }
            } catch (e) { /* ignore parse error */ }
        }
        return { ...b, isDeclared: !!isDeclared };
    });
  },

  addBooking: async (item: Booking) => {
    // PREPARE PAYLOAD: Lưu isDeclared vào cleaningJson để persist
    const payload = { ...item };
    try {
        const cleanObj = payload.cleaningJson ? JSON.parse(payload.cleaningJson) : {};
        if (payload.isDeclared) cleanObj.isDeclared = true;
        else delete cleanObj.isDeclared;
        payload.cleaningJson = JSON.stringify(cleanObj);
    } catch (e) {
        payload.cleaningJson = JSON.stringify({ isDeclared: payload.isDeclared });
    }
    // Xóa trường ảo để tránh lỗi nếu cột không tồn tại
    delete (payload as any).isDeclared; 

    const { error } = await supabase.from('bookings').insert(payload);
    if (error) logError('Error adding booking', error);
  },

  updateBooking: async (item: Booking) => {
    // PREPARE PAYLOAD: Lưu isDeclared vào cleaningJson để persist
    const payload = { ...item };
    try {
        const cleanObj = payload.cleaningJson ? JSON.parse(payload.cleaningJson) : {};
        if (payload.isDeclared) cleanObj.isDeclared = true;
        else delete cleanObj.isDeclared;
        payload.cleaningJson = JSON.stringify(cleanObj);
    } catch (e) {
        payload.cleaningJson = JSON.stringify({ isDeclared: payload.isDeclared });
    }
    // Xóa trường ảo để tránh lỗi nếu cột không tồn tại
    delete (payload as any).isDeclared;

    const { error } = await supabase.from('bookings').update(payload).eq('id', item.id);
    if (error) logError('Error updating booking', error);
  },

  // Expenses (SCALABILITY FIX: Date Filtering)
  getExpenses: async (): Promise<Expense[]> => {
    const limitDate = getDataStartDate();
    return safeFetch(
        supabase.from('expenses').select('*').gte('expenseDate', limitDate), 
        []
    );
  },
  addExpense: async (item: Expense) => {
    const { error } = await supabase.from('expenses').insert(item);
    if (error) logError('Error adding expense', error);
  },
  updateExpense: async (item: Expense) => {
    const { error } = await supabase.from('expenses').update(item).eq('id', item.id);
    if (error) logError('Error updating expense', error);
  },
  deleteExpense: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    return { error: error || null };
  },

  // Services (Inventory)
  getServices: async (): Promise<ServiceItem[]> => {
    return safeFetch(supabase.from('service_items').select('*').order('name', { ascending: true }), MOCK_SERVICES);
  },
  addService: async (item: ServiceItem) => {
    const { error } = await supabase.from('service_items').insert(item);
    if (error) logError('Error adding service', error);
    return { error };
  },
  updateService: async (item: ServiceItem) => {
    const { error } = await supabase.from('service_items').upsert(item);
    if (error) logError('Error updating service', error);
    return { error };
  },
  deleteService: async (id: string) => {
    const { error } = await supabase.from('service_items').delete().eq('id', id);
    return { error: error || null };
  },

  // Inventory Transactions (SCALABILITY FIX: Hard Limit)
  getInventoryTransactions: async (): Promise<InventoryTransaction[]> => {
    // Chỉ lấy 200 giao dịch kho gần nhất để hiển thị lịch sử
    // Nếu cần xem lịch sử cũ hơn, sẽ cần tạo API riêng (Phân trang) sau này.
    return safeFetch(
        supabase.from('inventory_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200), 
        []
    );
  },
  addInventoryTransaction: async (item: InventoryTransaction) => {
    const { error } = await supabase.from('inventory_transactions').insert(item);
    if (error) logError('Error adding inventory transaction', error);
    return { error };
  },

  // Housekeeping Tasks (SCALABILITY FIX: Limit Active/Recent)
  getHousekeepingTasks: async (): Promise<HousekeepingTask[]> => {
    const limitDate = getDataStartDate();
    // Chỉ lấy task chưa xong HOẶC task đã xong trong 6 tháng qua
    return safeFetch(
        supabase.from('housekeeping_tasks')
            .select('*')
            .or(`status.eq.Pending,status.eq.In Progress,created_at.gte.${limitDate}`),
        []
    );
  },
  syncHousekeepingTasks: async (tasks: HousekeepingTask[]) => {
      const sanitizedTasks = tasks.map(({ checklist, photo_before, photo_after, ...rest }) => rest);
      const { error } = await supabase.from('housekeeping_tasks').upsert(sanitizedTasks);
      if (error) logError('Error syncing tasks', error);
  },

  // Webhooks
  getWebhooks: async (): Promise<WebhookConfig[]> => {
      return safeFetch(supabase.from('webhooks').select('*'), []);
  },
  addWebhook: async (item: WebhookConfig) => {
      const { error } = await supabase.from('webhooks').insert(item);
      if (error) logError('Error adding webhook', error);
  },
  updateWebhook: async (item: WebhookConfig) => {
      const { error } = await supabase.from('webhooks').update(item).eq('id', item.id);
      if (error) logError('Error updating webhook', error);
  },
  deleteWebhook: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      return { error: error || null };
  },

  // NEW: Guest Profiles (SQL History)
  addGuestProfile: async (item: GuestProfile) => {
      const { error } = await supabase.from('guest_profiles').insert(item);
      // Không ném lỗi để tránh chặn luồng chính nếu chưa tạo bảng
      if (error && !isTableMissingError(error)) logError('Error adding guest profile', error);
      return { error };
  },

  // Shifts (SCALABILITY FIX: Limit Recent)
  getShifts: async (): Promise<Shift[]> => {
      // Chỉ lấy 50 ca làm việc gần nhất
      return safeFetch(
          supabase.from('shifts')
            .select('*')
            .order('start_time', { ascending: false })
            .limit(50), 
          []
      );
  },
  addShift: async (item: Shift) => {
      const { error } = await supabase.from('shifts').insert(item);
      if (error) logError('Error adding shift', error);
  },
  updateShift: async (item: Shift) => {
      const { error } = await supabase.from('shifts').update(item).eq('id', item.id);
      if (error) logError('Error updating shift', error);
  },

  // Local Storage
  saveUser: (user: Collaborator | null, remember = true) => {
    if (user) {
        if (remember) localStorage.setItem('currentUser', JSON.stringify(user));
        else sessionStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
    }
  },
  getUser: (): Collaborator | null => {
    const local = localStorage.getItem('currentUser');
    if (local) return JSON.parse(local);
    const session = sessionStorage.getItem('currentUser');
    if (session) return JSON.parse(session);
    return null;
  },

  seedDatabase: async () => {
     const facilitiesPayload = MOCK_FACILITIES.map(({staff, ...rest}) => rest);
     await supabase.from('facilities').upsert(facilitiesPayload);
     await supabase.from('rooms').upsert(MOCK_ROOMS);
     await supabase.from('collaborators').upsert(MOCK_COLLABORATORS);
     await supabase.from('bookings').upsert(MOCK_BOOKINGS);
     
     const servicesWithDefault = MOCK_SERVICES.map(s => {
         let dqty = 0;
         if (s.name.includes('Nước')) dqty = 2;
         if (s.name.includes('Bàn chải')) dqty = 2;
         if (s.name.includes('Khăn')) dqty = 2;
         if (s.name.includes('Dầu gội')) dqty = 2;
         return { 
            ...s, 
            default_qty: dqty, 
            totalassets: s.stock || 100, 
            laundryStock: 0 
         };
     });
     await supabase.from('service_items').upsert(servicesWithDefault);
  }
};
