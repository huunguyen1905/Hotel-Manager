
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area 
} from 'recharts';
import { format, isWithinInterval } from 'date-fns';

export const Reports: React.FC = () => {
  const { bookings, expenses } = useAppContext();
  const [range, setRange] = useState(6); // 6 months

  const monthlyData = useMemo(() => {
    const data: any[] = [];
    const today = new Date();

    for (let i = range - 1; i >= 0; i--) {
      // Calculate specific month going backwards
      const date = new Date(today);
      date.setDate(1); // Set to 1st to ensure correct month subtraction
      date.setMonth(today.getMonth() - i);
      
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      const monthLabel = format(date, 'MM/yyyy');

      // Calculate Revenue
      let revenue = 0;
      bookings.forEach(b => {
        const payments = JSON.parse(b.paymentsJson);
        payments.forEach((p: any) => {
           const pDate = new Date(p.ngayThanhToan);
           if (isWithinInterval(pDate, { start, end })) {
              revenue += Number(p.soTien);
           }
        });
      });

      // Calculate Expense
      let expense = 0;
      expenses.forEach(e => {
         const eDate = new Date(e.expenseDate);
         if (isWithinInterval(eDate, { start, end })) {
            expense += e.amount;
         }
      });

      data.push({
        name: monthLabel,
        DoanhThu: revenue,
        ChiPhi: expense,
        LoiNhuan: revenue - expense
      });
    }
    return data;
  }, [bookings, expenses, range]);

  const expenseByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    expenses.forEach(e => {
      categories[e.expenseCategory] = (categories[e.expenseCategory] || 0) + e.amount;
    });
    return Object.keys(categories).map(k => ({ name: k, value: categories[k] }));
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h1 className="text-2xl font-bold text-gray-800">Báo Cáo Kinh Doanh</h1>
         <select className="border rounded p-2" value={range} onChange={e => setRange(Number(e.target.value))}>
            <option value={3}>3 tháng gần nhất</option>
            <option value={6}>6 tháng gần nhất</option>
            <option value={12}>1 năm qua</option>
         </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Profit Chart */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Lợi Nhuận (Doanh thu - Chi phí)</h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="name" />
                     <YAxis />
                     <Tooltip formatter={(value: number) => value.toLocaleString() + ' ₫'} />
                     <Legend />
                     <Area type="monotone" dataKey="DoanhThu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                     <Area type="monotone" dataKey="ChiPhi" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} />
                     <Area type="monotone" dataKey="LoiNhuan" stroke="#10b981" fill="#10b981" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Bar Chart Comparison */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-6">Tương quan Doanh thu & Chi phí</h3>
            <div className="h-80">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="name" />
                     <YAxis />
                     <Tooltip formatter={(value: number) => value.toLocaleString() + ' ₫'} />
                     <Legend />
                     <Bar dataKey="DoanhThu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                     <Bar dataKey="ChiPhi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
         <h3 className="text-lg font-semibold mb-4">Cơ cấu chi phí</h3>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-gray-50 border-b">
                  <tr>
                     <th className="p-3">Hạng mục</th>
                     <th className="p-3 text-right">Tổng chi</th>
                     <th className="p-3 text-right">Tỷ trọng</th>
                  </tr>
               </thead>
               <tbody className="divide-y">
                  {expenseByCategory.sort((a,b) => b.value - a.value).map((item, idx) => {
                     const total = expenseByCategory.reduce((sum, i) => sum + i.value, 0);
                     return (
                        <tr key={idx}>
                           <td className="p-3 font-medium">{item.name}</td>
                           <td className="p-3 text-right text-red-600 font-bold">{item.value.toLocaleString()} ₫</td>
                           <td className="p-3 text-right text-gray-500">{total ? ((item.value / total) * 100).toFixed(1) : 0}%</td>
                        </tr>
                     )
                  })}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
