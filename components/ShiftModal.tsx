
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { Shift } from '../types';
import { format } from 'date-fns';
import { DollarSign, Save, Play, Lock, Printer, AlertTriangle, TrendingUp, TrendingDown, Wallet, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentShift, openShift, closeShift, bookings, expenses, notify, refreshData, isLoading } = useAppContext();
  
  // State for Opening Shift
  const [startCash, setStartCash] = useState(0);

  // State for Closing Shift
  const [endCashActual, setEndCashActual] = useState(0);
  const [note, setNote] = useState('');
  const [viewMode, setViewMode] = useState<'Active' | 'Closing'>('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Force refresh data when opening the modal to ensure money is accurate
  useEffect(() => {
      if (isOpen) {
          refreshData(true);
      }
  }, [isOpen]);

  // Calculate Realtime Totals for Active Shift
  const shiftStats = useMemo(() => {
     if (!currentShift) return { revenue: 0, expense: 0, expected: 0 };
     
     let revenue = 0;
     let expense = 0;
     const startTime = new Date(currentShift.start_time);

     // Revenue Calculation (Strict Cash Only)
     bookings.forEach(b => {
        const payments = JSON.parse(b.paymentsJson || '[]');
        payments.forEach((p: any) => {
            const pDate = new Date(p.ngayThanhToan);
            
            // CHECK 1: Time must be after shift start
            if (pDate >= startTime) {
                // CHECK 2: Method must be Cash
                // Fallback for legacy data: Check if 'ghiChu' contains 'CK' or 'Transfer'
                const isCashLegacy = !p.method && !(p.ghiChu || '').toLowerCase().match(/ck|chuyển|transfer|thẻ|card/);
                const isCashStrict = p.method === 'Cash';
                
                if (isCashStrict || isCashLegacy) {
                    revenue += Number(p.soTien);
                }
            }
        });
     });

     // Expense Calculation
     expenses.forEach(e => {
         const eDate = new Date(e.expenseDate);
         if (eDate >= startTime || (eDate.toDateString() === startTime.toDateString() && new Date().getDate() === startTime.getDate())) {
             expense += e.amount;
         }
     });

     return {
         revenue,
         expense,
         expected: currentShift.start_cash + revenue - expense
     };
  }, [currentShift, bookings, expenses]);

  useEffect(() => {
      if (isOpen) {
          setViewMode('Active');
          if (shiftStats) setEndCashActual(shiftStats.expected); 
      }
  }, [isOpen, shiftStats]);

  const handleOpenShift = async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        await openShift(startCash);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
  };

  const handleCloseShift = async () => {
      if (isSubmitting) return;
      if (confirm('Xác nhận kết thúc ca làm việc và chốt sổ?')) {
          setIsSubmitting(true);
          try {
            await closeShift(endCashActual, note);
            onClose();
          } finally {
            setIsSubmitting(false);
          }
      }
  };

  if (isLoading && isOpen && !currentShift) {
      return (
         <Modal isOpen={isOpen} onClose={onClose} title="Đang tải dữ liệu...">
             <div className="flex items-center justify-center p-10">
                 <Loader2 className="animate-spin text-brand-600" size={32} />
             </div>
         </Modal>
      );
  }

  if (!currentShift) {
      // OPEN SHIFT UI
      return (
          <Modal isOpen={isOpen} onClose={onClose} title="Mở Ca Làm Việc">
              <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3">
                      <div className="bg-white p-2 rounded-full text-blue-600 shadow-sm"><Play size={24} fill="currentColor"/></div>
                      <div>
                          <h3 className="font-bold text-blue-800">Bắt đầu ca mới</h3>
                          <p className="text-sm text-blue-600 mt-1">Vui lòng kiểm đếm tiền mặt hiện có trong két (tiền lẻ thối lại) để bắt đầu.</p>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Tiền đầu ca (Tiền quỹ)</label>
                      <div className="relative">
                          <DollarSign className="absolute left-3 top-3 text-slate-400" size={20} />
                          <input 
                              type="number" 
                              className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl text-xl font-bold text-slate-800 focus:border-brand-500 outline-none" 
                              value={startCash}
                              onChange={e => setStartCash(Number(e.target.value))}
                              autoFocus
                          />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                      <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Hủy</button>
                      <button onClick={handleOpenShift} disabled={isSubmitting} className="px-6 py-2 bg-brand-600 text-white font-bold rounded-lg shadow-lg shadow-brand-200 hover:bg-brand-700 flex items-center gap-2">
                          {isSubmitting && <Loader2 size={16} className="animate-spin"/>}
                          Bắt đầu làm việc
                      </button>
                  </div>
              </div>
          </Modal>
      );
  }

  // ACTIVE / CLOSE SHIFT UI
  return (
      <Modal isOpen={isOpen} onClose={onClose} title={viewMode === 'Active' ? 'Thông Tin Ca Làm Việc' : 'Chốt Ca & Bàn Giao'}>
          <div className="space-y-6">
              {/* Info Header */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                  <div>
                      <span className="text-slate-500">Nhân viên:</span> <span className="font-bold text-slate-800">{currentShift.staff_name}</span>
                  </div>
                  <div>
                      <span className="text-slate-500">Bắt đầu:</span> <span className="font-mono font-bold text-slate-800">{format(new Date(currentShift.start_time), 'HH:mm dd/MM')}</span>
                  </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl bg-white shadow-sm">
                      <div className="text-xs text-slate-500 uppercase font-bold mb-1">Đầu ca</div>
                      <div className="text-lg font-bold text-slate-700">{currentShift.start_cash.toLocaleString()}</div>
                  </div>
                  <div className="p-4 border rounded-xl bg-white shadow-sm border-blue-100 bg-blue-50/30">
                      <div className="text-xs text-blue-600 uppercase font-bold mb-1">Hiện tại (Lý thuyết)</div>
                      <div className="text-xl font-bold text-blue-700">{shiftStats.expected.toLocaleString()}</div>
                  </div>
              </div>

              {/* Revenue / Expense Detail */}
              <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-2 text-green-600 font-medium">
                          <TrendingUp size={18} /> Thu tiền mặt (Cash)
                      </div>
                      <div className="font-bold text-green-700">+{shiftStats.revenue.toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-2 text-red-600 font-medium">
                          <TrendingDown size={18} /> Chi tiền mặt
                      </div>
                      <div className="font-bold text-red-700">-{shiftStats.expense.toLocaleString()}</div>
                  </div>
              </div>

              {viewMode === 'Closing' && (
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 animate-in fade-in slide-in-from-bottom-2">
                      <h4 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                          <Lock size={16}/> Kiểm đếm thực tế
                      </h4>
                      <div className="space-y-3">
                          <div>
                              <label className="block text-xs font-bold text-yellow-700 mb-1">Tiền trong két (Thực tế)</label>
                              <input 
                                  type="number" 
                                  className="w-full border-2 border-yellow-300 rounded-lg p-2 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                                  value={endCashActual}
                                  onChange={e => setEndCashActual(Number(e.target.value))}
                              />
                          </div>
                          
                          <div className="flex justify-between items-center pt-2 border-t border-yellow-200/50">
                              <span className="text-sm font-bold text-slate-600">Lệch (Thừa/Thiếu):</span>
                              <span className={`font-bold text-lg ${(endCashActual - shiftStats.expected) < 0 ? 'text-red-600' : (endCashActual - shiftStats.expected) > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                  {(endCashActual - shiftStats.expected).toLocaleString()}
                              </span>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-yellow-700 mb-1">Ghi chú bàn giao</label>
                              <textarea 
                                  className="w-full border border-yellow-300 rounded-lg p-2 text-sm bg-white" 
                                  placeholder="Ghi chú các vấn đề phát sinh..."
                                  value={note}
                                  onChange={e => setNote(e.target.value)}
                              ></textarea>
                          </div>
                      </div>
                  </div>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                  {viewMode === 'Active' ? (
                      <>
                          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Đóng</button>
                          <button onClick={() => setViewMode('Closing')} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 flex items-center gap-2">
                              <Lock size={18}/> Chốt Ca
                          </button>
                      </>
                  ) : (
                      <>
                           <button onClick={() => setViewMode('Active')} disabled={isSubmitting} className="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg">Quay lại</button>
                           <button onClick={handleCloseShift} disabled={isSubmitting} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700 flex items-center gap-2">
                              {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Printer size={18}/>}
                              Kết Thúc & In Phiếu
                          </button>
                      </>
                  )}
              </div>
          </div>
      </Modal>
  );
};
