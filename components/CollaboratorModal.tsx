
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Collaborator, Role } from '../types';
import { useAppContext } from '../context/AppContext';
import { DollarSign, User, Shield, Percent, Palette } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  collaborator?: Collaborator | null;
}

export const CollaboratorModal: React.FC<Props> = ({ isOpen, onClose, collaborator }) => {
  const { addCollaborator, updateCollaborator, notify } = useAppContext();
  const [form, setForm] = useState<Partial<Collaborator>>({
    collaboratorName: '',
    username: '',
    password: '',
    role: 'Nhân viên',
    commissionRate: 0,
    baseSalary: 0,
    color: '#3b82f6'
  });

  useEffect(() => {
    if (collaborator) {
      setForm(collaborator);
    } else {
      setForm({
        collaboratorName: '',
        username: '',
        password: '',
        role: 'Nhân viên',
        commissionRate: 0,
        baseSalary: 0,
        color: '#3b82f6'
      });
    }
  }, [collaborator, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.collaboratorName || !form.username || !form.password) {
      notify('error', 'Vui lòng điền đủ thông tin');
      return;
    }

    // Đảm bảo dữ liệu gửi lên SQL luôn đúng kiểu dữ liệu
    const data: Collaborator = {
      ...form,
      id: collaborator?.id || `C${Date.now()}`,
      collaboratorName: form.collaboratorName || '',
      username: form.username || '',
      password: form.password || '',
      role: form.role as Role,
      manageFacilities: form.manageFacilities || '[]',
      color: form.color || '#3b82f6',
      baseSalary: Number(form.baseSalary || 0),
      commissionRate: Number(form.commissionRate || 0)
    } as Collaborator;

    if (collaborator) updateCollaborator(data);
    else addCollaborator(data);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={collaborator ? 'Sửa Nhân Viên' : 'Thêm Nhân Viên'} size="md">
      <form id="collabForm" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><User size={12}/> Họ và tên (Hiển thị)</label>
                <input required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold focus:border-brand-500 transition-all outline-none" value={form.collaboratorName} onChange={e => setForm({...form, collaboratorName: e.target.value})} placeholder="Ví dụ: Nguyễn Văn A" />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shield size={12}/> Vai trò</label>
                <select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold focus:border-brand-500 transition-all outline-none" value={form.role} onChange={e => setForm({...form, role: e.target.value as Role})}>
                    <option value="Admin">Admin</option>
                    <option value="Quản lý">Quản lý</option>
                    <option value="Nhân viên">Lễ tân (Nhân viên)</option>
                    <option value="Buồng phòng">Buồng phòng (Tạp vụ)</option>
                    <option value="Nhà đầu tư">Nhà đầu tư</option>
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
           <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên đăng nhập</label>
                <input required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-slate-50 text-slate-900 font-mono text-sm focus:border-brand-500 transition-all outline-none" value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="letan_01" />
           </div>
           <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu</label>
                <input required type="text" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-mono text-sm focus:border-brand-500 transition-all outline-none" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="******" />
           </div>
        </div>

        <div className="bg-brand-50/50 p-5 rounded-2xl border border-brand-100 space-y-5">
            <h4 className="text-[11px] font-black text-brand-700 uppercase tracking-[0.2em] flex items-center gap-2">
                <DollarSign size={16}/> Chế độ lương & Thưởng
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lương cứng (VND/Tháng)</label>
                    <input 
                      type="number" 
                      className="w-full border-2 border-white rounded-xl p-3 bg-white text-slate-900 font-black text-lg focus:border-brand-500 transition-all outline-none shadow-sm" 
                      value={form.baseSalary} 
                      onChange={e => setForm({...form, baseSalary: Number(e.target.value)})} 
                      placeholder="0" 
                    />
               </div>
               <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Percent size={12}/> Hoa hồng (%)</label>
                    <input 
                      type="number" 
                      className="w-full border-2 border-white rounded-xl p-3 bg-white text-brand-600 font-black text-lg focus:border-brand-500 transition-all outline-none shadow-sm" 
                      value={form.commissionRate} 
                      onChange={e => setForm({...form, commissionRate: Number(e.target.value)})} 
                      placeholder="0" 
                    />
               </div>
            </div>
        </div>

        <div className="space-y-1.5">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Palette size={12}/> Màu đại diện trên lịch</label>
           <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <input type="color" className="h-10 w-20 bg-transparent cursor-pointer rounded overflow-hidden" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
              <span className="font-mono text-sm text-slate-500 font-bold uppercase">{form.color}</span>
           </div>
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-slate-100">
         <button type="button" onClick={onClose} className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Hủy</button>
         <button form="collabForm" type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-100 transition-all active:scale-95">Lưu Nhân Viên</button>
      </div>
    </Modal>
  );
};
