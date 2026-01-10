
import { Settings, Facility, Collaborator, Booking, Expense, ServiceItem, Room, RoomRecipe } from './types';

// --- PERMISSION MATRIX ---
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Admin': ['/dashboard', '/bookings', '/rooms', '/housekeeping', '/inventory', '/customers', '/collaborators', '/expenses', '/settings', '/staff-portal'], 
  'Quản lý': ['/dashboard', '/bookings', '/rooms', '/housekeeping', '/inventory', '/customers', '/collaborators', '/expenses', '/settings', '/staff-portal'],
  'Nhân viên': ['/dashboard', '/bookings', '/rooms', '/housekeeping', '/customers', '/inventory', '/staff-portal'],
  'Nhà đầu tư': ['/dashboard'],
  'Buồng phòng': ['/staff-portal']
};

export const DEFAULT_SETTINGS: Settings = {
  room_status: ['Đã dọn', 'Bẩn', 'Đang dọn', 'Sửa chữa'],
  sources: ['Khách vãng lai', 'Booking.com', 'Agoda', 'Facebook', 'Giới thiệu', 'Traveloka'],
  room_methods: ['Qua đêm', 'Theo giờ', 'Theo ngày', 'Combo 2H', 'Combo Đêm'],
  expense_categories: ['Điện nước', 'Vệ sinh', 'Bảo trì', 'Lương nhân viên', 'Marketing', 'Nhập hàng', 'Hoàn tiền'],
  cleaning_staff: ['Cô Lan', 'Chị Mai', 'Cô Cúc', 'Chú Ba bảo vệ'],
};

// Cấu hình danh mục vật tư chuẩn theo yêu cầu khách sạn
export const MOCK_SERVICES: ServiceItem[] = [
    // --- LINEN & ASSET (Đồ vải & Tài sản quay vòng) ---
    { id: 'L_GA18', name: 'Ga Trải 1m8', price: 200000, costPrice: 150000, unit: 'Cái', stock: 50, minStock: 10, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 150 },
    { id: 'L_BOC18', name: 'Vỏ Bọc 1m8', price: 250000, costPrice: 180000, unit: 'Cái', stock: 50, minStock: 10, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 150 },
    { id: 'L_GA12', name: 'Ga Trải 1m2', price: 150000, costPrice: 100000, unit: 'Cái', stock: 50, minStock: 10, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 150 },
    { id: 'L_BOC12', name: 'Vỏ Bọc 1m2', price: 180000, costPrice: 120000, unit: 'Cái', stock: 50, minStock: 10, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 150 },
    { id: 'L_GOI', name: 'Vỏ Gối', price: 50000, costPrice: 30000, unit: 'Cái', stock: 200, minStock: 20, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 500 },
    { id: 'L_AO', name: 'Áo Tắm', price: 200000, costPrice: 150000, unit: 'Cái', stock: 100, minStock: 10, category: 'Linen', laundryStock: 0, in_circulation: 0, totalassets: 300 },
    
    // --- AMENITIES (Tiêu hao miễn phí) ---
    { id: 'A_BANCHAI', name: 'Bàn Chải', price: 5000, costPrice: 2000, unit: 'Cái', stock: 500, minStock: 50, category: 'Amenity', totalassets: 500 },
    { id: 'A_DAOCAO', name: 'Dao Cạo', price: 5000, costPrice: 2000, unit: 'Cái', stock: 500, minStock: 50, category: 'Amenity', totalassets: 500 },
    { id: 'A_LUOC', name: 'Lược', price: 3000, costPrice: 1000, unit: 'Cái', stock: 500, minStock: 50, category: 'Amenity', totalassets: 500 },
    { id: 'A_CHUPTOC', name: 'Chụp Tóc', price: 2000, costPrice: 500, unit: 'Cái', stock: 500, minStock: 50, category: 'Amenity', totalassets: 500 },
    { id: 'A_TUIGIAT', name: 'Túi Giặt', price: 1000, costPrice: 200, unit: 'Cái', stock: 500, minStock: 50, category: 'Amenity', totalassets: 500 },
    { id: 'A_NUOCSUOI', name: 'Nước Suối (Free)', price: 0, costPrice: 3000, unit: 'Chai', stock: 200, minStock: 24, category: 'Amenity', totalassets: 200 },

    // --- MINIBAR (Tính phí) ---
    { id: 'M_NUOC_S', name: 'Nước Suối (Tính phí)', price: 10000, costPrice: 3500, unit: 'Chai', stock: 100, minStock: 24, category: 'Minibar', totalassets: 100 },
    { id: 'M_BOHUC', name: 'Bò Húc', price: 20000, costPrice: 9500, unit: 'Lon', stock: 48, minStock: 10, category: 'Minibar', totalassets: 48 },
    { id: 'M_STING', name: 'Sting Dâu', price: 15000, costPrice: 8000, unit: 'Chai', stock: 48, minStock: 10, category: 'Minibar', totalassets: 48 },
    { id: 'M_COCA', name: 'Coca Cola', price: 15000, costPrice: 7500, unit: 'Lon', stock: 48, minStock: 10, category: 'Minibar', totalassets: 48 },
    { id: 'M_BIA', name: 'Bia Tiger', price: 25000, costPrice: 16000, unit: 'Lon', stock: 48, minStock: 10, category: 'Minibar', totalassets: 48 },
    { id: 'M_MILY', name: 'Mì Ly', price: 15000, costPrice: 8000, unit: 'Ly', stock: 50, minStock: 10, category: 'Minibar', totalassets: 50 },
    { id: 'M_SNACK', name: 'Snack/Bim bim', price: 10000, costPrice: 5000, unit: 'Gói', stock: 50, minStock: 10, category: 'Minibar', totalassets: 50 },

    // --- SERVICES ---
    { id: 'SV_GIAT', name: 'Giặt ủi khách', price: 40000, costPrice: 15000, unit: 'Kg', stock: 0, minStock: 0, category: 'Service', totalassets: 0 },
    { id: 'SV_DON', name: 'Dọn phòng thêm', price: 50000, costPrice: 20000, unit: 'Lần', stock: 0, minStock: 0, category: 'Service', totalassets: 0 }
];

// Định nghĩa công thức cho từng loại phòng
// Dùng Name để mapping cho dễ hiểu, hệ thống sẽ tự tìm ID tương ứng
export const ROOM_RECIPES: Record<string, RoomRecipe> = {
    '1GM8': {
        roomType: '1GM8',
        description: '1 Giường 1m8 (35m2)',
        items: [
            { itemId: 'L_GA18', quantity: 1 },
            { itemId: 'L_BOC18', quantity: 1 },
            { itemId: 'L_GOI', quantity: 2 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 2 },
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 2 } // 2 chai free
        ]
    },
    '2GM2': {
        roomType: '2GM2',
        description: '2 Giường 1m2 (35m2)',
        items: [
            { itemId: 'L_GA12', quantity: 2 },
            { itemId: 'L_BOC12', quantity: 2 },
            { itemId: 'L_GOI', quantity: 2 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 2 },
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 2 }
        ]
    },
    'GL GN': {
        roomType: 'GL GN',
        description: 'Gđ nhỏ: 1m8 + 1m2 (36m2)',
        items: [
            { itemId: 'L_GA18', quantity: 1 },
            { itemId: 'L_GA12', quantity: 1 },
            { itemId: 'L_BOC18', quantity: 1 },
            { itemId: 'L_BOC12', quantity: 1 },
            { itemId: 'L_GOI', quantity: 3 }, // Giả định 3 gối
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 2 }, // Vẫn chuẩn 2 người lớn
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 3 }
        ]
    },
    '2GM8 + SOFA': {
        roomType: '2GM8 + SOFA',
        description: '2 Giường 1m8 + Sofa (39m2)',
        items: [
            { itemId: 'L_GA18', quantity: 2 },
            { itemId: 'L_BOC18', quantity: 2 },
            { itemId: 'L_GOI', quantity: 4 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 4 }, // 4 người
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 4 }
        ]
    },
    '2GM6': {
        roomType: '2GM6',
        description: '2 Giường 1m6 (37m2)',
        items: [
            { itemId: 'L_GA18', quantity: 2 }, // Tạm dùng ga 1m8 thay thế hoặc tạo mới
            { itemId: 'L_BOC18', quantity: 2 },
            { itemId: 'L_GOI', quantity: 4 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 4 },
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 4 }
        ]
    },
    '2PN': {
        roomType: '2PN',
        description: 'Căn hộ 2 Phòng Ngủ (55m2)',
        items: [
            { itemId: 'L_GA18', quantity: 2 },
            { itemId: 'L_BOC18', quantity: 2 },
            { itemId: 'L_GOI', quantity: 4 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 4 },
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 4 }
        ]
    },
    '2GM6 + SOFA': {
        roomType: '2GM6 + SOFA',
        description: '2 Giường 1m6 + Sofa (37m2)',
        items: [
            { itemId: 'L_GA18', quantity: 2 },
            { itemId: 'L_BOC18', quantity: 2 },
            { itemId: 'L_GOI', quantity: 4 },
            { itemId: 'L_AO', quantity: 2 },
            { itemId: 'A_BANCHAI', quantity: 4 },
            { itemId: 'A_DAOCAO', quantity: 1 },
            { itemId: 'A_LUOC', quantity: 1 },
            { itemId: 'A_CHUPTOC', quantity: 1 },
            { itemId: 'A_TUIGIAT', quantity: 1 },
            { itemId: 'A_NUOCSUOI', quantity: 4 }
        ]
    }
};

// --- DATA GENERATOR (UPDATED FOR NEW DB STRUCTURE) ---

const FACILITY_NAMES = [
  'Grand Hotel Saigon (Q.1)', 
  'Ocean View Resort (Vũng Tàu)', 
  'Mountain Retreat (Đà Lạt)', 
  'Riverside Lodge (Thảo Điền)', 
  'Airport Transit Hotel (Tân Bình)'
];

const STAFF_NAMES = [
    ['Cô Lan', 'Chị Mai'], 
    ['Cô Cúc', 'Anh Nam'], 
    ['Chị Hằng', 'Cô Ba'], 
    ['Chú Bảy', 'Anh Tùng'], 
    ['Chị Phượng', 'Cô Đào']
];

// Helper: Generate Facilities and Rooms separately
const generateMockData = () => {
    const facilities: Facility[] = [];
    const rooms: Room[] = [];
    const roomTypes = Object.keys(ROOM_RECIPES);

    FACILITY_NAMES.forEach((name, index) => {
        const facilityId = `F00${index + 1}`;
        const basePrice = 400000 + (index * 100000);
        const facilityRooms: any[] = []; 

        const floor = index + 1;
        for (let i = 1; i <= 20; i++) {
            const roomNum = i < 10 ? `0${i}` : `${i}`;
            let roomPrice = basePrice;
            if (i % 5 === 0) roomPrice += 200000; 

            const rName = `${floor}${roomNum}`;
            const rStatus = Math.random() > 0.7 ? 'Bẩn' : 'Đã dọn';
            const rNote = Math.random() > 0.9 ? 'Hỏng đèn' : '';
            const rType = roomTypes[Math.floor(Math.random() * roomTypes.length)];
            const rView = Math.random() > 0.5 ? 'View Biển' : 'View Nội';

            rooms.push({
                id: `${facilityId}_${rName}`, 
                facility_id: facilityId,
                facility_name: name,
                name: rName,
                status: rStatus,
                note: rNote,
                price: roomPrice,
                type: rType,
                view: rView,
                area: rType.includes('SOFA') ? 39 : 35
            });

            facilityRooms.push({
                maPhong: rName,
                trangThai: rStatus,
                ghiChu: rNote,
                price: roomPrice
            });
        }
        
        const parts = name.split('(');
        const area = parts.length > 1 ? parts[1].replace(')', '') : 'Trung tâm';

        facilities.push({
            id: facilityId,
            facilityName: name,
            facilityPrice: basePrice,
            note: `Cơ sở đạt chuẩn 4 sao tại khu vực ${area}`,
            staff: STAFF_NAMES[index],
            roomsJson: JSON.stringify(facilityRooms)
        });
    });

    return { facilities, rooms };
};

const generated = generateMockData();
export const MOCK_FACILITIES: Facility[] = generated.facilities;
export const MOCK_ROOMS: Room[] = generated.rooms;

export const MOCK_COLLABORATORS: Collaborator[] = [
  {
    id: 'C001',
    collaboratorName: 'Admin Quản Trị',
    username: 'admin',
    password: '123',
    role: 'Admin',
    manageFacilities: '[]',
    color: '#ef4444',
    commissionRate: 0,
    baseSalary: 15000000
  },
  {
    id: 'C002',
    collaboratorName: 'Lễ Tân Ca Sáng',
    username: 'letan1',
    password: '123',
    role: 'Nhân viên',
    manageFacilities: '[]',
    color: '#3b82f6',
    commissionRate: 5,
    baseSalary: 7000000
  },
  {
    id: 'C003',
    collaboratorName: 'Lễ Tân Ca Tối',
    username: 'letan2',
    password: '123',
    role: 'Nhân viên',
    manageFacilities: '[]',
    color: '#10b981',
    commissionRate: 5,
    baseSalary: 7500000
  },
  {
    id: 'C005',
    collaboratorName: 'Tạp Vụ (Cô Lan)',
    username: 'hk',
    password: '123',
    role: 'Buồng phòng',
    manageFacilities: '[]',
    color: '#6366f1',
    commissionRate: 0,
    baseSalary: 6000000
  }
];

const generateBookings = (): Booking[] => {
  const bookings: Booking[] = [];
  const now = new Date();
  const FIRST_NAMES = ['Anh', 'Bình', 'Châu', 'Dũng', 'Em', 'Giang', 'Hương', 'Hùng', 'Khánh'];
  const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh'];

  for (let i = 0; i < 30; i++) {
    const facility = MOCK_FACILITIES[Math.floor(Math.random() * MOCK_FACILITIES.length)];
    const facilityRooms = MOCK_ROOMS.filter(r => r.facility_id === facility.id);
    const room = facilityRooms[Math.floor(Math.random() * facilityRooms.length)];
    
    const duration = Math.floor(Math.random() * 3) + 1;
    let checkinDate = new Date(now);
    let status: any = 'Confirmed';
    
    if (i < 20) {
       checkinDate.setDate(now.getDate() - Math.floor(Math.random() * 2)); 
       status = 'CheckedIn';
    } else if (i < 25) {
       checkinDate.setDate(now.getDate() - 5);
       status = 'CheckedOut';
    } else {
       checkinDate.setDate(now.getDate() + Math.floor(Math.random() * 3) + 1);
       status = 'Confirmed';
    }
    checkinDate.setHours(12 + Math.floor(Math.random() * 3), 0, 0, 0);
    const checkoutDate = new Date(checkinDate);
    checkoutDate.setDate(checkoutDate.getDate() + duration);
    checkoutDate.setHours(12, 0, 0, 0);

    const price = room.price || facility.facilityPrice;
    const total = price * duration;

    bookings.push({
      id: `DP${Date.now() + i}`,
      facilityName: facility.facilityName,
      roomCode: room.name,
      createdDate: new Date().toISOString(),
      customerName: `${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]} ${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]}`,
      customerPhone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
      source: 'Khách vãng lai',
      collaborator: 'Admin Quản Trị',
      paymentMethod: 'Theo ngày',
      checkinDate: checkinDate.toISOString(),
      checkoutDate: checkoutDate.toISOString(),
      status: status,
      price: price,
      extraFee: 0,
      totalRevenue: total,
      note: '',
      paymentsJson: JSON.stringify([{ ngayThanhToan: checkinDate.toISOString(), soTien: total, ghiChu: 'Thanh toán đủ' }]),
      remainingAmount: 0,
      cleaningJson: '{}',
      assignedCleaner: '',
      servicesJson: '[]',
      lendingJson: '[]', // New field init
      actualCheckIn: status === 'CheckedIn' ? checkinDate.toISOString() : undefined
    });
  }
  return bookings;
};

export const MOCK_BOOKINGS = generateBookings();
