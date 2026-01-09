
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Expense } from '../types';
import { useAppContext } from '../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

export const ExpenseModal: React.FC<Props> = ({ isOpen, onClose, expense }) => {
  const { addExpense, updateExpense, facilities, settings, notify } = useAppContext();
  const [form, setForm] = useState<Partial<Expense>>({
     expenseDate: new Date().toISOString().substring(0, 10),
     amount: 0,
     facilityName: '',
     expenseCategory: '',
     expenseContent: '',
     note: ''
  });

  useEffect(() => {
    if (expense) setForm(expense);
    else {
      setForm({
        expenseDate: new Date().toISOString().substring(0, 10),
        amount: 0,
        facilityName: facilities[0]?.facilityName || '',
        expenseCategory: settings.expense_categories[0] || '',
        expenseContent: '',
        note: ''
      });
    }
  }, [expense, isOpen, facilities, settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.facilityName) {
        notify('error', 'Vui lòng nhập số tiền và cơ sở');
        return;
    }

    const data: Expense = {
      id: expense?.id || `E${Date.now()}`,
      expenseDate: form.expenseDate!,
      facilityName: form.facilityName!,
      expenseCategory: form.expenseCategory!,
      expenseContent: form.expenseContent || 'Chi phí khác',
      amount: Number(form.amount),
      note: form.note || ''
    };

    if (expense) updateExpense(data);
    else addExpense(data);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={expense ? 'Sửa Chi Phí' : 'Thêm Chi Phí'}>
      <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div>
              <label className="block text-sm font-medium mb-1">Ngày chi</label>
              <input type="date" required className="w-full border rounded p-2 bg-white text-slate-900" value={form.expenseDate} onChange={e => setForm({...form, expenseDate: e.target.value})} />
           </div>
           <div>
              <label className="block text-sm font-medium mb-1">Số tiền</label>
              <input type="number" required className="w-full border rounded p-2 text-red-600 font-bold bg-white" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
           </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div>
              <label className="block text-sm font-medium mb-1">Cơ sở</label>
              <select required className="w-full border rounded p-2 bg-white text-slate-900" value={form.facilityName} onChange={e => setForm({...form, facilityName: e.target.value})}>
                 <option value="">Chọn cơ sở</option>
                 {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-sm font-medium mb-1">Danh mục</label>
              <select required className="w-full border rounded p-2 bg-white text-slate-900" value={form.expenseCategory} onChange={e => setForm({...form, expenseCategory: e.target.value})}>
                 <option value="">Chọn danh mục</option>
                 {settings.expense_categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
           </div>
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Nội dung chi</label>
           <input type="text" className="w-full border rounded p-2 bg-white text-slate-900" placeholder="Ví dụ: Mua nước tẩy rửa" value={form.expenseContent} onChange={e => setForm({...form, expenseContent: e.target.value})} />
        </div>
        <div>
           <label className="block text-sm font-medium mb-1">Ghi chú thêm</label>
           <textarea className="w-full border rounded p-2 h-20 bg-white text-slate-900" value={form.note} onChange={e => setForm({...form, note: e.target.value})}></textarea>
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
         <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
         <button form="expenseForm" type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-medium">Lưu Chi Phí</button>
      </div>
    </Modal>
  );
};
