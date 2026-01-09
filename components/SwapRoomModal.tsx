
import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from './Modal';
import { Booking, Room } from '../types';
import { useAppContext } from '../context/AppContext';
import { ArrowRightLeft, AlertCircle, ArrowRight, Wallet, Calculator, Info } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';

interface SwapRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
}

// 3 Chiến lược giá rõ ràng
type PriceStrategy = 'KEEP_OLD' | 'RECALCULATE' | 'CUSTOM';

export const SwapRoomModal: React.FC<SwapRoomModalProps> = ({ isOpen, onClose, booking }) => {
  const { rooms, facilities, updateBooking, upsertRoom, checkAvailability, notify } = useAppContext();
  const [targetRoomCode, setTargetRoomCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pricing State
  const [priceStrategy, setPriceStrategy] = useState<PriceStrategy>('KEEP_OLD');
  const [customTotal, setCustomTotal] = useState<number>(0);

  // Reset state on open
  useEffect(() => {
      setTargetRoomCode('');
      setPriceStrategy('KEEP_OLD');
      setCustomTotal(booking?.totalRevenue || 0);
  }, [isOpen, booking]);

  // Tìm danh sách phòng khả dụng
  const availableTargetRooms = useMemo(() => {
      if (!booking) return [];
      const facilityId = facilities.find(f => f.facilityName === booking.facilityName)?.id;
      if (!facilityId) return [];

      return rooms.filter(r => {
          if (r.facility_id !== facilityId) return false;
          if (r.name === booking.roomCode) return false;
          if (r.status === 'Sửa chữa') return false;
          return checkAvailability(booking.facilityName, r.name, booking.checkinDate, booking.checkoutDate, booking.id);
      }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [booking, rooms, facilities, checkAvailability]);

  const selectedRoomData = rooms.find(r => r.facility_id === facilities.find(f => f.facilityName === booking.facilityName)?.id && r.name === targetRoomCode);

  // --- LOGIC TÍNH TOÁN CỐT LÕI ---
  const calculation = useMemo(() => {
      // Mặc định ban đầu
      if (!selectedRoomData) return { 
          newTotal: booking.totalRevenue, 
          diff: 0, 
          newPriceUnit: booking.price, 
          explanation: 'Chưa chọn phòng mới.' 
      };

      let newTotal = booking.totalRevenue;
      let newPriceUnit = booking.price;
      let explanation = '';

      // Tính thời gian lưu trú (Số lượng)
      const start = parseISO(booking.checkinDate);
      const end = parseISO(booking.checkoutDate);
      const totalHours = Math.abs(differenceInHours(end, start));
      
      // Xác định đơn vị tính (Ngày hay Giờ) dựa trên loại hình thanh toán cũ
      // Nếu không xác định được, mặc định theo quy tắc: > 24h tính ngày, < 24h tính giờ hoặc 1 đêm
      let quantity = 1; 
      let unitLabel = 'đêm';
      
      if (booking.paymentMethod === 'Theo giờ' || (totalHours < 24 && totalHours > 0)) {
          quantity = totalHours;
          unitLabel = 'giờ';
          // Nếu tính theo giờ nhưng giá quá cao (>= giá ngày), có thể coi là 1 combo/đêm
          if (selectedRoomData.price && selectedRoomData.price > 200000 && quantity > 1) {
             // Logic check nhanh: Nếu giá niêm yết là giá ngày, thì quantity phải là 1 (cho < 24h)
             quantity = 1; 
             unitLabel = 'ngày/đêm';
          }
      } else {
          quantity = Math.ceil(totalHours / 24);
          if (quantity < 1) quantity = 1;
          unitLabel = 'ngày/đêm';
      }

      if (priceStrategy === 'KEEP_OLD') {
          newTotal = booking.totalRevenue;
          newPriceUnit = booking.price; // Giữ unit price cũ để tham chiếu
          explanation = `Giữ nguyên tổng tiền cũ của khách (${booking.totalRevenue.toLocaleString()}đ).`;
      
      } else if (priceStrategy === 'RECALCULATE') {
          // LOGIC MỚI: TÍNH LẠI TỪ ĐẦU (RECALCULATE)
          // Tổng = Giá niêm yết phòng mới * Số lượng
          newPriceUnit = selectedRoomData.price || 0;
          
          // Phụ thu giữ nguyên hoặc reset? Tạm thời giữ nguyên phụ thu cũ
          const extra = booking.extraFee || 0;
          
          // Tính tiền phòng thuần túy
          const roomCharge = newPriceUnit * quantity;
          
          newTotal = roomCharge + extra;
          
          explanation = `Giá mới (${newPriceUnit.toLocaleString()}) x ${quantity} ${unitLabel} + Phụ thu (${extra.toLocaleString()}) = ${newTotal.toLocaleString()}`;

      } else if (priceStrategy === 'CUSTOM') {
          newTotal = customTotal;
          newPriceUnit = booking.price;
          explanation = 'Nhập tay số tiền thỏa thuận với khách.';
      }

      const diff = newTotal - booking.totalRevenue;
      return { newTotal, diff, newPriceUnit, explanation };
  }, [booking, selectedRoomData, priceStrategy, customTotal]);

  const handleSwap = async () => {
      if (!targetRoomCode || !selectedRoomData) return;
      setIsSubmitting(true);
      try {
          const oldRoomCode = booking.roomCode;
          const oldFacilityId = facilities.find(f => f.facilityName === booking.facilityName)?.id;

          const totalPaid = booking.totalRevenue - booking.remainingAmount;
          const newRemaining = calculation.newTotal - totalPaid;

          const updatedBooking: Booking = {
              ...booking,
              roomCode: targetRoomCode,
              price: calculation.newPriceUnit,
              totalRevenue: calculation.newTotal,
              remainingAmount: newRemaining,
              note: booking.note + `\n[${format(new Date(), 'dd/MM HH:mm')}] Đổi ${oldRoomCode} -> ${targetRoomCode}. ${calculation.explanation}`
          };
          await updateBooking(updatedBooking);

          // Cập nhật trạng thái phòng cũ dựa trên trạng thái Booking
          if (oldFacilityId) {
              const oldRoom = rooms.find(r => r.facility_id === oldFacilityId && r.name === oldRoomCode);
              if (oldRoom) {
                  // Nếu khách ĐÃ CHECKIN -> Phòng cũ thành Bẩn (đã dùng)
                  // Nếu khách CHƯA CHECKIN (Confirmed) -> Phòng cũ thành Đã dọn (Trống)
                  const newStatus = booking.status === 'CheckedIn' ? 'Bẩn' : 'Đã dọn';
                  await upsertRoom({ ...oldRoom, status: newStatus });
              }
          }
          
          notify('success', `Đã chuyển sang phòng ${targetRoomCode}`);
          onClose();
      } catch (err) {
          notify('error', 'Lỗi khi đổi phòng');
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!booking) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đổi Phòng & Tính Tiền" size="md">
        <div className="space-y-6">
            {/* 1. Header Info */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                    <div className="text-xs text-slate-500 font-bold uppercase">Khách hàng</div>
                    <div className="font-bold text-slate-800 text-lg">{booking.customerName}</div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center opacity-60">
                        <div className="text-xs text-slate-500 font-bold">Hiện tại</div>
                        <div className="font-black text-slate-700 text-xl">{booking.roomCode}</div>
                        <div className="text-[10px] text-slate-500 line-through">{(booking.price || 0).toLocaleString()}</div>
                    </div>
                    <ArrowRight className="text-slate-300"/>
                    <div className="text-center">
                        <div className="text-xs text-brand-600 font-bold">Mới</div>
                        <div className="font-black text-brand-600 text-xl">{targetRoomCode || '?'}</div>
                        {selectedRoomData && <div className="text-[10px] text-brand-500 font-bold">{(selectedRoomData.price || 0).toLocaleString()}</div>}
                    </div>
                </div>
            </div>

            {/* 2. Target Selection */}
            <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Chọn phòng trống</label>
                {availableTargetRooms.length === 0 ? (
                    <div className="p-4 bg-orange-50 text-orange-700 text-sm rounded-xl border border-orange-100 flex items-center gap-2">
                        <AlertCircle size={18}/> Không còn phòng trống phù hợp.
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                        {availableTargetRooms.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setTargetRoomCode(r.name)}
                                className={`
                                    px-2 py-2 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center
                                    ${targetRoomCode === r.name 
                                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-md ring-1 ring-brand-500' 
                                        : 'border-slate-100 bg-white text-slate-600 hover:border-brand-200 hover:bg-slate-50'}
                                `}
                            >
                                <span>{r.name}</span>
                                <span className="text-[10px] font-normal opacity-60">{(r.price || 0)/1000}k</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. Pricing Strategy */}
            {selectedRoomData && (
                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Phương án tính tiền</label>
                    
                    <div className="space-y-2">
                        {/* Option 1: Keep Old */}
                        <button 
                            onClick={() => setPriceStrategy('KEEP_OLD')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${priceStrategy === 'KEEP_OLD' ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${priceStrategy === 'KEEP_OLD' ? 'border-blue-500' : 'border-slate-300'}`}>
                                    {priceStrategy === 'KEEP_OLD' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">Giữ nguyên giá cũ (Free Upgrade)</div>
                                    <div className="text-[10px] opacity-70">Khách vẫn trả giá của phòng cũ</div>
                                </div>
                            </div>
                            <div className="font-black text-sm">{booking.totalRevenue.toLocaleString()} ₫</div>
                        </button>

                        {/* Option 2: Recalculate (Standard) */}
                        <button 
                            onClick={() => setPriceStrategy('RECALCULATE')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${priceStrategy === 'RECALCULATE' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${priceStrategy === 'RECALCULATE' ? 'border-emerald-500' : 'border-slate-300'}`}>
                                    {priceStrategy === 'RECALCULATE' && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">Tính lại theo giá niêm yết</div>
                                    <div className="text-[10px] opacity-70">Áp dụng giá phòng mới ({selectedRoomData.price?.toLocaleString()})</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-black text-sm">{calculation.newTotal.toLocaleString()} ₫</div>
                                <div className={`text-[10px] font-bold ${calculation.diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {calculation.diff > 0 ? `+${calculation.diff.toLocaleString()}` : '0đ'}
                                </div>
                            </div>
                        </button>

                        {/* Option 3: Custom */}
                        <button 
                            onClick={() => setPriceStrategy('CUSTOM')}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${priceStrategy === 'CUSTOM' ? 'bg-purple-50 border-purple-500 text-purple-900' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${priceStrategy === 'CUSTOM' ? 'border-purple-500' : 'border-slate-300'}`}>
                                    {priceStrategy === 'CUSTOM' && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full"></div>}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">Giá thỏa thuận (Nhập tay)</div>
                                    <div className="text-[10px] opacity-70">Nhập số tiền chốt cuối cùng</div>
                                </div>
                            </div>
                        </button>
                        
                        {priceStrategy === 'CUSTOM' && (
                            <div className="pl-10 animate-in slide-in-from-top-2">
                                <input 
                                    type="number" 
                                    className="w-full p-2 border-2 border-purple-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-purple-500"
                                    value={customTotal}
                                    onChange={e => setCustomTotal(Number(e.target.value))}
                                    placeholder="Nhập tổng tiền..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Summary Box */}
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Calculator size={18}/>
                                <span className="text-xs font-bold uppercase">Giải trình:</span>
                            </div>
                            <div className="font-mono text-xs text-slate-500 font-medium text-right max-w-[200px] truncate" title={calculation.explanation}>
                                {calculation.explanation}
                            </div>
                        </div>
                        <div className="h-px bg-slate-200 my-2"></div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-700">Tổng thanh toán mới:</span>
                            <span className="text-xl font-black text-brand-600">{calculation.newTotal.toLocaleString()} ₫</span>
                        </div>
                        <div className={`text-right text-xs font-bold mt-1 ${calculation.diff > 0 ? 'text-orange-600' : calculation.diff < 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                            (Chênh lệch: {calculation.diff > 0 ? '+' : ''}{calculation.diff.toLocaleString()} so với cũ)
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all">Hủy</button>
                <button 
                    onClick={handleSwap} 
                    disabled={!targetRoomCode || isSubmitting}
                    className="px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowRightLeft size={18}/> Xác Nhận Đổi
                </button>
            </div>
        </div>
    </Modal>
  );
};
