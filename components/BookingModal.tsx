
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from './Modal';
import { Booking, Payment, ServiceUsage, BookingStatus, GuestProfile, Guest, InventoryTransaction, SheetBooking, LendingItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { 
  FileText, ShoppingCart, Banknote, ScanLine, AlertTriangle, Loader2, LogIn, LogOut, CheckCircle,
  Plus, Minus, Trash2, History, Upload, ShieldCheck, UserPlus, Users, ToggleLeft, ToggleRight, List, Group, Calendar, Check, Send, Printer, Save, XCircle, AlertOctagon, FileSpreadsheet,
  Package, Shirt
} from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  defaultData?: Partial<Booking>;
  initialTab?: 'info' | 'services' | 'payment' | 'ocr';
  initialCancellation?: boolean; 
}

// Cấu trúc dữ liệu khai báo lưu trú chuẩn Google Sheet
interface ResidenceData {
  ho_ten: string;
  ngay_sinh: string; // dd/mm/yyyy
  gioi_tinh: string;
  quoc_tich: string;
  so_giay_to: string;
  loai_giay_to: 'CCCD' | 'Passport' | 'Khác';
  so_dien_thoai: string;
  tinh_tp: string;
  quan_huyen: string;
  phuong_xa: string;
  dia_chi_chitiet: string;
  ly_do: string;
  loai_cu_tru: string;
}

const DEFAULT_OCR_DATA: ResidenceData = {
    ho_ten: '', 
    ngay_sinh: '', 
    gioi_tinh: '', 
    quoc_tich: 'VNM',
    so_giay_to: '', 
    loai_giay_to: 'CCCD', 
    so_dien_thoai: '',
    tinh_tp: '', 
    quan_huyen: '', 
    phuong_xa: '', 
    dia_chi_chitiet: '',
    ly_do: 'Du lịch', 
    loai_cu_tru: 'Lưu trú'
};

const INITIAL_BOOKING_STATE: Partial<Booking> = {
    facilityName: '',
    roomCode: '',
    customerName: '',
    customerPhone: '',
    source: '',
    collaborator: '',
    paymentMethod: '',
    checkinDate: '',
    checkoutDate: '',
    status: 'Confirmed',
    price: 0,
    extraFee: 0,
    note: '',
    paymentsJson: '[]',
    cleaningJson: '{}',
    assignedCleaner: '',
    servicesJson: '[]',
    lendingJson: '[]',
    guestsJson: '[]',
    isDeclared: false,
    groupName: ''
};

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, booking, defaultData, initialTab = 'info', initialCancellation = false }) => {
  const { 
      facilities, rooms, services, currentUser, bookings,
      addBooking, updateBooking, checkAvailability,
      notify, triggerWebhook, upsertRoom, refreshData, webhooks, addGuestProfile,
      updateService, addInventoryTransaction, getGeminiApiKey, processLendingUsage
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<'info' | 'services' | 'payment' | 'ocr'>('info');
  const [availabilityError, setAvailabilityError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false); 

  // Group Booking State
  const [isGroupMode, setIsGroupMode] = useState(false); 
  const [selectedGroupRooms, setSelectedGroupRooms] = useState<string[]>([]);
  
  // Group Payment State
  const [isGroupPaymentMode, setIsGroupPaymentMode] = useState(false);

  // Cancellation State
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFee, setCancelFee] = useState<number>(0); // Phí phạt (Giữ lại)

  // OCR State
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ transform: 'scale(1)' });
  const [isSheetSent, setIsSheetSent] = useState(false); 
  
  // State riêng cho form Khai báo lưu trú
  const [ocrResult, setOcrResult] = useState<ResidenceData>(DEFAULT_OCR_DATA);

  // Sheet Import State
  const [isSheetLoading, setIsSheetLoading] = useState(false);
  const [sheetData, setSheetData] = useState<SheetBooking[]>([]);
  const [showSheetList, setShowSheetList] = useState(false);
  const [selectedSheetRow, setSelectedSheetRow] = useState<SheetBooking | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Booking>>(INITIAL_BOOKING_STATE);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [usedServices, setUsedServices] = useState<ServiceUsage[]>([]);
  const [lendingList, setLendingList] = useState<LendingItem[]>([]); // New Lending State
  const [guestList, setGuestList] = useState<Guest[]>([]);
  
  // Quick Payment Input State
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Transfer' | 'Card'>('Cash');
  const [payNote, setPayNote] = useState('');

  // Reset trạng thái gửi khi đổi người
  useEffect(() => {
      setIsSheetSent(false);
  }, [ocrResult.so_giay_to]);

  const isInfoSufficient = useMemo(() => {
      return (
          ocrResult.ho_ten.trim().length > 0 &&
          ocrResult.so_giay_to.trim().length > 0 &&
          (isGroupMode ? selectedGroupRooms.length > 0 : (formData.roomCode && formData.roomCode.trim().length > 0))
      );
  }, [ocrResult.ho_ten, ocrResult.so_giay_to, formData.roomCode, isGroupMode, selectedGroupRooms]);

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab(initialTab);
    setIsCancelling(initialCancellation); // Set cancel mode from prop
    setCancelReason('');
    setCancelFee(0);
    setShowSheetList(false);
    setSelectedSheetRow(null);

    if (booking) {
      setFormData(booking);
      setPayments(safeJsonParse(booking.paymentsJson));
      setUsedServices(safeJsonParse(booking.servicesJson));
      setLendingList(safeJsonParse(booking.lendingJson)); // Load lending
      setGuestList(safeJsonParse(booking.guestsJson));
      setAvailabilityError('');
      
      setIsGroupMode(false); 
      setSelectedGroupRooms([]);
      setIsGroupPaymentMode(!!booking.isGroupLeader); 

      setScannedImage(null);
      setOcrResult({
          ...DEFAULT_OCR_DATA,
          ho_ten: booking.customerName || '',
          so_dien_thoai: booking.customerPhone || '',
      });
      setIsSheetSent(!!booking.isDeclared); 
    } else {
      const now = new Date();
      const tomorrowNoon = new Date(now);
      tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
      tomorrowNoon.setHours(12, 0, 0, 0);

      const initData = {
          ...INITIAL_BOOKING_STATE,
          facilityName: facilities[0]?.facilityName || '',
          collaborator: currentUser?.collaboratorName || '',
          checkinDate: now.toISOString(),
          checkoutDate: tomorrowNoon.toISOString(),
          status: 'Confirmed' as BookingStatus,
          ...defaultData
      };

      setFormData(initData);
      setPayments([]);
      setUsedServices([]);
      setLendingList([]);
      setGuestList([]);
      setAvailabilityError('');
      setIsGroupMode(false);
      setIsGroupPaymentMode(false);
      
      if (defaultData?.roomCode) {
          setSelectedGroupRooms([defaultData.roomCode]);
      } else {
          setSelectedGroupRooms([]);
      }

      setScannedImage(null);
      setOcrResult(DEFAULT_OCR_DATA);
      setIsSheetSent(false);
    }
  }, [isOpen, booking, defaultData, facilities, currentUser, initialTab, initialCancellation]);

  const safeJsonParse = (jsonStr?: string) => {
      try {
          return jsonStr ? JSON.parse(jsonStr) : [];
      } catch (e) {
          return [];
      }
  };

  const getLatestBooking = () => {
      if (!formData.id) return null;
      return bookings.find(b => b.id === formData.id) || booking;
  };

  // --- SHEET IMPORT LOGIC ---
  const fetchSheetData = async () => {
      // 1. Kiểm tra cấu hình webhook 'ota_import'
      const importWebhook = webhooks.find(w => w.is_active && w.event_type === 'ota_import');
      
      setIsSheetLoading(true);
      setShowSheetList(true);

      try {
          if (importWebhook) {
              // Nếu có Webhook thật, gọi API
              const res = await fetch(importWebhook.url + '?action=get_bookings');
              const data = await res.json();
              if (Array.isArray(data)) {
                  setSheetData(data);
                  notify('success', `Đã tải ${data.length} booking từ Sheet.`);
                  setIsSheetLoading(false);
                  return;
              }
          } 
          
          // MOCK DATA (Nếu không có Webhook hoặc lỗi)
          setTimeout(() => {
              const mockData: SheetBooking[] = [
                  { rowIndex: 2, platform: 'Agoda', bookingCode: 'AG-123456', customerName: 'NGUYEN VAN MOCK A', checkIn: format(new Date(), 'yyyy-MM-dd'), checkOut: format(new Date(new Date().setDate(new Date().getDate() + 1)), 'yyyy-MM-dd'), status: 'Pending' },
                  { rowIndex: 3, platform: 'Booking.com', bookingCode: 'BK-789012', customerName: 'LE THI MOCK B', checkIn: format(new Date(), 'yyyy-MM-dd'), checkOut: format(new Date(new Date().setDate(new Date().getDate() + 2)), 'yyyy-MM-dd'), status: 'Pending' },
                  { rowIndex: 4, platform: 'Sale', bookingCode: 'DIRECT-001', customerName: 'KHACH DOAN CTY MOCK', checkIn: format(new Date(new Date().setDate(new Date().getDate() + 1)), 'yyyy-MM-dd'), checkOut: format(new Date(new Date().setDate(new Date().getDate() + 3)), 'yyyy-MM-dd'), status: 'Pending' }
              ];
              setSheetData(mockData);
              notify('info', 'Đã tải dữ liệu mẫu (Cấu hình Webhook "ota_import" để dùng thật).');
              setIsSheetLoading(false);
          }, 1000);

      } catch (e) {
          console.error(e);
          notify('error', 'Lỗi kết nối Google Sheet.');
          setIsSheetLoading(false);
          setShowSheetList(false);
      }
  };

  const handleSheetSelect = (row: SheetBooking) => {
      // Auto fill form
      const checkin = `${row.checkIn}T14:00`;
      const checkout = `${row.checkOut}T12:00`;
      
      const newFormData = {
          ...formData,
          customerName: row.customerName,
          checkinDate: checkin,
          checkoutDate: checkout,
          source: row.platform,
          note: `${formData.note || ''}\nMã BK: ${row.bookingCode}`.trim()
      };

      // Recalculate price
      if (newFormData.facilityName && newFormData.roomCode) {
          const unitPrice = getPriceForDate(newFormData.facilityName, newFormData.roomCode, checkin);
          const nights = calculateNights(checkin, checkout);
          newFormData.price = unitPrice * nights;
      }

      setFormData(newFormData);
      setSelectedSheetRow(row);
      setShowSheetList(false);
      notify('success', `Đã điền thông tin khách: ${row.customerName}`);
  };

  const handleInventoryDeduction = async (currentServices: ServiceUsage[]) => {
      const latestData = getLatestBooking();
      const oldServices: ServiceUsage[] = latestData?.servicesJson ? safeJsonParse(latestData.servicesJson) : [];
      
      for (const newItem of currentServices) {
          const oldItem = oldServices.find(s => s.serviceId === newItem.serviceId);
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = newItem.quantity - oldQty;

          if (diff > 0) {
              const serviceDef = services.find(s => s.id === newItem.serviceId);
              if (serviceDef) {
                  const newStock = (serviceDef.stock || 0) - diff;
                  await updateService({ ...serviceDef, stock: newStock });

                  const trans: InventoryTransaction = {
                      id: `TR-BK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      created_at: new Date().toISOString(),
                      staff_id: currentUser?.id || 'SYSTEM',
                      staff_name: currentUser?.collaboratorName || 'Lễ tân',
                      item_id: serviceDef.id,
                      item_name: serviceDef.name,
                      type: serviceDef.price > 0 ? 'MINIBAR_SOLD' : 'AMENITY_USED',
                      quantity: diff,
                      price: serviceDef.costPrice || 0,
                      total: (serviceDef.costPrice || 0) * diff,
                      facility_name: formData.facilityName,
                      note: `Khách dùng tại phòng ${formData.roomCode} (Booking)`
                  };
                  await addInventoryTransaction(trans);
              }
          }
      }
  };

  const handleLendingDeduction = async (currentLending: LendingItem[]) => {
      const latestData = getLatestBooking();
      const oldLending: LendingItem[] = latestData?.lendingJson ? safeJsonParse(latestData.lendingJson) : [];
      const itemsToDeduct: {itemId: string, qty: number}[] = [];

      for (const newItem of currentLending) {
          const oldItem = oldLending.find(l => l.item_id === newItem.item_id);
          const oldQty = oldItem ? oldItem.quantity : 0;
          const diff = newItem.quantity - oldQty;

          if (diff > 0) {
              itemsToDeduct.push({ itemId: newItem.item_id, qty: diff });
          }
      }

      if (itemsToDeduct.length > 0 && formData.facilityName && formData.roomCode) {
          await processLendingUsage(formData.facilityName, formData.roomCode, itemsToDeduct);
      }
  };

  // ... (Group logic, Payment logic, Availability logic kept same) ...
  const groupMembers = useMemo(() => {
      const currentGroupId = formData.groupId || booking?.groupId;
      if (!currentGroupId) return [];
      if (!formData.id) return [];
      return bookings.filter(b => b.groupId === currentGroupId);
  }, [booking, formData, bookings]);

  const groupFinancials = useMemo(() => {
      if (groupMembers.length === 0) return { total: 0, paid: 0, remaining: 0 };
      
      let total = 0;
      let paid = 0;
      
      groupMembers.forEach(m => {
          total += m.totalRevenue;
          const pList = safeJsonParse(m.paymentsJson);
          const mPaid = pList.reduce((sum: number, p: Payment) => sum + Number(p.soTien), 0);
          paid += mPaid;
      });

      return { total, paid, remaining: total - paid };
  }, [groupMembers]);

  useEffect(() => {
     if (activeTab !== 'payment') return;
     if (isGroupPaymentMode) {
         setPayAmount(groupFinancials.remaining > 0 ? groupFinancials.remaining.toString() : '');
         setPayNote(`Thanh toán đoàn ${formData.groupName}`);
     } else {
         const singleTotal = Number(formData.price || 0) + Number(formData.extraFee || 0) + usedServices.reduce((sum, s) => sum + s.total, 0);
         const singlePaid = payments.reduce((sum, p) => sum + Number(p.soTien), 0);
         const singleRemaining = singleTotal - singlePaid;
         setPayAmount(singleRemaining > 0 ? singleRemaining.toString() : '');
         setPayNote('Thanh toán');
     }
  }, [isGroupPaymentMode, activeTab, groupFinancials, formData, usedServices, payments]);

  useEffect(() => {
    if (formData.facilityName && formData.checkinDate && formData.checkoutDate) {
        if (formData.status !== 'Cancelled' && formData.status !== 'CheckedOut') {
            let conflictRoom = '';
            if (isGroupMode) {
                conflictRoom = selectedGroupRooms.find(rCode => 
                    !checkAvailability(formData.facilityName!, rCode, formData.checkinDate!, formData.checkoutDate!, booking?.id)
                ) || '';
            } else if (formData.roomCode) {
                const isAvailable = checkAvailability(
                    formData.facilityName, 
                    formData.roomCode, 
                    formData.checkinDate, 
                    formData.checkoutDate, 
                    booking?.id 
                );
                if (!isAvailable) conflictRoom = formData.roomCode;
            }

            if (conflictRoom) {
                setAvailabilityError(`⚠️ Phòng ${conflictRoom} đã bị trùng lịch!`);
            } else {
                setAvailabilityError('');
            }
        } else {
            setAvailabilityError('');
        }
    }
  }, [formData.facilityName, formData.roomCode, formData.checkinDate, formData.checkoutDate, formData.status, booking, checkAvailability, isGroupMode, selectedGroupRooms]);

  const serviceTotal = usedServices.reduce((sum, s) => sum + s.total, 0);
  const totalRevenue = Number(formData.price || 0) + Number(formData.extraFee || 0) + serviceTotal;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.soTien), 0);
  const remaining = totalRevenue - totalPaid;

  const handleAddService = (serviceId: string) => {
      const service = services.find(s => s.id === serviceId);
      if (!service) return;

      // Logic Split: Consumable vs Lending
      if (service.category === 'Linen' || service.category === 'Asset') {
          // ADD TO LENDING LIST
          setLendingList(prev => {
              const existing = prev.find(l => l.item_id === serviceId);
              if (existing) {
                  return prev.map(l => l.item_id === serviceId ? { ...l, quantity: l.quantity + 1 } : l);
              }
              return [...prev, {
                  item_id: service.id,
                  item_name: service.name,
                  quantity: 1,
                  returned: false
              }];
          });
      } else {
          // ADD TO MINIBAR/SERVICE LIST
          setUsedServices(prev => {
              const existing = prev.find(s => s.serviceId === serviceId);
              if (existing) {
                  return prev.map(s => s.serviceId === serviceId 
                      ? { ...s, quantity: s.quantity + 1, total: (s.quantity + 1) * s.price } 
                      : s
                  );
              }
              return [...prev, {
                  serviceId: service.id,
                  name: service.name,
                  price: service.price,
                  quantity: 1,
                  total: service.price,
                  time: new Date().toISOString()
              }];
          });
      }
  };

  const handleUpdateServiceQty = (serviceId: string, delta: number) => {
      setUsedServices(prev => {
          return prev.map(s => {
              if (s.serviceId === serviceId) {
                  const newQty = Math.max(0, s.quantity + delta);
                  return { ...s, quantity: newQty, total: newQty * s.price };
              }
              return s;
          }).filter(s => s.quantity > 0);
      });
  };

  const handleUpdateLendingQty = (itemId: string, delta: number) => {
      setLendingList(prev => {
          return prev.map(l => {
              if (l.item_id === itemId) {
                  return { ...l, quantity: Math.max(0, l.quantity + delta) };
              }
              return l;
          }).filter(l => l.quantity > 0);
      });
  };

  const handleAddPayment = async () => {
      const amount = Number(payAmount);
      if (amount <= 0) {
          notify('error', 'Số tiền phải lớn hơn 0');
          return;
      }

      if (isGroupPaymentMode) {
          setIsSubmitting(true);
          try {
              let remainingToDistribute = amount;
              const updates = [];

              for (const member of groupMembers) {
                  if (remainingToDistribute <= 0) break;
                  if (member.remainingAmount > 0) {
                      const payForRoom = Math.min(member.remainingAmount, remainingToDistribute);
                      
                      const pList = safeJsonParse(member.paymentsJson);
                      const newPayment: Payment = {
                          ngayThanhToan: new Date().toISOString(),
                          soTien: payForRoom,
                          method: payMethod,
                          ghiChu: `${payNote} (Gộp)`
                      };
                      const updatedPList = [...pList, newPayment];
                      
                      const updatedMember: Booking = {
                          ...member,
                          paymentsJson: JSON.stringify(updatedPList),
                          remainingAmount: member.totalRevenue - (member.totalRevenue - member.remainingAmount + payForRoom)
                      };
                      updates.push(updateBooking(updatedMember));
                      
                      remainingToDistribute -= payForRoom;
                  }
              }
              
              if (remainingToDistribute > 0) {
                  const targetBooking = groupMembers.find(b => b.isGroupLeader) || booking || groupMembers[0];
                  if (targetBooking) {
                      if (remainingToDistribute > 1000) {
                          notify('info', `Còn dư ${remainingToDistribute.toLocaleString()}đ chưa phân bổ.`);
                      }
                  }
              }

              await Promise.all(updates);
              notify('success', `Đã thanh toán ${amount.toLocaleString()}đ cho đoàn.`);
              setPayAmount('');
          } catch(e) {
              notify('error', 'Lỗi thanh toán đoàn.');
          } finally {
              setIsSubmitting(false);
          }

      } else {
          const newPayment: Payment = {
              ngayThanhToan: new Date().toISOString(),
              soTien: amount,
              method: payMethod,
              ghiChu: payNote || 'Thanh toán'
          };
          
          const nextPayments = [...payments, newPayment];
          setPayments(nextPayments);
          setPayAmount('');
          setPayNote('');
          
          if (formData.id) {
              setIsSubmitting(true);
              try {
                  await handleInventoryDeduction(usedServices);
                  await handleLendingDeduction(lendingList); // Handle Lending Stock

                  const currentServiceTotal = usedServices.reduce((sum, s) => sum + s.total, 0);
                  const currentRevenue = Number(formData.price || 0) + Number(formData.extraFee || 0) + currentServiceTotal;
                  const currentPaid = nextPayments.reduce((sum, p) => sum + Number(p.soTien), 0);
                  const currentRemaining = currentRevenue - currentPaid;

                  const updatedBooking: Booking = {
                      ...(formData as Booking),
                      paymentsJson: JSON.stringify(nextPayments),
                      servicesJson: JSON.stringify(usedServices),
                      lendingJson: JSON.stringify(lendingList),
                      guestsJson: JSON.stringify(guestList),      
                      totalRevenue: currentRevenue,
                      remainingAmount: currentRemaining
                  };

                  const success = await updateBooking(updatedBooking);
                  
                  if (success) {
                      setFormData(updatedBooking); 
                      notify('success', `Đã thu ${amount.toLocaleString()}đ. Dư nợ: ${currentRemaining.toLocaleString()}đ`);
                  } else {
                      throw new Error("Failed to update booking");
                  }
              } catch (err) {
                  notify('error', 'Lỗi lưu thanh toán. Vui lòng thử lại.');
              } finally {
                  setIsSubmitting(false);
              }
          } else {
              notify('success', `Đã ghi nhận ${amount.toLocaleString()}đ. (Vui lòng bấm 'Lưu Thông Tin' để hoàn tất)`);
          }
      }
  };

  const handleQuickPayAll = () => {
      if (isGroupPaymentMode) {
          if (groupFinancials.remaining <= 0) return;
          setPayAmount(groupFinancials.remaining.toString());
          setPayNote(`Thanh toán hết đoàn ${formData.groupName}`);
      } else {
          if (remaining <= 0) return;
          const newPayment: Payment = {
              ngayThanhToan: new Date().toISOString(),
              soTien: remaining,
              method: 'Cash',
              ghiChu: 'Thanh toán hết'
          };
          setPayments(prev => [...prev, newPayment]);
          notify('success', 'Đã thanh toán đủ.');
      }
  };

  // ... (Keep existing image/OCR/date helper functions) ...
  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - left) / width * 100;
      const y = (e.clientY - top) / height * 100;
      setZoomStyle({
          transformOrigin: `${x}% ${y}%`,
          transform: 'scale(2.5)'
      });
  };

  const handleImageMouseLeave = () => {
      setZoomStyle({ transform: 'scale(1)' });
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
      if (!checkIn || !checkOut) return 1;
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const nights = differenceInCalendarDays(end, start);
      return Math.max(1, nights);
  };

  const getPriceForDate = (fName: string, rCode: string, dateStr: string) => {
      const fac = facilities.find(f => f.facilityName === fName);
      if (!fac) return 0;
      const room = rooms.find(r => r.facility_id === fac.id && r.name === rCode);
      if (!dateStr) return room?.price || fac.facilityPrice || 0;
      const date = new Date(dateStr);
      const isSaturday = date.getDay() === 6; 
      if (isSaturday) {
          return room?.price_saturday || fac.facilityPriceSaturday || room?.price || fac.facilityPrice || 0;
      }
      return room?.price || fac.facilityPrice || 0;
  };

  const handleRoomChange = (roomCode: string) => {
     const unitPrice = getPriceForDate(formData.facilityName!, roomCode, formData.checkinDate!);
     const nights = calculateNights(formData.checkinDate!, formData.checkoutDate!);
     setFormData(prev => ({ ...prev, roomCode, price: unitPrice * nights }));
  };

  const handleCheckinDateChange = (newDate: string) => {
      const unitPrice = getPriceForDate(formData.facilityName!, formData.roomCode!, newDate);
      const nights = calculateNights(newDate, formData.checkoutDate!);
      setFormData(prev => ({ ...prev, checkinDate: newDate, price: unitPrice * nights }));
  };

  const handleCheckoutDateChange = (newDate: string) => {
      const unitPrice = getPriceForDate(formData.facilityName!, formData.roomCode!, formData.checkinDate!);
      const nights = calculateNights(formData.checkinDate!, newDate);
      setFormData(prev => ({ ...prev, checkoutDate: newDate, price: unitPrice * nights }));
  };

  const handleAddGuest = () => {
      const newGuest: Guest = {
          id: crypto.randomUUID(),
          fullName: 'Khách mới',
          type: 'Người lớn',
          idCard: '',
          dob: ''
      };
      setGuestList([...guestList, newGuest]);
  };

  const handleUpdateGuest = (id: string, field: keyof Guest, value: string) => {
      setGuestList(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const handleDeleteGuest = (id: string) => {
      setGuestList(prev => prev.filter(g => g.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              setScannedImage(base64String);
              processOcr(base64String);
          };
          reader.readAsDataURL(file);
      }
  };

  const processOcr = async (base64Image: string) => {
      setIsScanning(true);
      setIsSheetSent(false); 
      try {
          const apiKey = await getGeminiApiKey();
          
          if (!apiKey) {
              notify('error', 'Chưa cấu hình Gemini API Key! Vui lòng vào Cài Đặt.');
              setIsScanning(false);
              return;
          }

          const ai = new GoogleGenAI({ apiKey: apiKey });
          const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
          const mimeType = base64Image.includes(';') ? base64Image.split(';')[0].split(':')[1] : 'image/jpeg';

          // UPDATED PROMPT WITH LOGIC BRANCHING
          const prompt = `Role: You are an expert OCR and Data Extraction AI specialized in Identity Documents (ID Cards, Passports).

Task: Extract information from the provided image and format it into a specific JSON structure based on the Nationality.

Rules:
1. Detect the Nationality (ISO 3-letter code, e.g., VNM, USA, KOR, CHN).
2. OUTPUT ONLY RAW JSON. No Markdown, no code blocks, no explanations.

LOGIC BRANCHING:

--- CASE 1: IF NATIONALITY IS VIETNAM ("VNM") ---
Return JSON with this structure:
{
  "is_vietnamese": true,
  "ho_va_ten": "FULL NAME IN UPPERCASE",
  "ngay_sinh": "dd/mm/yyyy",
  "gioi_tinh": "Nam" or "Nữ",
  "quoc_tich": "VNM",
  "so_giay_to": "ID Number",
  "loai_giay_to": "CCCD" (default) or "Passport" or "Giấy tờ khác",
  "ten_giay_to": "", // LEAVE EMPTY if loai_giay_to is CCCD or Passport. Only fill if it is "Giấy tờ khác".
  "dia_chi": {
    "tinh_tp": "Province/City Name",
    "quan_huyen": "District Name",
    "phuong_xa": "Ward/Commune Name",
    "chi_tiet": "Street, House No, Village (exclude admin units)"
  }
}

--- CASE 2: IF NATIONALITY IS NOT VIETNAM (FOREIGNER) ---
Return JSON with this structure:
{
  "is_vietnamese": false,
  "ho_va_ten": "FULL NAME IN UPPERCASE",
  "ngay_sinh": "dd/mm/yyyy",
  "gioi_tinh": "M" (if Male) or "F" (if Female), // Standardize to M/F
  "quoc_tich": "ISO 3-Letter Code (e.g. USA, GBR, AUS)",
  "so_ho_chieu": "Passport Number"
}

--- ERROR HANDLING ---
If a field is not visible, return empty string "".`;

          const response = await ai.models.generateContent({
              model: 'gemini-2.0-flash-exp', 
              contents: {
                  parts: [
                      { inlineData: { mimeType: mimeType, data: base64Data } },
                      { text: prompt }
                  ]
              },
              config: { 
                  responseMimeType: 'application/json',
                  temperature: 0 
              }
          });

          let text = response.text || '{}';
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          
          const data = JSON.parse(text);

          // FIX: Normalize gender for foreigners
          const normalizeGender = (val: string) => {
              if (!val) return '';
              const upper = val.toUpperCase();
              if (upper === 'M' || upper === 'MALE') return 'Nam';
              if (upper === 'F' || upper === 'FEMALE') return 'Nữ';
              return val;
          };

          let newOcrData = { ...ocrResult };

          if (data.is_vietnamese) {
              newOcrData = {
                  ...newOcrData,
                  ho_ten: data.ho_va_ten || '',
                  ngay_sinh: data.ngay_sinh || '',
                  gioi_tinh: data.gioi_tinh || '',
                  quoc_tich: 'VNM',
                  so_giay_to: data.so_giay_to || '',
                  loai_giay_to: data.loai_giay_to || 'CCCD',
                  tinh_tp: data.dia_chi?.tinh_tp || '',
                  quan_huyen: data.dia_chi?.quan_huyen || '',
                  phuong_xa: data.dia_chi?.phuong_xa || '',
                  dia_chi_chitiet: data.dia_chi?.chi_tiet || '',
                  loai_cu_tru: 'Lưu trú'
              };
          } else {
              newOcrData = {
                  ...newOcrData,
                  ho_ten: data.ho_va_ten || '',
                  ngay_sinh: data.ngay_sinh || '',
                  gioi_tinh: normalizeGender(data.gioi_tinh), // Apply normalization
                  quoc_tich: data.quoc_tich || '', // 'USA', etc.
                  so_giay_to: data.so_ho_chieu || '',
                  loai_giay_to: 'Passport',
                  // Clear VN specific address fields
                  tinh_tp: '',
                  quan_huyen: '',
                  phuong_xa: '',
                  dia_chi_chitiet: '',
                  loai_cu_tru: 'Lưu trú'
              };
          }
          
          setOcrResult(newOcrData);
          
          if (!formData.customerName || formData.customerName === 'Khách vãng lai') {
              setFormData(prev => ({ ...prev, customerName: newOcrData.ho_ten }));
          }

          const exists = guestList.some(g => g.idCard === newOcrData.so_giay_to);
          if (!exists) {
              const newGuest: Guest = {
                  id: crypto.randomUUID(),
                  fullName: newOcrData.ho_ten,
                  dob: newOcrData.ngay_sinh,
                  idCard: newOcrData.so_giay_to,
                  gender: newOcrData.gioi_tinh,
                  type: 'Người lớn', 
                  address: data.is_vietnamese ? `${newOcrData.dia_chi_chitiet}, ${newOcrData.phuong_xa}, ${newOcrData.quan_huyen}, ${newOcrData.tinh_tp}` : newOcrData.quoc_tich
              };
              setGuestList(prev => [...prev, newGuest]);
              notify('success', `Đã thêm khách: ${newOcrData.ho_ten}`);
          } else {
              notify('info', `Khách ${newOcrData.ho_ten} đã có trong danh sách.`);
          }

      } catch (err) {
          console.error("OCR Error:", err);
          notify('error', 'Không thể nhận diện ảnh. Kiểm tra lại API Key hoặc ảnh.');
      } finally {
          setIsScanning(false);
      }
  };

  // ... (Remainder of file is UI render, mostly unchanged except imports) ...
  const sendResidenceReport = async () => {
      if (!isInfoSufficient) {
          notify('error', 'Thiếu thông tin người đại diện!');
          return;
      }

      let formattedCheckIn = '';
      let formattedCheckOut = '';
      let rawCheckIn = '';
      let rawCheckOut = '';

      try {
          rawCheckIn = formData.checkinDate || '';
          if (!rawCheckIn && booking?.checkinDate) rawCheckIn = booking.checkinDate;
          if (!rawCheckIn) rawCheckIn = new Date().toISOString();

          rawCheckOut = formData.checkoutDate || '';
          if (!rawCheckOut && booking?.checkoutDate) rawCheckOut = booking.checkoutDate;
          if (!rawCheckOut) {
             const tmr = new Date();
             tmr.setDate(tmr.getDate() + 1);
             rawCheckOut = tmr.toISOString();
          }

          const parsedIn = parseISO(rawCheckIn);
          const parsedOut = parseISO(rawCheckOut);
          
          if (isNaN(parsedIn.getTime())) throw new Error("Invalid Checkin");
          if (isNaN(parsedOut.getTime())) throw new Error("Invalid Checkout");

          formattedCheckIn = format(parsedIn, 'dd/MM/yyyy');
          formattedCheckOut = format(parsedOut, 'dd/MM/yyyy');
      } catch (e) {
          formattedCheckIn = format(new Date(), 'dd/MM/yyyy');
          formattedCheckOut = format(new Date(), 'dd/MM/yyyy');
      }

      // Determine Nationality
      const isVietnam = ocrResult.quoc_tich === 'VNM' || ocrResult.quoc_tich === 'Việt Nam';
      
      let webhookPayload = {};

      if (isVietnam) {
          const idTypeMap: Record<string, string> = {
              'CCCD': 'Căn cước công dân',
              'Passport': 'Hộ chiếu',
              'Khác': 'Giấy tờ khác'
          };
          const finalIdType = idTypeMap[ocrResult.loai_giay_to] || ocrResult.loai_giay_to;
          
          webhookPayload = {
              sheet_target: "VIETNAM_GUEST",
              data: {
                  stt: "AUTO",
                  ho_va_ten: ocrResult.ho_ten.toUpperCase(),
                  ngay_sinh: ocrResult.ngay_sinh,
                  gioi_tinh: ocrResult.gioi_tinh,
                  quoc_tich: ocrResult.quoc_tich,
                  so_giay_to: ocrResult.so_giay_to,
                  loai_giay_to: finalIdType,
                  ten_giay_to: ocrResult.loai_giay_to === 'Khác' ? 'Giấy tờ khác' : '',
                  so_dien_thoai: ocrResult.so_dien_thoai,
                  loai_cu_tru: ocrResult.loai_cu_tru,
                  dia_chi_thuong_tru: {
                      tinh_tp: ocrResult.tinh_tp,
                      quan_huyen: ocrResult.quan_huyen,
                      phuong_xa: ocrResult.phuong_xa,
                      chi_tiet: ocrResult.dia_chi_chitiet
                  },
                  thoi_gian_luu_tru: {
                      tu_ngay: format(parseISO(rawCheckIn), 'dd/MM/yyyy HH:mm:ss'),
                      den_ngay: format(parseISO(rawCheckOut), 'dd/MM/yyyy HH:mm:ss')
                  },
                  ly_do: ocrResult.ly_do,
                  phong: isGroupMode ? selectedGroupRooms.join(', ') : formData.roomCode
              }
          };
      } else {
          // Foreigner Payload
          webhookPayload = {
              sheet_target: "FOREIGN_GUEST",
              data: {
                  stt: "AUTO",
                  ho_va_ten: ocrResult.ho_ten.toUpperCase(),
                  ngay_sinh: ocrResult.ngay_sinh,
                  dung_den: "D",
                  gioi_tinh: ocrResult.gioi_tinh, 
                  quoc_tich: ocrResult.quoc_tich, 
                  so_ho_chieu: ocrResult.so_giay_to,
                  ten_phong: isGroupMode ? selectedGroupRooms.join(', ') : formData.roomCode,
                  ngay_den: formattedCheckIn, 
                  ngay_di_du_kien: formattedCheckOut, 
                  ngay_tra_phong: "",
                  ghi_chu: ""
              }
          };
      }
      
      const hasCorrectWebhook = webhooks.some(w => w.is_active && w.event_type === 'residence_declaration');
      if (hasCorrectWebhook) {
          triggerWebhook('residence_declaration', webhookPayload);
      }

      // Guest History Log (Local DB)
      for (const guest of guestList) {
          if (!guest.idCard) continue; 
          
          const profile: GuestProfile = {
              full_name: guest.fullName.toUpperCase(),
              dob: guest.dob || '',
              gender: guest.gender || '',
              nationality: isVietnam ? 'Việt Nam' : ocrResult.quoc_tich,
              id_card_number: guest.idCard,
              card_type: isVietnam ? 'CCCD' : 'Passport',
              address: guest.address || '',
              phone: '',
              booking_id: booking?.id || '',
              staff_id: currentUser?.id
          };
          await addGuestProfile(profile);
      }

      setIsSheetSent(true);
      
      if (booking || formData.id) {
          const updatedBooking: Booking = { 
              ...(formData as Booking), 
              isDeclared: true,
              guestsJson: JSON.stringify(guestList)
          };
          if (booking) await updateBooking(updatedBooking);
          setFormData(updatedBooking);
      }
      notify('success', `Đã lưu hồ sơ ${guestList.length} khách hàng!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (availabilityError) {
        notify('error', 'Vui lòng chọn phòng khác, phòng này đang bận!');
        return;
    }
    
    if (isGroupMode) {
        if (!formData.groupName || selectedGroupRooms.length === 0) {
            notify('error', 'Vui lòng nhập tên đoàn và chọn ít nhất 1 phòng.');
            return;
        }
    } else {
        if (!formData.facilityName || !formData.roomCode || !formData.checkinDate || !formData.checkoutDate) {
            notify('error', 'Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }
    }

    setIsSubmitting(true);

    try {
        if (isGroupMode) {
            const groupId = `GRP-${Date.now()}`;
            const promises = selectedGroupRooms.map(async (rCode, index) => {
                const roomPrice = getPriceForDate(formData.facilityName!, rCode, formData.checkinDate!);
                const isLeader = index === 0; 
                
                const finalData: Booking = {
                    id: `DP${Date.now() + index}`,
                    createdDate: new Date().toISOString(),
                    facilityName: formData.facilityName!,
                    roomCode: rCode,
                    customerName: isLeader ? formData.customerName! : `Khách đoàn ${formData.groupName} (${index+1})`,
                    customerPhone: isLeader ? formData.customerPhone! : '',
                    source: formData.source || 'Khách đoàn',
                    collaborator: formData.collaborator!,
                    paymentMethod: formData.paymentMethod || '',
                    checkinDate: new Date(formData.checkinDate!).toISOString(),
                    checkoutDate: new Date(formData.checkoutDate!).toISOString(),
                    status: formData.status as BookingStatus,
                    price: roomPrice,
                    extraFee: 0,
                    totalRevenue: roomPrice, 
                    note: formData.note || '',
                    paymentsJson: '[]',
                    remainingAmount: roomPrice,
                    cleaningJson: '{}',
                    assignedCleaner: '',
                    servicesJson: '[]',
                    lendingJson: '[]',
                    guestsJson: isLeader ? JSON.stringify(guestList) : '[]', 
                    actualCheckIn: undefined,
                    actualCheckOut: undefined,
                    isDeclared: isLeader ? formData.isDeclared : false,
                    groupId: groupId,
                    groupName: formData.groupName,
                    isGroupLeader: isLeader
                };
                return addBooking(finalData);
            });
            
            await Promise.all(promises);
            // REMOVED: await refreshData(true); -> Optimistic update used
            notify('success', `Đã tạo ${selectedGroupRooms.length} phòng cho đoàn "${formData.groupName}"`);
            onClose(); 

        } else {
            await handleInventoryDeduction(usedServices);
            await handleLendingDeduction(lendingList); // Handle lending deduction

            const finalData: Booking = {
              id: booking?.id || `DP${Date.now()}`,
              createdDate: booking?.createdDate || new Date().toISOString(),
              facilityName: formData.facilityName!,
              roomCode: formData.roomCode!,
              customerName: formData.customerName!,
              customerPhone: formData.customerPhone!,
              source: formData.source || '',
              collaborator: formData.collaborator!,
              paymentMethod: formData.paymentMethod || '',
              checkinDate: new Date(formData.checkinDate!).toISOString(),
              checkoutDate: new Date(formData.checkoutDate!).toISOString(),
              status: formData.status as BookingStatus,
              price: Number(formData.price),
              extraFee: Number(formData.extraFee),
              totalRevenue,
              note: formData.note || '',
              paymentsJson: JSON.stringify(payments),
              remainingAmount: totalRevenue - totalPaid,
              cleaningJson: formData.cleaningJson || '{}',
              assignedCleaner: formData.assignedCleaner || '',
              servicesJson: JSON.stringify(usedServices),
              lendingJson: JSON.stringify(lendingList),
              guestsJson: JSON.stringify(guestList),
              actualCheckIn: formData.actualCheckIn,
              actualCheckOut: formData.actualCheckOut,
              isDeclared: formData.isDeclared,
              groupId: formData.groupId, 
              groupName: formData.groupName,
              isGroupLeader: formData.isGroupLeader
            };

            let success = false;
            if (booking) success = await updateBooking(finalData);
            else success = await addBooking(finalData);

            if (success) {
                // UPDATE BACK TO SHEET IF SELECTED
                if (selectedSheetRow) {
                    triggerWebhook('ota_import', {
                        action: 'update_room',
                        rowIndex: selectedSheetRow.rowIndex,
                        room: finalData.roomCode,
                        bookingCode: selectedSheetRow.bookingCode,
                        status: 'Đã xếp phòng'
                    });
                    notify('info', 'Đã gửi cập nhật số phòng lên Sheet.');
                }

                notify('success', 'Đã lưu booking thành công');
                onClose();
            }
            else notify('error', 'Lỗi lưu booking.');
        }

    } catch(err) {
        notify('error', 'Lỗi khi lưu Booking.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
     if (isSubmitting) return;
     const isAvailable = checkAvailability(formData.facilityName!, formData.roomCode!, formData.checkinDate!, formData.checkoutDate!, booking?.id);
     if (!isAvailable) { notify('error', 'Xung đột lịch!'); return; }

     setIsSubmitting(true);

     try {
         await handleInventoryDeduction(usedServices);
         await handleLendingDeduction(lendingList);

         const updatedBooking: Booking = { 
             ...(formData as Booking), 
             status: 'CheckedIn', 
             actualCheckIn: new Date().toISOString(),
             totalRevenue: totalRevenue,
             remainingAmount: remaining,
             paymentsJson: JSON.stringify(payments),
             servicesJson: JSON.stringify(usedServices),
             lendingJson: JSON.stringify(lendingList),
             guestsJson: JSON.stringify(guestList)
         };
         
         await updateBooking(updatedBooking);
         notify('success', '✅ Check-in thành công.');
         onClose();
     } finally {
         setIsSubmitting(false);
     }
  };

  const handleCheckOut = async () => {
     if (isSubmitting) return;
     if (remaining > 0) {
         if(!confirm(`⚠️ Khách vẫn còn nợ ${remaining.toLocaleString()}đ. Tiếp tục Checkout?`)) return;
     }
     setIsSubmitting(true);
     try {
         await handleInventoryDeduction(usedServices);
         // Note: Checkout does NOT deduct lending again, it should handle returning items (logic skipped for now per prompt)

         const now = new Date();
         const updatedBooking: Booking = { 
             ...(formData as Booking), 
             status: 'CheckedOut', 
             actualCheckOut: now.toISOString(),
             totalRevenue: totalRevenue,
             remainingAmount: remaining,
             paymentsJson: JSON.stringify(payments),
             servicesJson: JSON.stringify(usedServices),
             lendingJson: JSON.stringify(lendingList),
             guestsJson: JSON.stringify(guestList)
         };
         
         const facility = facilities.find(f => f.facilityName === formData.facilityName);
         if (facility) {
             const room = rooms.find(r => r.facility_id === facility.id && r.name === formData.roomCode);
             if (room) await upsertRoom({ ...room, status: 'Bẩn' });
         }
         await updateBooking(updatedBooking);
         triggerWebhook('checkout', { room: formData.roomCode, facility: formData.facilityName, customer: formData.customerName });
         
         notify('success', '👋 Đã Checkout thành công!');
         onClose();
     } catch (err) { notify('error', 'Lỗi khi Checkout.'); refreshData(); } finally { setIsSubmitting(false); }
  };

  // --- CANCELLATION LOGIC ---
  const handleConfirmCancel = async () => {
      if (!cancelReason) {
          notify('error', 'Vui lòng nhập lý do hủy phòng');
          return;
      }
      
      setIsSubmitting(true);
      try {
          // Tính toán hoàn tiền
          const refundAmount = totalPaid - cancelFee;
          let newPayments = [...payments];
          
          // Nếu có hoàn tiền (>0) -> Thêm record âm
          if (refundAmount > 0) {
              newPayments.push({
                  ngayThanhToan: new Date().toISOString(),
                  soTien: -refundAmount,
                  method: 'Cash',
                  ghiChu: `Hoàn tiền hủy phòng (Phí hủy: ${cancelFee.toLocaleString()})`
              });
          }

          // Cập nhật doanh thu = Phí hủy (Vì tiền thừa đã hoàn, tiền còn lại chính là doanh thu)
          const newTotalRevenue = cancelFee; 
          
          const updatedBooking: Booking = {
              ...(formData as Booking),
              status: 'Cancelled',
              paymentsJson: JSON.stringify(newPayments),
              totalRevenue: newTotalRevenue,
              remainingAmount: 0, // Đã xử lý xong tiền nong
              note: `${formData.note || ''}\n[HỦY PHÒNG]: ${cancelReason}. Phạt: ${cancelFee}, Hoàn: ${refundAmount}`
          };

          await updateBooking(updatedBooking);
          notify('success', 'Đã hủy đặt phòng và xử lý tài chính.');
          onClose();
      } catch (e) {
          notify('error', 'Lỗi khi hủy phòng.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const toInputDate = (val?: string) => {
     if (!val) return '';
     if (!val.endsWith('Z') && val.length === 16) return val; 
     const date = new Date(val);
     if (isNaN(date.getTime())) return '';
     const pad = (n: number) => n.toString().padStart(2, '0');
     return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleCreateGroupForExisting = async () => {
      if (!formData.id) return;
      const groupName = prompt('Nhập tên đoàn mới:');
      if (!groupName) return;

      setIsSubmitting(true);
      try {
          const groupId = `GRP-${Date.now()}`;
          const updatedBooking: Booking = {
              ...(formData as Booking),
              groupId: groupId,
              groupName: groupName,
              isGroupLeader: true
          };
          await updateBooking(updatedBooking);
          setFormData(updatedBooking);
          notify('success', `Đã tạo đoàn "${groupName}". Phòng này là Trưởng đoàn.`);
      } catch(e) {
          notify('error', 'Lỗi tạo đoàn.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handlePrintBill = () => {
      if (isGroupPaymentMode) {
          notify('info', `Đang in Hóa đơn tổng hợp cho đoàn "${formData.groupName}"...`);
      } else {
          notify('info', 'Đang in Hóa đơn lẻ...');
      }
      setTimeout(() => window.print(), 500);
  };

  const selectedFacilityId = facilities.find(f => f.facilityName === formData.facilityName)?.id;
  const availableRooms = selectedFacilityId ? rooms.filter(r => r.facility_id === selectedFacilityId).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : [];

  const displayRemaining = isGroupPaymentMode ? groupFinancials.remaining : remaining;
  const displayTotal = isGroupPaymentMode ? groupFinancials.total : totalRevenue;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={booking ? `Chi tiết Booking` : 'Tạo Booking Mới'} size="lg">
      <div className="flex flex-col h-full md:h-[80vh]">
        {/* Process Status Bar */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-4 w-full md:w-auto">
                 <div className={`h-14 min-w-[3.5rem] w-auto px-4 rounded-xl flex items-center justify-center font-bold text-2xl shadow-sm border-2 ${formData.status === 'CheckedOut' ? 'bg-slate-200 text-slate-500 border-slate-300' : formData.status === 'CheckedIn' ? 'bg-green-600 text-white border-green-500' : 'bg-blue-600 text-white border-blue-500'}`}>{formData.roomCode || (isGroupMode ? 'GRP' : '?')}</div>
                 <div className="flex-1">
                     <div className="font-bold text-lg text-slate-800 line-clamp-1 flex items-center gap-2">
                         {formData.customerName || 'Khách Mới'}
                         {formData.isDeclared && <span title="Đã khai báo lưu trú"><ShieldCheck size={16} className="text-emerald-500"/></span>}
                         {formData.groupName && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{formData.groupName}</span>}
                     </div>
                     <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">{formData.status}</span>
                 </div>
             </div>
             {formData.id && formData.status !== 'Cancelled' && (
                 <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                     {formData.status === 'Confirmed' && <button onClick={handleCheckIn} disabled={!!availabilityError || isSubmitting} className={`flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 whitespace-nowrap ${availabilityError || isSubmitting ? 'opacity-50' : ''}`}>
                         {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20}/>} CHECK IN
                     </button>}
                     
                     {formData.status === 'CheckedIn' && <div className="flex gap-2 w-full md:w-auto">
                     <button onClick={handleCheckOut} disabled={isSubmitting} className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-70">
                         {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20}/>} CHECK OUT
                     </button></div>}
                 </div>
             )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 mb-4 px-2 overflow-x-auto">
           <button onClick={() => setActiveTab('info')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'info' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}><FileText size={16} className="inline mr-2"/> Thông Tin</button>
           <button onClick={() => setActiveTab('services')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'services' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}><ShoppingCart size={16} className="inline mr-2"/> Dịch Vụ {usedServices.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{usedServices.length}</span>}</button>
           <button onClick={() => setActiveTab('payment')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'payment' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}><Banknote size={16} className="inline mr-2" /> Thanh Toán {remaining > 0 && <span className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 rounded-full">!</span>}</button>
           <button onClick={() => setActiveTab('ocr')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ocr' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}><ScanLine size={16} className="inline mr-2" /> Quét AI</button>
        </div>

        {/* CANCELLATION OVERLAY */}
        {isCancelling ? (
            <div className="flex-1 overflow-y-auto p-4 bg-red-50/50 rounded-xl border-2 border-red-100 animate-in fade-in zoom-in-95">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <XCircle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-red-700">Xác nhận Hủy Phòng</h3>
                        <p className="text-sm text-red-500 font-medium mt-1">Hành động này sẽ giải phóng phòng và ghi nhận doanh thu thực tế.</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lý do hủy (Bắt buộc)</label>
                            <input 
                                className="w-full border-2 border-red-100 rounded-lg p-2.5 text-sm outline-none focus:border-red-400 font-medium" 
                                placeholder="VD: Khách đổi ý, Bận việc đột xuất..." 
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Khách đã thanh toán:</span>
                                <span className="font-bold text-slate-800">{totalPaid.toLocaleString()} ₫</span>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block flex items-center gap-1"><AlertOctagon size={12}/> Phí phạt / Giữ lại (Doanh thu)</label>
                                <input 
                                    type="number" 
                                    className="w-full border-2 border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 outline-none focus:border-brand-500" 
                                    value={cancelFee}
                                    onChange={e => setCancelFee(Number(e.target.value))}
                                />
                            </div>

                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-sm font-bold text-slate-600">Cần hoàn trả khách:</span>
                                <span className="font-black text-lg text-emerald-600">
                                    {(totalPaid - cancelFee).toLocaleString()} ₫
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setIsCancelling(false)} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Quay lại</button>
                        <button 
                            onClick={handleConfirmCancel}
                            disabled={!cancelReason || isSubmitting}
                            className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>} Xác Nhận Hủy
                        </button>
                    </div>
                </div>
            </div>
        ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 px-1">
           <form id="bookingForm" onSubmit={handleSubmit} className="space-y-4 pb-8">
              {availabilityError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 font-bold animate-pulse"><AlertTriangle size={20} />{availabilityError}</div>}
              
              {activeTab === 'info' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                   {/* ... Info content kept same ... */}
                   {!booking && (
                       <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg w-fit border border-slate-200">
                           <button 
                                type="button"
                                onClick={() => { setIsGroupMode(false); setSelectedGroupRooms([defaultData?.roomCode || '']); }}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isGroupMode ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}
                           >
                               Khách Lẻ
                           </button>
                           <button 
                                type="button"
                                onClick={() => setIsGroupMode(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isGroupMode ? 'bg-purple-600 shadow-sm text-white' : 'text-slate-500 hover:text-purple-600'}`}
                           >
                               Đặt Theo Đoàn
                           </button>
                       </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Cơ sở</label><select required className="w-full border rounded p-2.5 text-sm bg-white text-slate-900 shadow-sm" value={formData.facilityName} onChange={e => setFormData({...formData, facilityName: e.target.value, roomCode: '', price: 0})}><option value="">-- Chọn --</option>{facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}</select></div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">
                              {isGroupMode ? `Chọn phòng (${selectedGroupRooms.length})` : 'Phòng'}
                          </label>
                          
                          {isGroupMode ? (
                              <div className="border rounded p-2 bg-white max-h-32 overflow-y-auto custom-scrollbar shadow-inner">
                                  <div className="grid grid-cols-3 gap-2">
                                      {availableRooms.map(r => {
                                          const isSelected = selectedGroupRooms.includes(r.name);
                                          const isBusy = !checkAvailability(formData.facilityName!, r.name, formData.checkinDate!, formData.checkoutDate!, booking?.id);
                                          return (
                                              <button 
                                                key={r.name}
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => {
                                                    if(isSelected) setSelectedGroupRooms(prev => prev.filter(x => x !== r.name));
                                                    else setSelectedGroupRooms(prev => [...prev, r.name]);
                                                }}
                                                className={`
                                                    text-xs font-bold py-1.5 rounded border transition-all
                                                    ${isSelected ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-purple-300'}
                                                    ${isBusy ? 'opacity-40 cursor-not-allowed bg-slate-100 line-through' : ''}
                                                `}
                                              >
                                                  {r.name}
                                              </button>
                                          )
                                      })}
                                  </div>
                              </div>
                          ) : (
                              <select required className="w-full border rounded p-2.5 text-sm font-bold bg-white text-slate-900 shadow-sm" value={formData.roomCode} onChange={e => handleRoomChange(e.target.value)}><option value="">-- Chọn --</option>{availableRooms.map((r) => (<option key={r.name} value={r.name}>{r.name} {r.type ? `- ${r.type}` : ''} {r.price ? `(${r.price/1000}k)` : ''} - {r.status}</option>))}</select>
                          )}
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                          <label className="block text-xs font-bold text-slate-500 mb-1">{isGroupMode ? 'Trưởng đoàn (Đại diện)' : 'Người đặt (Đại diện)'}</label>
                          <input required className="w-full border rounded p-2.5 text-sm bg-white text-slate-900 shadow-sm" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} placeholder="Nguyễn Văn A" />
                          <button type="button" onClick={() => setActiveTab('ocr')} className="absolute top-6 right-2 p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="Quét CCCD"><ScanLine size={16}/></button>
                          
                          {/* Load from Sheet Button */}
                          <button type="button" onClick={fetchSheetData} className="absolute top-6 right-10 p-1.5 text-green-600 hover:bg-green-50 rounded" title="Tải từ Sheet"><FileSpreadsheet size={16}/></button>
                          
                          {/* Sheet Selection Dropdown */}
                          {showSheetList && (
                              <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg z-50 mt-1 max-h-48 overflow-y-auto">
                                  {isSheetLoading ? (
                                      <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={14}/> Đang tải...</div>
                                  ) : (
                                      <div className="divide-y divide-slate-100">
                                          <div className="px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">Chọn khách từ Sheet</div>
                                          {sheetData.map((row, idx) => (
                                              <button key={idx} type="button" onClick={() => handleSheetSelect(row)} className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex justify-between items-center">
                                                  <div>
                                                      <div className="font-bold text-slate-800">{row.customerName}</div>
                                                      <div className="text-[10px] text-slate-500">{row.platform} • {row.checkIn} &rarr; {row.checkOut}</div>
                                                  </div>
                                                  <div className="text-[10px] font-mono text-slate-400">{row.bookingCode}</div>
                                              </button>
                                          ))}
                                          {sheetData.length === 0 && <div className="p-3 text-center text-xs text-slate-400">Không có dữ liệu</div>}
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Điện thoại</label>
                          <input required className="w-full border rounded p-2.5 text-sm bg-white text-slate-900 shadow-sm" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="09xxxx" />
                      </div>
                   </div>

                   <div className="mt-4 border-t border-slate-200 pt-4">
                       <div className="flex justify-between items-center mb-3">
                           <div className="flex items-center gap-2">
                               <Users size={16} className="text-brand-600"/>
                               <span className="text-sm font-bold text-slate-700">Danh sách khách lưu trú</span>
                               <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{guestList.length}</span>
                           </div>
                           <div className="flex gap-2">
                               <button type="button" onClick={() => setActiveTab('ocr')} className="text-[10px] flex items-center gap-1 bg-brand-50 text-brand-700 px-2 py-1 rounded font-bold hover:bg-brand-100"><ScanLine size={12}/> Quét thêm</button>
                               <button type="button" onClick={handleAddGuest} className="text-[10px] flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold hover:bg-slate-200"><UserPlus size={12}/> Thủ công</button>
                           </div>
                       </div>
                       
                       {guestList.length === 0 ? (
                           <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                               Chưa có thông tin khách. Vui lòng quét CCCD hoặc thêm mới.
                           </div>
                       ) : (
                           <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                               {guestList.map((guest, index) => (
                                   <div key={guest.id} className="flex items-start justify-between p-3 bg-white border border-emerald-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                                       <div className="flex items-start gap-3">
                                           <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                                               {index + 1}
                                           </div>
                                           <div>
                                               <input 
                                                   className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-brand-500 outline-none w-full"
                                                   value={guest.fullName}
                                                   onChange={e => handleUpdateGuest(guest.id, 'fullName', e.target.value)}
                                                   placeholder="Họ tên"
                                               />
                                               <div className="flex items-center gap-2 mt-1">
                                                   <input 
                                                       className="text-[10px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-brand-500 outline-none w-[80px]"
                                                       value={guest.dob}
                                                       onChange={e => handleUpdateGuest(guest.id, 'dob', e.target.value)}
                                                       placeholder="Ngày sinh"
                                                   />
                                                   <span className="text-slate-300">|</span>
                                                   <input 
                                                       className="text-[10px] font-mono text-slate-600 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-brand-500 outline-none w-[100px]"
                                                       value={guest.idCard}
                                                       onChange={e => handleUpdateGuest(guest.id, 'idCard', e.target.value)}
                                                       placeholder="Số giấy tờ"
                                                   />
                                               </div>
                                           </div>
                                       </div>
                                       <button type="button" onClick={() => handleDeleteGuest(guest.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                           <Trash2 size={14}/>
                                       </button>
                                   </div>
                               ))}
                           </div>
                       )}
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Check-in</label><input required type="datetime-local" className="w-full border rounded p-2.5 text-sm bg-white" value={toInputDate(formData.checkinDate)} onChange={e => handleCheckinDateChange(e.target.value)} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Check-out</label><input required type="datetime-local" className="w-full border rounded p-2.5 text-sm bg-white" value={toInputDate(formData.checkoutDate)} onChange={e => handleCheckoutDateChange(e.target.value)} /></div>
                   </div>
                   
                   {!isGroupMode && (
                       <div className="grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Giá phòng</label>
                              <div className="relative">
                                  <input type="number" className="w-full border rounded p-2.5 text-sm font-bold bg-white" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                                  <span className="absolute right-2 top-2.5 text-[10px] font-bold text-slate-400">
                                      {calculateNights(formData.checkinDate!, formData.checkoutDate!)} đêm
                                  </span>
                              </div>
                          </div>
                          <div><label className="block text-xs font-bold text-slate-500 mb-1">Phụ thu</label><input type="number" className="w-full border rounded p-2.5 text-sm font-bold bg-white text-red-600" value={formData.extraFee} onChange={e => setFormData({...formData, extraFee: Number(e.target.value)})} /></div>
                       </div>
                   )}
                   
                   <div><label className="block text-xs font-bold text-slate-500 mb-1">Ghi chú</label><textarea className="w-full border rounded p-2.5 text-sm h-20 bg-white" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="Ví dụ: Khách yêu cầu tầng cao, checkin sớm..."></textarea></div>
                </div>
              )}
              
              {activeTab === 'services' && (
                <div className="flex flex-col md:flex-row gap-6 md:h-[450px] animate-in slide-in-from-right duration-300">
                   {/* LEFT: Item Selector */}
                   <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl p-4 bg-slate-50 custom-scrollbar max-h-[300px] md:max-h-full">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Danh mục hàng hóa & Đồ mượn</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                         {services.map(s => {
                             const isLending = s.category === 'Linen' || s.category === 'Asset';
                             return (
                                <button 
                                    key={s.id} 
                                    type="button" 
                                    onClick={() => handleAddService(s.id)} 
                                    className={`flex flex-col items-center justify-center p-3 border rounded-xl hover:shadow-md transition-all active:scale-95 group relative ${isLending ? 'bg-blue-50 border-blue-200 hover:border-blue-400' : 'bg-white border-slate-200 hover:border-brand-500'}`}
                                >
                                   {isLending && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></div>}
                                   <span className="font-bold text-xs text-slate-700 line-clamp-1 group-hover:text-brand-600 transition-colors text-center">{s.name}</span>
                                   <span className={`text-[10px] font-black mt-1 uppercase ${isLending ? 'text-blue-600' : 'text-brand-600'}`}>
                                       {isLending ? 'Mượn' : `${s.price.toLocaleString()} Đ`}
                                   </span>
                                </button>
                             );
                         })}
                      </div>
                   </div>

                   {/* RIGHT: Selected Items (Split View) */}
                   <div className="w-full md:w-[320px] flex flex-col gap-4">
                      
                      {/* SECTION 1: BILLABLE (Minibar & Service) */}
                      <div className="flex-1 flex flex-col overflow-hidden border border-slate-100 rounded-2xl bg-white shadow-sm">
                         <h4 className="px-4 py-2 bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                             <span>Minibar & Dịch Vụ (Tính tiền)</span>
                             <span className="bg-brand-100 text-brand-700 px-1.5 rounded">{usedServices.length}</span>
                         </h4>
                         <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                             {usedServices.length === 0 ? (
                                <div className="py-8 text-center text-slate-300 italic text-xs">Chưa có dịch vụ tính phí</div>
                             ) : (
                                usedServices.map(s => (
                                    <div key={s.serviceId} className="p-3 flex items-center justify-between hover:bg-slate-50 border-b last:border-0 transition-colors">
                                       <div className="flex-1">
                                          <div className="font-bold text-xs text-slate-700">{s.name}</div>
                                          <div className="text-[10px] text-slate-400">{s.price.toLocaleString()} Đ</div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <button type="button" onClick={() => handleUpdateServiceQty(s.serviceId, -1)} className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"><Minus size={12}/></button>
                                          <span className="font-black text-xs w-5 text-center">{s.quantity}</span>
                                          <button type="button" onClick={() => handleUpdateServiceQty(s.serviceId, 1)} className="p-1 hover:bg-green-50 text-green-500 rounded transition-colors"><Plus size={12}/></button>
                                       </div>
                                    </div>
                                ))
                             )}
                         </div>
                         <div className="p-3 bg-slate-100 border-t flex justify-between items-center">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Tổng cộng:</span>
                             <span className="font-black text-sm text-brand-600">{serviceTotal.toLocaleString()} ₫</span>
                         </div>
                      </div>

                      {/* SECTION 2: LENDING (Linen & Asset) */}
                      <div className="flex-1 flex flex-col overflow-hidden border border-blue-100 rounded-2xl bg-white shadow-sm ring-1 ring-blue-50">
                         <h4 className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center justify-between">
                             <span>Đồ Cho Mượn (Miễn phí)</span>
                             <span className="bg-white text-blue-600 px-1.5 rounded shadow-sm">{lendingList.length}</span>
                         </h4>
                         <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                             {lendingList.length === 0 ? (
                                <div className="py-8 text-center text-slate-300 italic text-xs">Chưa mượn đồ gì</div>
                             ) : (
                                lendingList.map(l => (
                                    <div key={l.item_id} className="p-3 flex items-center justify-between hover:bg-blue-50/50 border-b border-blue-50 last:border-0 transition-colors">
                                       <div className="flex-1">
                                          <div className="font-bold text-xs text-slate-700 flex items-center gap-1">
                                              <Shirt size={12} className="text-blue-400"/> {l.item_name}
                                          </div>
                                          <div className="text-[9px] text-slate-400 italic">Kho sạch &rarr; Đang dùng</div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <button type="button" onClick={() => handleUpdateLendingQty(l.item_id, -1)} className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"><Minus size={12}/></button>
                                          <span className="font-black text-xs w-5 text-center text-blue-700">{l.quantity}</span>
                                          <button type="button" onClick={() => handleUpdateLendingQty(l.item_id, 1)} className="p-1 hover:bg-green-50 text-green-500 rounded transition-colors"><Plus size={12}/></button>
                                       </div>
                                    </div>
                                ))
                             )}
                         </div>
                      </div>

                   </div>
                </div>
              )}

              {activeTab === 'payment' && (
                 <div className="space-y-6 animate-in slide-in-from-right duration-300">
                    <div className={`flex flex-col sm:flex-row justify-between items-center p-5 rounded-2xl border shadow-md gap-4 ${displayRemaining <= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                       <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className={`p-2 rounded-full ${displayRemaining <= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                             {displayRemaining <= 0 ? <CheckCircle size={24}/> : <AlertTriangle size={24}/>}
                          </div>
                          <div>
                             <span className="font-black text-xs uppercase tracking-widest opacity-70 block mb-1">{displayRemaining <= 0 ? 'TRẠNG THÁI' : (isGroupPaymentMode ? 'TỔNG NỢ CẢ ĐOÀN' : 'SỐ TIỀN CÒN LẠI')}</span>
                             <span className="font-black text-2xl">{displayRemaining <= 0 ? 'ĐÃ THANH TOÁN ĐỦ' : displayRemaining.toLocaleString() + ' ₫'}</span>
                          </div>
                       </div>
                       {displayRemaining > 0 && <button type="button" onClick={handleQuickPayAll} className="w-full sm:w-auto px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-rose-700 transition-all active:scale-95 uppercase tracking-widest">Thu nhanh</button>}
                    </div>
                    {/* ... (Rest of Payment UI same as before) ... */}
                    <div className="flex flex-col md:flex-row gap-6">
                        {/* History */}
                        {!isGroupPaymentMode && (
                            <div className="flex-1 bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col overflow-y-auto custom-scrollbar max-h-[300px] md:h-[480px]">
                                <h4 className="font-black text-slate-500 mb-4 text-[10px] uppercase tracking-widest flex items-center gap-2"><History size={14}/> Lịch sử thanh toán</h4>
                                {payments.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-slate-400 italic text-xs">Chưa có giao dịch nào</div>
                                ) : (
                                    payments.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-sm mb-3 animate-in fade-in duration-300">
                                            <div>
                                                <div className="font-black text-brand-600 text-lg">+{p.soTien.toLocaleString()} Đ</div>
                                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">{format(parseISO(p.ngayThanhToan), 'HH:mm dd/MM/yyyy')}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-wider ${p.method === 'Cash' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                    {p.method === 'Cash' ? 'Tiền mặt' : p.method === 'Transfer' ? 'CK' : p.method || 'Khác'}
                                                </span>
                                                <button type="button" onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                        {/* Payment Input */}
                        <div className={`w-full ${isGroupPaymentMode ? 'md:w-full' : 'md:w-[320px]'} bg-white p-5 rounded-2xl border border-brand-100 shadow-lg shadow-brand-50 flex flex-col gap-4`}>
                            <h4 className="font-black text-brand-700 text-[10px] uppercase tracking-widest">{isGroupPaymentMode ? 'Thanh toán cho cả đoàn' : 'Thêm thanh toán'}</h4>
                            <div><label className="text-[10px] font-black text-slate-400 mb-2 block tracking-widest uppercase">Số tiền (VNĐ)</label><input type="number" className="w-full border-2 border-brand-50 rounded-xl p-3 text-2xl font-black text-brand-600 focus:border-brand-500 outline-none bg-slate-50/50" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" /></div>
                            
                            <div>
                                <label className="text-[10px] font-black text-slate-400 mb-2 block tracking-widest uppercase">Hình thức</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => setPayMethod('Cash')} className={`text-[10px] py-2.5 rounded-xl border-2 font-black uppercase tracking-widest transition-all ${payMethod === 'Cash' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>Tiền mặt</button>
                                    <button type="button" onClick={() => setPayMethod('Transfer')} className={`text-[10px] py-2.5 rounded-xl border-2 font-black uppercase tracking-widest transition-all ${payMethod === 'Transfer' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>CK</button>
                                    <button type="button" onClick={() => setPayMethod('Card')} className={`text-[10px] py-2.5 rounded-xl border-2 font-black uppercase tracking-widest transition-all ${payMethod === 'Card' ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>Thẻ</button>
                                </div>
                                <input type="text" className="w-full border rounded-xl p-3 text-sm bg-slate-50 mt-3 text-slate-700 placeholder-slate-400 border-slate-100" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Ghi chú thêm..." />
                            </div>

                            <button type="button" onClick={handleAddPayment} disabled={!payAmount || Number(payAmount) === 0 || isSubmitting} className="mt-auto w-full bg-brand-600 text-white py-4 rounded-xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:bg-slate-200 disabled:shadow-none mb-2">
                                {isSubmitting ? <Loader2 className="animate-spin inline mr-2"/> : null} 
                                {isGroupPaymentMode ? 'Xác Nhận Thu (Cả Đoàn)' : 'Xác Nhận Thu'}
                            </button>
                            
                            <button type="button" onClick={handlePrintBill} className="w-full bg-white text-slate-600 border-2 border-slate-200 py-3 rounded-xl font-black hover:bg-slate-50 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 shrink-0">
                                <Printer size={16}/> {isGroupPaymentMode ? 'In Hóa Đơn Tổng' : 'In Hóa Đơn'}
                            </button>
                        </div>
                    </div>
                 </div>
              )}

              {/* ... (OCR Tab kept same) ... */}
              {activeTab === 'ocr' && (
                 <div className="space-y-6 animate-in slide-in-from-right duration-300">
                     <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 p-6 rounded-2xl">
                         <div className="flex flex-col md:flex-row gap-6">
                             {/* Upload Area */}
                             <div className="flex-1">
                                 <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><ScanLine size={18}/> Quét CCCD/Hộ Chiếu</h4>
                                 <input 
                                     type="file" 
                                     accept="image/*" 
                                     ref={fileInputRef}
                                     className="hidden" 
                                     onChange={handleFileSelect} 
                                 />
                                 
                                 <div 
                                     onClick={() => !scannedImage && fileInputRef.current?.click()}
                                     className={`
                                        border-2 border-dashed border-indigo-200 rounded-xl bg-white flex flex-col items-center justify-center transition-all min-h-[350px] relative overflow-hidden group
                                        ${!scannedImage ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 p-6' : ''}
                                     `}
                                 >
                                     {scannedImage ? (
                                         <div 
                                            className="relative w-full h-full cursor-crosshair overflow-hidden flex items-center justify-center bg-black/5"
                                            onMouseMove={handleImageMouseMove}
                                            onMouseLeave={handleImageMouseLeave}
                                         >
                                             <div className="w-full h-[350px] relative overflow-hidden">
                                                <img 
                                                    src={scannedImage} 
                                                    alt="Scan preview" 
                                                    className="w-full h-full object-contain origin-center transition-transform duration-100 ease-out"
                                                    style={zoomStyle} 
                                                />
                                             </div>

                                             {isScanning && (
                                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="animate-spin text-indigo-600" size={32} />
                                                        <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-full shadow-sm border border-indigo-100">AI đang xử lý...</span>
                                                    </div>
                                                </div>
                                             )}

                                             <button 
                                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                className="absolute top-3 right-3 p-2 bg-white/90 text-slate-600 rounded-lg shadow-sm hover:bg-white hover:text-indigo-600 transition-colors z-20 border border-slate-200"
                                                title="Chọn ảnh khác"
                                             >
                                                 <Upload size={16}/>
                                             </button>
                                         </div>
                                     ) : (
                                         <>
                                             <div className="bg-indigo-100 p-4 rounded-full text-indigo-600 mb-3 group-hover:scale-110 transition-transform"><Upload size={24}/></div>
                                             <span className="text-sm font-bold text-slate-600">Tải ảnh hoặc chụp</span>
                                             <span className="text-xs text-slate-400 mt-1 text-center">Tự động thêm vào danh sách khách</span>
                                         </>
                                     )}
                                 </div>
                             </div>

                             <div className="flex-[1.5] bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex flex-col max-h-[500px] overflow-y-auto custom-scrollbar">
                                 <h4 className="font-bold text-slate-700 mb-3 flex items-center justify-between sticky top-0 bg-white z-10 py-1">
                                     <span>Thông Tin Trích Xuất</span>
                                     <div className="flex gap-2">
                                         <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase border ${ocrResult.loai_giay_to === 'Passport' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{ocrResult.loai_giay_to}</span>
                                     </div>
                                 </h4>
                                 
                                 <div className="space-y-4 pb-2">
                                     <div className="grid grid-cols-2 gap-3">
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">Họ và tên</label>
                                             <input className="w-full border rounded p-2 text-sm font-bold bg-slate-50 uppercase" value={ocrResult.ho_ten} onChange={e => setOcrResult({...ocrResult, ho_ten: e.target.value.toUpperCase()})} />
                                         </div>
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">Số giấy tờ</label>
                                             <input className="w-full border rounded p-2 text-sm font-bold bg-slate-50 text-indigo-600" value={ocrResult.so_giay_to} onChange={e => setOcrResult({...ocrResult, so_giay_to: e.target.value})} />
                                         </div>
                                     </div>

                                     <div className="grid grid-cols-3 gap-3">
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày sinh</label>
                                             <input className="w-full border rounded p-2 text-sm bg-slate-50" placeholder="dd/mm/yyyy" value={ocrResult.ngay_sinh} onChange={e => setOcrResult({...ocrResult, ngay_sinh: e.target.value})} />
                                         </div>
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">Giới tính</label>
                                             <input className="w-full border rounded p-2 text-sm bg-slate-50" value={ocrResult.gioi_tinh} onChange={e => setOcrResult({...ocrResult, gioi_tinh: e.target.value})} />
                                         </div>
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">Quốc tịch</label>
                                             <input className="w-full border rounded p-2 text-sm bg-slate-50" value={ocrResult.quoc_tich} onChange={e => setOcrResult({...ocrResult, quoc_tich: e.target.value})} />
                                         </div>
                                     </div>

                                     {ocrResult.quoc_tich === 'VNM' || ocrResult.quoc_tich === 'Việt Nam' ? (
                                     <div>
                                         <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Địa chỉ thường trú (Tách cột)</label>
                                         <div className="grid grid-cols-3 gap-2 mb-2">
                                             <input className="border rounded p-2 text-sm bg-slate-50" placeholder="Tỉnh/TP" value={ocrResult.tinh_tp} onChange={e => setOcrResult({...ocrResult, tinh_tp: e.target.value})} />
                                             <input className="border rounded p-2 text-sm bg-slate-50" placeholder="Quận/Huyện" value={ocrResult.quan_huyen} onChange={e => setOcrResult({...ocrResult, quan_huyen: e.target.value})} />
                                             <input className="border rounded p-2 text-sm bg-slate-50" placeholder="Phường/Xã" value={ocrResult.phuong_xa} onChange={e => setOcrResult({...ocrResult, phuong_xa: e.target.value})} />
                                         </div>
                                         <input className="w-full border rounded p-2 text-sm bg-slate-50" placeholder="Số nhà, đường, thôn/xóm..." value={ocrResult.dia_chi_chitiet} onChange={e => setOcrResult({...ocrResult, dia_chi_chitiet: e.target.value})} />
                                     </div>
                                     ) : null}

                                     {ocrResult.quoc_tich === 'VNM' || ocrResult.quoc_tich === 'Việt Nam' ? (
                                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                         <div className="grid grid-cols-2 gap-3">
                                             <div>
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Loại cư trú</label>
                                                 <select className="w-full border rounded p-2 text-sm bg-white" value={ocrResult.loai_cu_tru} onChange={e => setOcrResult({...ocrResult, loai_cu_tru: e.target.value})}>
                                                     <option value="Lưu trú">Lưu trú</option>
                                                     <option value="Tạm trú">Tạm trú</option>
                                                     <option value="Thường trú">Thường trú</option>
                                                 </select>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Lý do lưu trú</label>
                                                 <input className="w-full border rounded p-2 text-sm bg-white" placeholder="Du lịch, công tác..." value={ocrResult.ly_do} onChange={e => setOcrResult({...ocrResult, ly_do: e.target.value})} />
                                             </div>
                                         </div>
                                     </div>
                                     ) : null}

                                     <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-in fade-in">
                                         <div>
                                             <label className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1"><Calendar size={10}/> Ngày đến (Đồng bộ)</label>
                                             <input disabled className="w-full bg-transparent font-bold text-sm text-slate-700 mt-1 cursor-not-allowed" value={formData.checkinDate ? format(parseISO(formData.checkinDate), 'dd/MM/yyyy HH:mm') : ''} placeholder="Chưa chọn ngày" />
                                         </div>
                                         <div>
                                             <label className="text-[10px] font-bold text-blue-500 uppercase flex items-center gap-1"><Calendar size={10}/> Ngày đi (Đồng bộ)</label>
                                             <input disabled className="w-full bg-transparent font-bold text-sm text-slate-700 mt-1 cursor-not-allowed" value={formData.checkoutDate ? format(parseISO(formData.checkoutDate), 'dd/MM/yyyy HH:mm') : ''} placeholder="Chưa chọn ngày" />
                                         </div>
                                     </div>
                                 </div>

                                 <div className="mt-auto pt-4 border-t border-indigo-50 flex justify-end gap-2 sticky bottom-0 bg-white">
                                     <button onClick={() => {
                                         setActiveTab('info');
                                     }} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                                         Quay lại Info
                                     </button>
                                     <button 
                                        onClick={sendResidenceReport}
                                        disabled={!isInfoSufficient || isSheetSent}
                                        className={`
                                            px-4 py-2 rounded-lg font-bold text-xs shadow-md flex items-center gap-2 transition-all
                                            ${isSheetSent 
                                                ? 'bg-green-600 text-white cursor-not-allowed opacity-80' 
                                                : isInfoSufficient 
                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                                        `}
                                     >
                                         {isSheetSent ? <><Check size={14}/> Đã Lưu</> : <><Send size={14}/> Lưu Hồ Sơ Khách</>}
                                     </button>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
              )}
           </form>
        </div>
        )}

        <div className="flex justify-between gap-3 pt-6 border-t border-slate-100 mt-auto bg-white px-2 sticky bottom-0">
           {/* Nút hủy phòng (Chỉ hiện khi chưa hủy và chưa check-out xong) */}
           {formData.id && formData.status !== 'Cancelled' && formData.status !== 'CheckedOut' && !isCancelling ? (
                <button 
                    type="button" 
                    onClick={() => setIsCancelling(true)} 
                    className="px-6 py-3 rounded-xl text-rose-600 font-black text-xs uppercase tracking-widest hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
                >
                    Hủy Đặt Phòng
                </button>
           ) : <div />}

           {/* Normal Footer Actions - Hidden when cancelling */}
           {!isCancelling && (
               <div className="flex gap-3">
                   <button type="button" onClick={onClose} disabled={isSubmitting} className="px-8 py-3 rounded-xl text-slate-500 hover:bg-slate-100 font-black text-xs uppercase tracking-widest transition-colors">Đóng</button>
                   <button form="bookingForm" type="submit" disabled={!!availabilityError || isSubmitting} className={`px-10 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-100 transition-all active:scale-95 flex items-center gap-2 ${availabilityError || isSubmitting ? 'opacity-50' : ''}`}>
                       {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                       {isSubmitting ? 'Đang Lưu...' : 'Lưu Thông Tin'}
                   </button>
               </div>
           )}
        </div>
      </div>
    </Modal>
  );
};
