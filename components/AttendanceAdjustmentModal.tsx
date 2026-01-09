
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { AttendanceAdjustment, Collaborator } from '../types';
import { useAppContext } from '../context/AppContext';
import { Save, AlertCircle } from 'lucide-react';

interface AttendanceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Collaborator;
  month: string;
  adjustment?: AttendanceAdjustment | null;
}

export const AttendanceAdjustmentModal: React.FC<AttendanceAdjustmentModalProps> = ({ 
  isOpen, onClose, staff, month, adjustment 
}) => {
  const { upsertAdjustment } = useAppContext();
  const [form, setForm] = useState({
    standard_days_adj: 0,
    ot_hours_adj: 0,
    leave_days_adj: 0,
    note: ''
  });

  useEffect(() => {
    if (adjustment) {
      setForm({
        standard_days_adj: adjustment.standard_days_adj,
        ot_hours_adj: adjustment.ot_hours_adj,
        leave_days_adj: adjustment.leave_days_adj,
        note: adjustment.note || ''
      });
    } else {
      setForm({ standard_days_adj: 0, ot_hours_adj: 0, leave_days_adj: 0, note: '' });
    }
  }, [adjustment, isOpen]);

  const handleSave = () => {
    upsertAdjustment({
      staff_id: staff.id,
      month: month,
      ...form
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Điều chỉnh công: ${staff.collaboratorName}`} size="sm">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3 mb-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Số liệu nhập tại đây sẽ được <b>CỘNG THÊM</b> (hoặc trừ đi nếu nhập số âm) vào kết quả tính toán tự động của hệ thống.
            </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-1.5">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Bù công thường (Ngày)</label>
             <input 
                type="number" step="0.5" 
                className="w-full border-2 border-slate-100 rounded-xl p-2.5 outline-none focus:border-brand-500 font-bold"
                value={form.standard_days_adj}
                onChange={e => setForm({...form, standard_days_adj: Number(e.target.value)})}
             />
           </div>
           <div className="space-y-1.5">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Bù giờ OT (Giờ)</label>
             <input 
                type="number" step="1"
                className="w-full border-2 border-slate-100 rounded-xl p-2.5 outline-none focus:border-brand-500 font-bold"
                value={form.ot_hours_adj}
                onChange={e => setForm({...form, ot_hours_adj: Number(e.target.value)})}
             />
           </div>
        </div>

        <div className="space-y-1.5">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nghỉ phép phát sinh (Ngày)</label>
             <input 
                type="number" step="0.5"
                className="w-full border-2 border-slate-100 rounded-xl p-2.5 outline-none focus:border-brand-500 font-bold"
                value={form.leave_days_adj}
                onChange={e => setForm({...form, leave_days_adj: Number(e.target.value)})}
             />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">LÝ DO ĐIỀU CHỈNH</label>
          <textarea
            className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500 text-sm h-20"
            placeholder="Ví dụ: Quên check-out, làm thay ca..."
            value={form.note}
            onChange={e => setForm({...form, note: e.target.value})}
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Hủy</button>
          <button onClick={handleSave} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2">
            <Save size={18} /> Lưu điều chỉnh
          </button>
        </div>
      </div>
    </Modal>
  );
};