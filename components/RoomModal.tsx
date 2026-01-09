
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { Room } from '../types';
import { useAppContext } from '../context/AppContext';
import { Maximize2, Mountain, Star, Tag, Info, Package } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomData?: Room | null;
  onSave: (room: Room) => void;
}

export const RoomModal: React.FC<Props> = ({ isOpen, onClose, roomData, onSave }) => {
  const { roomRecipes, services } = useAppContext();
  const [form, setForm] = useState<Partial<Room>>({
    name: '',
    status: 'Đã dọn',
    price: 0,
    price_saturday: 0,
    note: '',
    type: '1GM8',
    view: 'View Nội',
    area: 35
  });

  const roomTypes = useMemo(() => Object.keys(roomRecipes), [roomRecipes]);

  useEffect(() => {
    if (roomData) {
      setForm({
          ...roomData,
          type: roomData.type || '1GM8',
          view: roomData.view || 'View Nội',
          area: roomData.area || 35,
          price_saturday: roomData.price_saturday || 0
      });
    } else {
      setForm({
        name: '',
        status: 'Đã dọn',
        price: 0,
        price_saturday: 0,
        note: '',
        type: '1GM8',
        view: 'View Nội',
        area: 35
      });
    }
  }, [roomData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name && form.facility_id) {
       onSave(form as Room);
       onClose();
    }
  };

  const currentRecipe = useMemo(() => {
      return form.type ? roomRecipes[form.type] : null;
  }, [form.type, roomRecipes]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi Tiết & Cấu Hình Phòng" size="md">
      <form id="roomForm" onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mã Phòng</label>
               <input 
                 required 
                 className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-black text-lg focus:border-brand-500 outline-none" 
                 value={form.name} 
                 onChange={e => setForm({...form, name: e.target.value})} 
               />
            </div>
            <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái</label>
                <select 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-medium outline-none focus:border-brand-500"
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}
                >
                    <option value="Đã dọn">Đã dọn (Sẵn sàng)</option>
                    <option value="Đang dọn">Đang dọn</option>
                    <option value="Bẩn">Bẩn</option>
                    <option value="Sửa chữa">Sửa chữa / Bảo trì</option>
                </select>
            </div>
        </div>

        {/* Pricing */}
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 space-y-3">
            <h4 className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-2"><Tag size={14}/> Thiết lập giá</h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá Niêm Yết (T2-T6, CN)</label>
                   <input 
                     type="number" 
                     className="w-full border-2 border-white rounded-xl p-3 bg-white text-brand-600 font-bold outline-none focus:border-brand-500 shadow-sm" 
                     value={form.price || 0} 
                     onChange={e => setForm({...form, price: Number(e.target.value)})} 
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-rose-500">Giá Thứ 7 (Cuối tuần)</label>
                   <input 
                     type="number" 
                     className="w-full border-2 border-white rounded-xl p-3 bg-white text-rose-600 font-bold outline-none focus:border-rose-500 shadow-sm" 
                     placeholder="Để 0 = Giá niêm yết"
                     value={form.price_saturday || ''} 
                     onChange={e => setForm({...form, price_saturday: Number(e.target.value)})} 
                   />
                   <p className="text-[9px] text-slate-400 mt-1 italic">Để trống/0: Dùng giá niêm yết</p>
                </div>
            </div>
        </div>

        {/* Advanced Room Attributes */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2 mb-2">Đặc điểm phòng & Công thức</h4>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Star size={12}/> Loại phòng (Recipes)
                    </label>
                    <select 
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                        value={form.type}
                        onChange={e => setForm({...form, type: e.target.value})}
                    >
                        {roomTypes.map(t => (
                            <option key={t} value={t}>{t} ({roomRecipes[t].description})</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Mountain size={12}/> Hướng nhìn (View)
                    </label>
                    <select 
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
                        value={form.view}
                        onChange={e => setForm({...form, view: e.target.value})}
                    >
                        <option value="View Nội">View Nội</option>
                        <option value="View Biển">View Biển</option>
                    </select>
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Maximize2 size={12}/> Diện tích (m²)
                </label>
                <div className="relative">
                    <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                        value={form.area}
                        onChange={e => setForm({...form, area: Number(e.target.value)})}
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">m²</span>
                </div>
            </div>

            {/* Recipe Preview Box */}
            {currentRecipe && (
                <div className="bg-white p-3 rounded-lg border border-brand-100 mt-2">
                    <div className="flex items-center gap-2 mb-2 text-brand-600">
                        <Package size={14}/>
                        <span className="text-[10px] font-black uppercase">Định mức áp dụng ({currentRecipe.items.length} món)</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {currentRecipe.items.slice(0, 6).map((item, idx) => {
                            // Find actual name from services if possible
                            const serviceName = services.find(s => s.id === item.itemId)?.name || item.itemId;
                            return (
                                <span key={idx} className="text-[9px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                    {serviceName} <b>x{item.quantity}</b>
                                </span>
                            );
                        })}
                        {currentRecipe.items.length > 6 && (
                            <span className="text-[9px] text-slate-400 italic font-medium">
                                +{currentRecipe.items.length - 6} món khác...
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div>
           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ghi chú vận hành</label>
           <textarea 
             className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-sm outline-none focus:border-brand-500 h-20 placeholder:text-slate-300" 
             placeholder="Ví dụ: Máy lạnh hơi yếu, đang chờ vật tư..."
             value={form.note || ''} 
             onChange={e => setForm({...form, note: e.target.value})} 
           />
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
         <button type="button" onClick={onClose} className="px-5 py-3 text-slate-500 hover:bg-slate-50 rounded-xl font-bold text-xs uppercase tracking-widest transition-all">Hủy bỏ</button>
         <button form="roomForm" type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-100 active:scale-95 transition-all">Lưu Cấu Hình</button>
      </div>
    </Modal>
  );
};
