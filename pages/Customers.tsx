
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, Phone, Calendar, Search, Star, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const Customers: React.FC = () => {
  const { bookings } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  // Group bookings by phone number to create customer profiles
  const customers = useMemo(() => {
    const map = new Map<string, {
      name: string,
      phone: string,
      totalSpent: number,
      visits: number,
      lastVisit: string,
      history: any[]
    }>();

    bookings.forEach(b => {
       const phone = b.customerPhone || 'Unknown';
       if (!map.has(phone)) {
          map.set(phone, {
             name: b.customerName || 'Khách vãng lai',
             phone: phone,
             totalSpent: 0,
             visits: 0,
             lastVisit: '',
             history: []
          });
       }
       const cust = map.get(phone)!;
       cust.totalSpent += b.totalRevenue;
       cust.visits += 1;
       cust.history.push(b);
       
       if (!cust.lastVisit || new Date(b.checkinDate) > new Date(cust.lastVisit)) {
          cust.lastVisit = b.checkinDate;
       }
       // Update name if newest booking has different name (sometimes people change names)
       if (b.customerName && new Date(b.checkinDate) > new Date(cust.lastVisit)) {
          cust.name = b.customerName; 
       }
    });

    return Array.from(map.values())
       .sort((a, b) => b.totalSpent - a.totalSpent) // Sort by VIP (spending)
       .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone || '').includes(searchTerm));

  }, [bookings, searchTerm]);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Khách hàng (CRM)</h1>
          <div className="relative group w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
            <input 
              type="text" 
              placeholder="Tìm theo tên, sđt..." 
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none shadow-sm bg-white text-slate-900"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers.map(cust => (
             <div key={cust.phone} className="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                         {(cust.name || '?').charAt(0)}
                      </div>
                      <div>
                         <h3 className="font-bold text-gray-800 text-lg">{cust.name}</h3>
                         <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone size={12}/> {cust.phone}
                         </div>
                      </div>
                   </div>
                   {cust.totalSpent > 5000000 && (
                      <div className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                         <Star size={12} fill="currentColor" /> VIP
                      </div>
                   )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                   <div className="bg-slate-50 p-2 rounded-lg text-center">
                      <div className="text-xs text-slate-400 uppercase font-bold">Lượt đến</div>
                      <div className="font-bold text-slate-700">{cust.visits}</div>
                   </div>
                   <div className="bg-slate-50 p-2 rounded-lg text-center col-span-2">
                      <div className="text-xs text-slate-400 uppercase font-bold">Tổng chi tiêu</div>
                      <div className="font-bold text-brand-600">{cust.totalSpent.toLocaleString()} ₫</div>
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
                      <History size={12}/> Lịch sử gần đây
                   </div>
                   {cust.history.slice(0, 3).map((h: any) => (
                      <div key={h.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-1 last:border-0">
                         <div className="text-slate-600">{format(parseISO(h.checkinDate), 'dd/MM/yy')}</div>
                         <div className="font-medium">{h.facilityName} - {h.roomCode}</div>
                         <div className="text-slate-400 text-xs">{h.totalRevenue.toLocaleString()}</div>
                      </div>
                   ))}
                </div>
             </div>
          ))}
       </div>
    </div>
  );
};
