
export type Role = 'Admin' | 'Quản lý' | 'Nhân viên' | 'Nhà đầu tư' | 'Buồng phòng';

export interface Room {
  id: string;
  facility_id: string;
  facility_name?: string; 
  name: string;
  status: string;
  note?: string;
  price?: number;
  price_saturday?: number; // Giá riêng cho thứ 7
  // New upgraded fields
  type?: string; // 1GM8, 2GM2, GL GN, 2PN...
  view?: string; // City View, Sea View, Garden...
  area?: number; // m2
}

export interface Facility {
  id: string;
  facilityName: string;
  facilityPrice: number; 
  facilityPriceSaturday?: number; // Giá thứ 7 mặc định của cơ sở
  roomsJson?: string;
  note: string;
  staff?: string[]; 
}

export interface Collaborator {
  id: string;
  collaboratorName: string;
  username: string;
  password?: string;
  role: Role;
  manageFacilities: string;
  color: string;
  commissionRate: number;
  baseSalary: number;
  commission?: number;
}

export interface InventoryTransaction {
  id: string;
  created_at: string;
  staff_id: string;
  staff_name: string;
  item_id: string;
  item_name: string;
  type: 'IN' | 'OUT' | 'LAUNDRY_SEND' | 'LAUNDRY_RECEIVE' | 'ADJUST' | 'EXCHANGE' | 'MINIBAR_SOLD' | 'AMENITY_USED';
  quantity: number;
  price: number;
  total: number;
  evidence_url?: string;
  note?: string;
  facility_name?: string;
}

export interface ShiftSchedule {
  id: string;
  staff_id: string;
  date: string; // YYYY-MM-DD
  shift_type: 'Sáng' | 'Chiều' | 'Tối' | 'OFF';
  note?: string;
}

export interface AttendanceAdjustment {
  staff_id: string;
  month: string; // YYYY-MM
  standard_days_adj: number;
  ot_hours_adj: number;
  leave_days_adj: number;
  note?: string;
}

// New Interface for Leave Requests
export interface LeaveRequest {
  id: string;
  staff_id: string;
  staff_name: string;
  start_date: string; // ISO Date
  end_date: string;   // ISO Date
  leave_type: 'Nghỉ phép năm' | 'Nghỉ ốm' | 'Việc riêng' | 'Không lương' | 'Chế độ';
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  approver_note?: string;
}

export interface Payment {
  ngayThanhToan: string;
  soTien: number;
  ghiChu: string; 
  method: 'Cash' | 'Transfer' | 'Card' | 'Other';
}

export interface Expense {
  id: string;
  expenseDate: string; 
  facilityName: string;
  expenseCategory: string;
  expenseContent: string;
  amount: number;
  note?: string;
}

export type ItemCategory = 'Minibar' | 'Amenity' | 'Linen' | 'Voucher' | 'Service' | 'Asset';

export interface ServiceItem {
  id: string;
  name: string;
  price: number; 
  costPrice?: number; 
  unit: string;
  stock: number; // Kho Sạch: Sẵn sàng sử dụng
  minStock: number; 
  category: ItemCategory; 
  laundryStock?: number; // Kho Bẩn: Đang chờ giặt/tại xưởng
  in_circulation?: number; // Đang trong phòng (Theo định mức hoặc khách mượn)
  totalassets?: number; // Tổng tài sản (Sạch + Bẩn + Đang trong phòng)
  default_qty?: number; // Định mức chuẩn cho mỗi phòng (vd: 2 khăn/phòng)
  created_at?: string;
}

export interface RoomRecipeItem {
    itemId: string; // Link tới ServiceItem.id hoặc ServiceItem.name
    quantity: number;
}

export interface RoomRecipe {
    roomType: string;
    description: string;
    items: RoomRecipeItem[];
}

export interface ServiceUsage {
  serviceId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  time: string;
}

// Interface cho đồ khách mượn thêm (Lending)
export interface LendingItem {
  item_id: string;
  item_name: string;
  quantity: number;
  returned: boolean;
}

// Interface chi tiết cho từng khách trong phòng
export interface Guest {
  id: string;
  fullName: string;
  dob?: string;
  idCard?: string; // CCCD/Passport
  type?: 'Người lớn' | 'Trẻ em';
  gender?: string;
  address?: string;
}

export type BookingStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

export interface Booking {
  id: string;
  facilityName: string;
  roomCode: string;
  createdDate: string;
  customerName: string;
  customerPhone: string;
  source: string;
  collaborator: string;
  paymentMethod: string;
  checkinDate: string; 
  checkoutDate: string;
  status: BookingStatus; 
  actualCheckIn?: string; 
  actualCheckOut?: string; 
  price: number;
  extraFee: number;
  totalRevenue: number;
  note: string;
  paymentsJson: string; 
  remainingAmount: number;
  cleaningJson: string; 
  assignedCleaner?: string; 
  servicesJson?: string; // Đồ khách mua/tiêu hao (Minibar)
  lendingJson?: string; // Đồ khách mượn (LendingItem[])
  guestsJson?: string; // Lưu danh sách Guest[]
  isDeclared?: boolean; // New field: Đã khai báo lưu trú hay chưa
  
  // GROUP BOOKING FIELDS
  groupId?: string; // ID chung của đoàn
  groupName?: string; // Tên đoàn
  isGroupLeader?: boolean; // Là trưởng đoàn (để thanh toán gộp)
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface HousekeepingTask {
  id: string;
  facility_id: string;
  room_code: string;
  task_type: 'Checkout' | 'Stayover' | 'Dirty' | 'Vacant';
  status: 'Pending' | 'In Progress' | 'Done';
  assignee: string | null;
  priority: 'High' | 'Normal' | 'Low';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  note?: string;
  points?: number;
  estimated_minutes?: number;
  checklist?: string; // JSON string of ChecklistItem[]
  photo_before?: string;
  photo_after?: string;
  linen_exchanged?: number; // Số lượng khăn đã đổi 1-1 trong ca dọn
}

export interface WebhookConfig {
  id: string;
  url: string;
  event_type: 'checkout' | 'housekeeping_assign' | 'residence_declaration' | 'leave_update' | 'ota_import';
  is_active: boolean;
  description?: string;
  created_at?: string;
}

export interface Shift {
  id: string;
  staff_id: string;
  staff_name: string;
  start_time: string;
  end_time?: string;
  start_cash: number; 
  total_revenue_cash: number; 
  total_expense_cash: number; 
  end_cash_expected: number; 
  end_cash_actual?: number; 
  difference?: number; 
  note?: string;
  status: 'Open' | 'Closed';
}

export interface Settings {
  room_status: string[];
  sources: string[];
  room_methods: string[];
  expense_categories: string[];
  cleaning_staff: string[]; 
  service_menu?: ServiceItem[]; 
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

// New Interface for SQL Storage
export interface GuestProfile {
  id?: string;
  created_at?: string;
  full_name: string;
  dob: string;
  gender: string;
  nationality: string;
  id_card_number: string;
  card_type: 'CCCD' | 'Passport' | 'Khác';
  address: string;
  phone: string;
  booking_id?: string;
  staff_id?: string;
  scan_data_json?: string; // Store raw JSON from OCR for backup
}

// Interface for Sheet Import
export interface SheetBooking {
  rowIndex: number;
  platform: string;
  bookingCode: string;
  customerName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: string;
}

// Config Table
export interface AppConfig {
  key: string;
  value: string;
  description?: string;
}
