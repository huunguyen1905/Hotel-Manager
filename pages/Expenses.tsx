
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Expense } from '../types';
import { format, isSameMonth } from 'date-fns';
import { ExpenseModal } from '../components/ExpenseModal';
import { Plus, Pencil, Trash2, Calendar, Search } from 'lucide-react';
import { ListFilter, FilterOption } from '../components/ListFilter';

export const Expenses: React.FC = () => {
  const { expenses, deleteExpense, settings } = useAppContext();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const categoryOptions: FilterOption[] = useMemo(() => {
    return [
      { label: 'Tất cả mục chi', value: 'All' },
      ...settings.expense_categories.map(cat => ({
        label: cat,
        value: cat
      }))
    ];
  }, [settings.expense_categories]);

  const filteredExpenses = useMemo(() => {
     const [year, month] = selectedMonth.split('-').map(Number);
     const filterDate = new Date(year, month - 1);
     
     return expenses.filter(e => {
        const eDate = new Date(e.expenseDate);
        const matchesMonth = isSameMonth(eDate, filterDate) && eDate.getFullYear() === year;
        const matchesCategory = categoryFilter === 'All' || e.expenseCategory === categoryFilter;
        const matchesSearch = e.expenseContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              e.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (e.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesMonth && matchesCategory && matchesSearch;
     });
  }, [expenses, selectedMonth, categoryFilter, searchTerm]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredExpenses]);

  const handleAdd = () => {
    setEditingExpense(null);
    setModalOpen(true);
  };

  const handleEdit = (e: Expense) => {
    setEditingExpense(e);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-enter">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">Chi phí & Tài chính</h1>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500 text-sm font-medium">Tổng chi tháng {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}:</span>
                <span className="text-rose-600 font-black text-xl">{totalExpense.toLocaleString()} ₫</span>
            </div>
         </div>
         
         <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm flex-1 md:flex-none">
                <Calendar size={16} className="text-slate-400"/>
                <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer w-full"
                />
             </div>
             <button onClick={handleAdd} className="bg-brand-600 text-white px-3 md:px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-700 transition-all shadow-md active:scale-95 whitespace-nowrap">
                <Plus size={20} /> <span className="hidden md:inline">Thêm chi phí</span>
             </button>
         </div>
      </div>

      <ListFilter 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        options={categoryOptions}
        selectedFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        placeholder="Tìm theo nội dung, cơ sở, ghi chú..."
      />

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
               <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest">
                  <tr>
                     <th className="p-lg">Ngày chi</th>
                     <th className="p-lg">Cơ sở / Phân loại</th>
                     <th className="p-lg">Nội dung</th>
                     <th className="p-lg text-right">Số tiền</th>
                     <th className="p-lg text-center">Thao tác</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {filteredExpenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(e => (
                     <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-lg">
                           <div className="font-bold text-slate-700">{format(new Date(e.expenseDate), 'dd/MM/yyyy')}</div>
                           <div className="text-[10px] text-slate-400 font-medium">ID: {e.id}</div>
                        </td>
                        <td className="p-lg">
                           <div className="text-slate-800 font-bold text-xs">{e.facilityName}</div>
                           <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 border border-slate-200 uppercase mt-1 inline-block tracking-wider">
                              {e.expenseCategory}
                           </span>
                        </td>
                        <td className="p-lg">
                           <div className="text-slate-800 font-bold">{e.expenseContent}</div>
                           {e.note && <div className="text-xs text-slate-400 mt-1 italic line-clamp-1">{e.note}</div>}
                        </td>
                        <td className="p-lg text-right font-black text-rose-600 text-lg">
                           -{Number(e.amount).toLocaleString()} ₫
                        </td>
                        <td className="p-lg text-center">
                           <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleEdit(e)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa">
                                 <Pencil size={18} />
                              </button>
                              <button onClick={() => { if(confirm('Bạn có chắc muốn xóa khoản chi này?')) deleteExpense(e.id); }} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Xóa">
                                 <Trash2 size={18} />
                              </button>
                           </div>
                        </td>
                     </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                     <tr>
                        <td colSpan={5} className="p-2xl text-center">
                           <div className="flex flex-col items-center gap-md text-slate-400">
                             <Search size={48} strokeWidth={1} />
                             <p className="font-bold">Không tìm thấy chi phí phù hợp.</p>
                           </div>
                        </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
         {filteredExpenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(e => (
             <div key={e.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                 <div className="flex justify-between items-start mb-2">
                     <div>
                         <div className="font-bold text-slate-800">{e.expenseContent}</div>
                         <div className="text-xs text-slate-500">{format(new Date(e.expenseDate), 'dd/MM/yyyy')} - {e.facilityName}</div>
                     </div>
                     <span className="font-black text-rose-600">-{Number(e.amount).toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center mt-2">
                     <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 border border-slate-200 uppercase">
                        {e.expenseCategory}
                     </span>
                     <div className="flex gap-2">
                         <button onClick={() => handleEdit(e)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Pencil size={16}/></button>
                         <button onClick={() => { if(confirm('Xóa?')) deleteExpense(e.id); }} className="p-2 text-rose-600 bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                     </div>
                 </div>
             </div>
         ))}
         {filteredExpenses.length === 0 && (
             <div className="text-center py-10 text-slate-400">
                 <Search size={32} className="mx-auto mb-2 opacity-50" />
                 <p className="text-sm">Không tìm thấy chi phí.</p>
             </div>
         )}
      </div>

      <ExpenseModal 
         isOpen={isModalOpen} 
         onClose={() => setModalOpen(false)} 
         expense={editingExpense} 
      />
    </div>
  );
};
