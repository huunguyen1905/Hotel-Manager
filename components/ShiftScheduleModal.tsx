
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ShiftSchedule, Collaborator } from '../types';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import { Trash2, Save, Sun, Moon, Coffee } from 'lucide-react';

interface ShiftScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Collaborator;
  date: Date;
  existingSchedule?: ShiftSchedule | null;
}

export const ShiftScheduleModal: React.FC<ShiftScheduleModalProps> = ({ 
  isOpen, onClose, staff, date, existingSchedule 
}) => {
  const { upsertSchedule, deleteSchedule, notify } = useAppContext();
  const [shiftType, setShiftType] = useState<'Sáng' | 'Tối' | 'OFF'>('Sáng');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (existingSchedule) {
      // Map về 2 ca chính nếu dữ liệu cũ có 'Chiều'
      let type = existingSchedule.shift_type;
      if (type === 'Chiều' as any) type = 'Sáng'; 
      setShiftType(type as any);
      setNote(existingSchedule.note || '');
    } else {
      setShiftType('Sáng');
      setNote('');
    }
  }, [existingSchedule, isOpen]);

  const handleSave = () => {
    const s: ShiftSchedule = {
      id: existingSchedule?.id || `SCH-${Date.now()}`,
      staff_id: staff.id,
      date: format(date, 'yyyy-MM-dd'),
      shift_type: shiftType as any,
      note
    };
    upsertSchedule(s);
    onClose();
  };

  const handleDelete = () => {
    if (existingSchedule && confirm('Xóa phân ca này?')) {
      deleteSchedule(existingSchedule.id);
      notify('info', 'Đã xóa phân ca');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Phân ca: ${staff.collaboratorName}`} size="sm">
      <div className="space-y-5">
        <div className="p-4 bg-slate-50 rounded-2xl text-slate-600 text-sm font-black border border-slate-100 flex justify-between items-center">
          <span>Ngày trực:</span>
          <span className="text-brand-600">{format(date, 'dd/MM/yyyy')}</span>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CHỌN CA TRỰC (HỆ THỐNG 2 CA)</label>
          <div className="flex flex-col gap-2">
            <button
                onClick={() => setShiftType('Sáng')}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold ${shiftType === 'Sáng' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <div className="flex items-center gap-3">
                    <Sun size={20} className={shiftType === 'Sáng' ? 'text-amber-500' : 'text-slate-300'}/>
                    <div className="text-left">
                        <div className="text-sm uppercase">Ca Ngày (Sáng)</div>
                        <div className="text-[10px] opacity-70">Hệ số 1.0</div>
                    </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shiftType === 'Sáng' ? 'border-amber-500' : 'border-slate-200'}`}>
                    {shiftType === 'Sáng' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>}
                </div>
            </button>

            <button
                onClick={() => setShiftType('Tối')}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold ${shiftType === 'Tối' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <div className="flex items-center gap-3">
                    <Moon size={20} className={shiftType === 'Tối' ? 'text-indigo-500' : 'text-slate-300'}/>
                    <div className="text-left">
                        <div className="text-sm uppercase">Ca Đêm (Tối)</div>
                        <div className="text-[10px] opacity-70">Hệ số 1.2</div>
                    </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shiftType === 'Tối' ? 'border-indigo-500' : 'border-slate-200'}`}>
                    {shiftType === 'Tối' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
                </div>
            </button>

            <button
                onClick={() => setShiftType('OFF')}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold ${shiftType === 'OFF' ? 'bg-slate-100 border-slate-400 text-slate-700' : 'bg-white border-slate-100 text-slate-500'}`}
            >
                <div className="flex items-center gap-3">
                    <Coffee size={20} className="text-slate-400"/>
                    <div className="text-left">
                        <div className="text-sm uppercase">Nghỉ (OFF)</div>
                        <div className="text-[10px] opacity-70">Không tính công</div>
                    </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${shiftType === 'OFF' ? 'border-slate-500' : 'border-slate-200'}`}>
                    {shiftType === 'OFF' && <div className="w-2.5 h-2.5 bg-slate-500 rounded-full"></div>}
                </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">GHI CHÚ</label>
          <textarea
            className="w-full border-2 border-slate-100 rounded-xl p-3 outline-none focus:border-brand-500 transition-all text-sm h-20 bg-slate-50/50"
            placeholder="Ghi chú nếu cần..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          {existingSchedule && (
            <button
              onClick={handleDelete}
              className="px-5 py-3 text-rose-500 hover:bg-rose-50 rounded-xl font-bold flex items-center justify-center transition-all"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            <Save size={18} /> Lưu Phân Ca
          </button>
        </div>
      </div>
    </Modal>
  );
};
