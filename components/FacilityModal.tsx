
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Facility } from '../types';
import { useAppContext } from '../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  facility?: Facility | null;
}

export const FacilityModal: React.FC<Props> = ({ isOpen, onClose, facility }) => {
  const { addFacility, updateFacility, notify } = useAppContext();
  const [form, setForm] = useState<Partial<Facility>>({
     facilityName: '',
     facilityPrice: 0,
     facilityPriceSaturday: 0,
     note: '',
     staff: []
  });
  
  const [staffString, setStaffString] = useState('');

  useEffect(() => {
    if (facility) {
        setForm(facility);
        setStaffString((facility.staff || []).join(', '));
    } else {
        setForm({ facilityName: '', facilityPrice: 0, facilityPriceSaturday: 0, note: '', staff: [] });
        setStaffString('');
    }
  }, [facility, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facilityName) {
        notify('error', 'Tên cơ sở không được để trống');
        return;
    }

    const staffArray = staffString.split(',').map(s => s.trim()).filter(s => s !== '');

    const data: Facility = {
       id: facility?.id || `F${Date.now()}`,
       ...(form as Facility),
       staff: staffArray,
       // Legacy: maintain existing JSON if present, else empty. We now use 'rooms' table.
       roomsJson: facility?.roomsJson || '[]' 
    };

    if (facility) updateFacility(data);
    else addFacility(data);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={facility ? 'Sửa Thông Tin Cơ Sở' : 'Thêm Cơ Sở Mới'}>
      <form id="facilityForm" onSubmit={handleSubmit} className="space-y-4">
        <div>
           <label className="block text-sm font-medium mb-1">Tên cơ sở</label>
           <input required className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: Chi nhánh 1 - Quận 1" value={form.facilityName} onChange={e => setForm({...form, facilityName: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
               <label className="block text-sm font-medium mb-1">Giá chuẩn (Ngày thường)</label>
               <input type="number" className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: 500000" value={form.facilityPrice} onChange={e => setForm({...form, facilityPrice: Number(e.target.value)})} />
            </div>
            <div>
               <label className="block text-sm font-medium mb-1 text-rose-600">Giá chuẩn (Thứ 7)</label>
               <input type="number" className="w-full border rounded p-2 bg-white text-slate-900" placeholder="VD: 700000" value={form.facilityPriceSaturday || ''} onChange={e => setForm({...form, facilityPriceSaturday: Number(e.target.value)})} />
            </div>
            <p className="col-span-2 text-xs text-gray-500 italic">Các giá này sẽ được dùng mặc định khi tạo phòng mới.</p>
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Nhân viên buồng phòng (Phân cách bằng dấu phẩy)</label>
           <input 
                className="w-full border rounded p-2 bg-white text-slate-900" 
                placeholder="VD: Cô Lan, Chị Mai, Anh Tuấn..." 
                value={staffString} 
                onChange={e => setStaffString(e.target.value)} 
           />
           <p className="text-xs text-gray-500 mt-1">Nhập tên các nhân viên dọn dẹp phụ trách riêng cơ sở này.</p>
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Mô tả / Địa chỉ</label>
           <textarea className="w-full border rounded p-2 h-24 bg-white text-slate-900" placeholder="Địa chỉ, ghi chú..." value={form.note} onChange={e => setForm({...form, note: e.target.value})}></textarea>
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
         <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
         <button form="facilityForm" type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium">Lưu Cơ Sở</button>
      </div>
    </Modal>
  );
};
