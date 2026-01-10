
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Package, Plus, AlertTriangle, Search, Repeat, ArrowRight, 
  Pencil, Save, DollarSign, Shirt, Ticket, X, RefreshCw, CheckCircle2, Minus, ArrowDownCircle, ArrowUpCircle, History, Info, LayoutGrid, Trash2, Camera, User, ExternalLink, Image as ImageIcon, Eye, HelpCircle, AlertOctagon,
  MoreVertical, Loader2, LayoutDashboard, TrendingUp, PieChart, Droplets, Calendar, DoorOpen
} from 'lucide-react';
import { ServiceItem, Expense, ItemCategory, InventoryTransaction } from '../types';
import { Modal } from '../components/Modal';
import { format, parseISO } from 'date-fns';

export const Inventory: React.FC = () => {
  const { 
    services, updateService, addService, deleteService, addExpense, 
    facilities, notify, bookings, refreshData, isLoading, 
    inventoryTransactions, addInventoryTransaction, currentUser, rooms
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<'Overview' | 'Consumable' | 'Linen' | 'Service' | 'History'>('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  
  // History Filters
  const [historyDate, setHistoryDate] = useState('');
  const [historyRoom, setHistoryRoom] = useState('');

  // Modal States
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'Purchase' | 'SendLaundry' | 'ReceiveLaundry' | 'Liquidate'>('Purchase');
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Transaction Form States
  const [actionQty, setActionQty] = useState(0);
  const [actionPrice, setActionPrice] = useState(0);
  const [damageQty, setDamageQty] = useState(0); 
  const [selectedFacility, setSelectedFacility] = useState(facilities[0]?.facilityName || '');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [transNote, setTransNote] = useState('');

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ServiceItem>>({});
  const [newServiceForm, setNewServiceForm] = useState<Partial<ServiceItem>>({
      name: '',
      price: 0,
      costPrice: 0,
      unit: 'Cái',
      stock: 0,
      minStock: 5,
      category: 'Minibar',
      laundryStock: 0,
      in_circulation: 0,
      totalassets: 0,
      default_qty: 0
  });

  // 1. Phân loại và lọc dữ liệu
  const filteredItems = useMemo(() => {
    return (services || []).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesCategory = false;
      if (activeTab === 'Consumable') {
        matchesCategory = item.category === 'Minibar' || item.category === 'Amenity';
      } else if (activeTab === 'Linen') {
        matchesCategory = item.category === 'Linen' || item.category === 'Asset';
      } else if (activeTab === 'Service') {
        matchesCategory = item.category === 'Service' || item.category === 'Voucher';
      } else {
        return true; 
      }

      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, activeTab]);

  const filteredHistory = useMemo(() => {
    return (inventoryTransactions || []).filter(t => {
      // 1. Search text
      const matchSearch = t.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.staff_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Date Filter
      const matchDate = historyDate ? t.created_at.startsWith(historyDate) : true;

      // 3. Room Filter (Search in Note content)
      const matchRoom = historyRoom ? (t.note || '').toLowerCase().includes(historyRoom.toLowerCase()) : true;

      return matchSearch && matchDate && matchRoom;
    });
  }, [inventoryTransactions, searchTerm, historyDate, historyRoom]);

  // 4. KPI Tổng quan & Analytics
  const stats = useMemo(() => {
      // Basic Stats: Tính tổng giá trị dựa trên TỔNG TÀI SẢN (Sạch + Bẩn + Đang Dùng) thay vì chỉ Kho Sạch
      const totalInventoryValue = services.reduce((sum, s) => {
          // Ưu tiên dùng trường totalassets nếu có, nếu không thì cộng dồn các kho
          const totalQty = Number(s.totalassets) > 0 
              ? Number(s.totalassets) 
              : (Number(s.stock) || 0) + (Number(s.laundryStock) || 0) + (Number(s.in_circulation) || 0);
          
          return sum + (totalQty * (Number(s.costPrice) || 0));
      }, 0);
      
      // Low Stock Logic
      const lowStockList = services.filter(s => (s.stock || 0) <= (s.minStock || 0) && s.category !== 'Service');
      const outOfStockList = services.filter(s => (s.stock || 0) === 0 && s.category !== 'Service');

      // Category Breakdown
      const categoryValue: Record<string, number> = {};
      services.forEach(s => {
          if(s.category === 'Service') return;
          const totalQty = Number(s.totalassets) > 0 
              ? Number(s.totalassets) 
              : (Number(s.stock) || 0) + (Number(s.laundryStock) || 0) + (Number(s.in_circulation) || 0);
          const val = totalQty * (Number(s.costPrice) || 0);
          categoryValue[s.category] = (categoryValue[s.category] || 0) + val;
      });

      // Linen Cycle Stats (Based on DB Fields)
      const linenItems = services.filter(s => s.category === 'Linen');
      const totalLinenClean = linenItems.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
      const totalLinenDirty = linenItems.reduce((sum, s) => sum + (Number(s.laundryStock) || 0), 0);
      const totalLinenInUse = linenItems.reduce((sum, s) => sum + (Number(s.in_circulation) || 0), 0);
      const totalLinenAssets = totalLinenClean + totalLinenDirty + totalLinenInUse;

      return { 
          totalInventoryValue, 
          lowStockList, 
          outOfStockList, 
          categoryValue,
          linenStats: { clean: totalLinenClean, dirty: totalLinenDirty, inUse: totalLinenInUse, total: totalLinenAssets }
      };
  }, [services]);

  const openTransaction = (item: ServiceItem, mode: 'Purchase' | 'SendLaundry' | 'ReceiveLaundry' | 'Liquidate') => {
    setSelectedItem(item);
    setActionQty(mode === 'Purchase' ? 10 : 1);
    setDamageQty(0);
    setActionPrice(item.costPrice || 0);
    setEvidenceUrl('');
    setTransNote('');
    setModalMode(mode);
    setTransModalOpen(true);
  };

  const handleTransactionSubmit = async () => {
    if (!selectedItem || actionQty <= 0) return;
    if (isSubmitting) return;

    if (!currentUser) {
        notify('error', 'Vui lòng đăng nhập để thực hiện giao dịch');
        return;
    }

    setIsSubmitting(true);
    try {
        let newItem = { ...selectedItem };
        let transType: InventoryTransaction['type'] = 'ADJUST';
        let expense: Expense | null = null;

        if (modalMode === 'Purchase') {
            // NHẬP HÀNG
            transType = 'IN';
            newItem.stock = (Number(newItem.stock) || 0) + actionQty;
            if (newItem.category === 'Linen' || newItem.category === 'Asset') {
                newItem.totalassets = (Number(newItem.totalassets) || 0) + actionQty;
            } else {
                newItem.totalassets = newItem.stock; 
            }
            newItem.costPrice = actionPrice;
            
            const totalCost = actionQty * actionPrice;
            if (totalCost > 0) {
                expense = {
                    id: `IMP${Date.now()}`,
                    expenseDate: new Date().toISOString().substring(0, 10),
                    facilityName: selectedFacility,
                    expenseCategory: 'Nhập hàng',
                    expenseContent: `Nhập kho ${actionQty} ${newItem.unit} ${newItem.name}`,
                    amount: totalCost,
                    note: `Bằng chứng: ${evidenceUrl || 'Không có link'}. Ghi chú: ${transNote}`
                };
            }
        } 
        else if (modalMode === 'SendLaundry') {
            // GỬI GIẶT: Stock (Clean) -> Laundry (Dirty)
            transType = 'LAUNDRY_SEND';
            if((Number(newItem.stock) || 0) < actionQty) {
                notify('error', 'Không đủ tồn kho sạch để gửi giặt');
                setIsSubmitting(false);
                return;
            }
            newItem.stock = (Number(newItem.stock) || 0) - actionQty;
            newItem.laundryStock = (Number(newItem.laundryStock) || 0) + actionQty;
        } 
        else if (modalMode === 'ReceiveLaundry') {
            // NHẬN GIẶT: Laundry (Dirty) -> Stock (Clean)
            transType = 'LAUNDRY_RECEIVE';
            if((Number(newItem.laundryStock) || 0) < actionQty) {
                notify('error', 'Số lượng nhận vượt quá số lượng đang giặt');
                setIsSubmitting(false);
                return;
            }
            const actualReturn = actionQty - damageQty;
            
            newItem.laundryStock = (Number(newItem.laundryStock) || 0) - actionQty;
            newItem.stock = (Number(newItem.stock) || 0) + actualReturn;

            if (damageQty > 0) {
                // Nếu có hỏng, giảm tổng tài sản
                newItem.totalassets = (Number(newItem.totalassets) || 0) - damageQty;
            }
        }
        else if (modalMode === 'Liquidate') {
            // THANH LÝ
            transType = 'OUT';
            if((Number(newItem.stock) || 0) < actionQty) {
                notify('error', 'Không đủ tồn kho để hủy');
                setIsSubmitting(false);
                return;
            }
            newItem.stock = (Number(newItem.stock) || 0) - actionQty;
            
            if (newItem.category === 'Linen' || newItem.category === 'Asset') {
                newItem.totalassets = (Number(newItem.totalassets) || 0) - actionQty;
            } else {
                newItem.totalassets = newItem.stock;
            }
        }

        const transaction: InventoryTransaction = {
            id: `TR-${Date.now()}`,
            created_at: new Date().toISOString(),
            staff_id: currentUser.id,
            staff_name: currentUser.collaboratorName,
            item_id: newItem.id,
            item_name: newItem.name,
            type: transType,
            quantity: actionQty,
            price: actionPrice,
            total: actionQty * actionPrice,
            evidence_url: evidenceUrl,
            note: transNote + (damageQty > 0 ? ` (Hỏng/Mất: ${damageQty})` : ''),
            facility_name: selectedFacility
        };

        await updateService(newItem);
        await addInventoryTransaction(transaction);
        if (expense) await addExpense(expense);

        setTransModalOpen(false);
        notify('success', 'Đã lưu giao dịch và cập nhật Tổng Kho.');
    } catch(err) {
        notify('error', 'Lỗi khi lưu giao dịch.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editForm.id && editForm.name) {
          setIsSubmitting(true);
          try {
             // Ensure we grab stock from form if edited, or fallback cleanly
             const formAny = editForm as any;
             const safeStock = formAny.stock !== undefined ? Number(formAny.stock) : Number(formAny.Stock ?? 0);

             const payload: ServiceItem = {
                 id: editForm.id,
                 name: editForm.name,
                 price: Number(editForm.price ?? 0),
                 costPrice: Number(editForm.costPrice ?? 0),
                 unit: editForm.unit ?? 'Cái',
                 stock: safeStock, 
                 minStock: Number(editForm.minStock ?? 0),
                 category: editForm.category ?? 'Service',
                 laundryStock: Number(editForm.laundryStock ?? 0),
                 in_circulation: Number(editForm.in_circulation ?? 0),
                 totalassets: Number(editForm.totalassets ?? 0), 
                 default_qty: Number(editForm.default_qty ?? 0)
             };
             
             await updateService(payload);
             setEditModalOpen(false);
             notify('success', 'Đã lưu thay đổi.');
          } catch(e) {
             console.error(e);
             notify('error', 'Lỗi khi lưu thay đổi.');
          } finally {
             setIsSubmitting(false);
          }
      }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newServiceForm.name) {
          setIsSubmitting(true);
          try {
              const item: ServiceItem = {
                  ...(newServiceForm as ServiceItem),
                  id: `S${Date.now()}`,
                  totalassets: newServiceForm.stock || 0,
                  laundryStock: 0,
                  in_circulation: 0,
                  default_qty: newServiceForm.default_qty || 0
              };
              await addService(item);
              setAddModalOpen(false);
              setNewServiceForm({ name: '', price: 0, costPrice: 0, unit: 'Cái', stock: 0, minStock: 5, category: 'Minibar', totalassets: 0, default_qty: 0 });
              notify('success', 'Đã thêm vật tư mới.');
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  const handleDeleteItem = async (id: string, name: string) => {
      if (confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn "${name}" khỏi danh mục?`)) {
          await deleteService(id);
          notify('info', `Đã xóa ${name}`);
      }
  };

  const getTransBadge = (type: InventoryTransaction['type']) => {
      switch(type) {
          case 'IN': return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black border border-emerald-200 uppercase tracking-tighter">NHẬP KHO</span>;
          case 'OUT': return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-black border border-rose-200 uppercase tracking-tighter">XUẤT / HỦY</span>;
          case 'LAUNDRY_SEND': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black border border-blue-200 uppercase tracking-tighter">GỬI GIẶT</span>;
          case 'LAUNDRY_RECEIVE': return <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-black border border-indigo-200 uppercase tracking-tighter">NHẬN GIẶT</span>;
          case 'EXCHANGE': return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-black border border-amber-200 uppercase tracking-tighter">ĐỔI 1-1</span>;
          default: return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black border border-slate-200 uppercase tracking-tighter">ĐIỀU CHỈNH</span>;
      }
  };

  // --- RENDER CONTENT HELPERS ---
  const renderOverview = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* TOP CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><DollarSign size={80}/></div>
                  <div className="relative z-10">
                      <div className="flex items-center gap-2 text-emerald-100 mb-2 font-bold text-xs uppercase tracking-widest"><TrendingUp size={16}/> Tổng giá trị tài sản</div>
                      <div className="text-3xl font-black">{stats.totalInventoryValue.toLocaleString()} ₫</div>
                      <p className="text-xs text-emerald-100 mt-2 opacity-80">Tổng giá vốn (Kho sạch + Đang dùng + Đang giặt).</p>
                  </div>
              </div>

              <div className="hidden md:flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cảnh báo nhập hàng</div>
                          <div className="text-3xl font-black text-rose-600">{stats.lowStockList.length}</div>
                      </div>
                      <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={24}/></div>
                  </div>
                  <div className="mt-4">
                      <div className="text-xs text-slate-500 font-medium">Trong đó có <b className="text-rose-600">{stats.outOfStockList.length}</b> mặt hàng đã hết sạch (Stock = 0).</div>
                  </div>
              </div>

              <div className="hidden md:flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Chu trình đồ vải (Linen)</div>
                          <div className="text-3xl font-black text-blue-600">{((Number(stats.linenStats.clean) / (Number(stats.linenStats.total) || 1)) * 100).toFixed(0)}% <span className="text-sm text-slate-400 font-bold">Sạch</span></div>
                      </div>
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Shirt size={24}/></div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(Number(stats.linenStats.clean) / (Number(stats.linenStats.total) || 1)) * 100}%` }} title="Sạch"></div>
                      <div className="h-full bg-blue-500" style={{ width: `${(Number(stats.linenStats.inUse) / (Number(stats.linenStats.total) || 1)) * 100}%` }} title="Đang dùng"></div>
                      <div className="h-full bg-rose-500" style={{ width: `${(Number(stats.linenStats.dirty) / (Number(stats.linenStats.total) || 1)) * 100}%` }} title="Bẩn/Đang giặt"></div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Sạch</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Dùng</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Bẩn</span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LOW STOCK ALERT LIST */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col md:h-[400px]">
                  <div className="p-5 border-b border-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertOctagon size={18} className="text-rose-500"/> Cần nhập hàng gấp</h3>
                      <button onClick={() => { setActiveTab('Consumable'); setSearchTerm(''); }} className="text-xs font-bold text-brand-600 hover:underline">Xem tất cả kho</button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                      {/* DESKTOP TABLE */}
                      <div className="hidden md:block">
                        {stats.lowStockList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                                <CheckCircle2 size={40} className="mb-2 opacity-50"/>
                                <span className="text-sm font-medium">Kho hàng ổn định</span>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="text-slate-400 font-bold uppercase tracking-wider bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="p-3">Tên hàng</th>
                                        <th className="p-3 text-center">Phân loại</th>
                                        <th className="p-3 text-center">Tồn kho</th>
                                        <th className="p-3 text-center">Tối thiểu</th>
                                        <th className="p-3 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stats.lowStockList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="p-3 text-center text-slate-500">{item.category}</td>
                                            <td className="p-3 text-center">
                                                <span className={`font-black px-2 py-1 rounded ${item.stock === 0 ? 'bg-rose-100 text-rose-600' : 'text-orange-600'}`}>
                                                    {item.stock} {item.unit}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center text-slate-400">{item.minStock}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => openTransaction(item, 'Purchase')} className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2 py-1 rounded hover:bg-brand-100 transition-colors">NHẬP NGAY</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                      </div>

                      {/* MOBILE CARDS FOR LOW STOCK */}
                      <div className="md:hidden space-y-2">
                          {stats.lowStockList.length === 0 ? (
                              <div className="text-center text-slate-400 py-10 italic">Kho hàng ổn định</div>
                          ) : stats.lowStockList.map(item => (
                              <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="font-bold text-slate-700 text-sm">{item.name}</span>
                                      <span className={`font-black text-sm ${item.stock === 0 ? 'text-rose-600' : 'text-orange-600'}`}>
                                          {item.stock} {item.unit}
                                      </span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
                                      <span>Tối thiểu: {item.minStock}</span>
                                      <span className="uppercase">{item.category}</span>
                                  </div>
                                  <button onClick={() => openTransaction(item, 'Purchase')} className="w-full bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2.5 rounded-lg shadow-sm active:scale-95 transition-all">NHẬP NGAY</button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* CATEGORY DISTRIBUTION - HIDDEN ON MOBILE */}
              <div className="hidden md:flex bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex-col h-[400px]">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-6"><PieChart size={18} className="text-brand-600"/> Phân bổ giá trị kho</h3>
                  <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                      {Object.entries(stats.categoryValue).sort((a,b) => Number(b[1]) - Number(a[1])).map(([cat, val]) => {
                          const percent = (Number(val) / Number(stats.totalInventoryValue)) * 100;
                          return (
                              <div key={cat}>
                                  <div className="flex justify-between text-xs mb-1">
                                      <span className="font-bold text-slate-600">{cat}</span>
                                      <span className="font-mono font-bold text-slate-800">{val.toLocaleString()} ₫ ({percent.toFixed(1)}%)</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${cat === 'Linen' ? 'bg-blue-500' : cat === 'Asset' ? 'bg-purple-500' : cat === 'Minibar' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }}></div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 text-[10px] text-slate-400 italic text-center">
                      * Dựa trên Giá vốn (Cost Price) x Tổng tài sản (Sạch+Bẩn+Dùng)
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 animate-enter pb-20 md:pb-10 min-h-screen md:h-full flex flex-col">
      {/* HEADER & KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
               <Package className="text-brand-600" /> Quản lý Kho & Vật tư
            </h1>
            <p className="text-slate-500 text-sm font-medium">Quy trình tự động hóa: Check-in trừ kho, Checkout trả kho bẩn.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setAddModalOpen(true)} className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 flex-1 md:flex-none">
                <Plus size={20}/> <span className="inline">Thêm vật tư</span>
            </button>
            <button onClick={() => refreshData()} disabled={isLoading} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-brand-600 transition-all">
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''}/>
            </button>
        </div>
      </div>

      {/* TABS & SEARCH - STICKY ON MOBILE */}
      <div className="bg-[#f8fafc]/90 backdrop-blur-md sticky top-0 z-30 pb-2 -mx-4 px-4 md:static md:bg-transparent md:mx-0 md:px-0 md:pb-0 transition-all">
        <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('Overview')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Overview' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><LayoutDashboard size={14} className="block"/> Tổng quan</button>
                <button onClick={() => setActiveTab('Consumable')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'Consumable' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Đồ Tiêu Hao</button>
                <button onClick={() => setActiveTab('Linen')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'Linen' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Đồ Vải & Tài Sản</button>
                <button onClick={() => setActiveTab('Service')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'Service' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Dịch vụ</button>
                <button onClick={() => setActiveTab('History')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'History' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><History size={14} className="block"/> Lịch sử</button>
            </div>

            {activeTab === 'History' ? (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm tên, NV..." 
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full md:w-48 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Hide filters on mobile for simplicity */}
                    <div className="relative group flex-1 md:flex-none hidden md:block">
                        <DoorOpen className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Số phòng..." 
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full md:w-32 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                            value={historyRoom}
                            onChange={e => setHistoryRoom(e.target.value)}
                        />
                    </div>
                    <div className="relative group flex-1 md:flex-none hidden md:block">
                        <Calendar className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                        <input 
                            type="date" 
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full md:w-auto bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-slate-600 cursor-pointer"
                            value={historyDate}
                            onChange={e => setHistoryDate(e.target.value)}
                        />
                    </div>
                </div>
            ) : (
                activeTab !== 'Overview' && (
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                        type="text" 
                        placeholder="Tìm tên vật tư, hàng hóa..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50/50"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                )
            )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {activeTab === 'Overview' ? renderOverview() : (
      <div className="flex-1 flex flex-col md:bg-white md:rounded-2xl md:shadow-soft md:border md:border-slate-100 md:overflow-hidden md:min-h-[300px]">
        {activeTab === 'History' ? (
            <div className="md:flex-1 md:overflow-x-auto md:overflow-y-auto md:custom-scrollbar">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="p-5">Thời gian</th>
                                <th className="p-5">Người thực hiện</th>
                                <th className="p-5">Vật tư / Hàng hóa</th>
                                <th className="p-5 text-center">Giao dịch</th>
                                <th className="p-5 text-center">Số lượng</th>
                                <th className="p-5">Bằng chứng Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredHistory.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold text-slate-800">{format(parseISO(t.created_at), 'HH:mm')}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{format(parseISO(t.created_at), 'dd/MM/yyyy')}</div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 font-black text-xs shadow-sm border border-brand-100">{t.staff_name.charAt(0)}</div>
                                            <div className="font-bold text-slate-700">{t.staff_name}</div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-black text-slate-800">{t.item_name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{t.facility_name || 'Hệ thống'}</div>
                                    </td>
                                    <td className="p-5 text-center">{getTransBadge(t.type)}</td>
                                    <td className="p-5 text-center">
                                        <div className={`font-black text-lg ${t.type === 'IN' || t.type === 'LAUNDRY_RECEIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'IN' || t.type === 'LAUNDRY_RECEIVE' ? '+' : '-'}{t.quantity}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-start gap-3">
                                            {t.evidence_url ? (
                                                <div className="relative group/img shrink-0">
                                                    <img 
                                                        src={t.evidence_url} 
                                                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform group-hover/img:scale-150 group-hover/img:z-20 group-hover/img:relative" 
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                        alt="Audit proof"
                                                    />
                                                    <a href={t.evidence_url} target="_blank" className="absolute -top-1 -right-1 bg-brand-600 text-white p-0.5 rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                        <ExternalLink size={10}/>
                                                    </a>
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
                                                    <ImageIcon size={16}/>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-[200px]">
                                                <div className="text-xs text-slate-600 italic whitespace-normal break-words">{t.note || 'Không ghi chú.'}</div>
                                                {t.evidence_url && <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-0.5 mt-1"><Camera size={10}/> Đã lưu bằng chứng</span>}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Timeline Feed */}
                <div className="md:hidden p-2 relative">
                    {/* Vertical Line - Shifted right to 72px to clear w-16 text */}
                    <div className="absolute left-[72px] top-4 bottom-4 w-0.5 bg-slate-200 -z-10"></div>
                    
                    {filteredHistory.map(t => (
                       <div key={t.id} className="flex gap-4 mb-6 relative">
                           {/* Time Column - Increased to w-16 */}
                           <div className="w-16 shrink-0 text-right pt-1 pr-2">
                               <div className="text-xs font-black text-slate-700">{format(parseISO(t.created_at), 'HH:mm')}</div>
                               <div className="text-[9px] text-slate-400 font-medium">{format(parseISO(t.created_at), 'dd/MM')}</div>
                           </div>
                           
                           {/* Dot - Centered on line (72px) -> left-[67px] */}
                           <div className={`absolute left-[67px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${t.type === 'IN' || t.type === 'LAUNDRY_RECEIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

                           {/* Content Card */}
                           <div className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                               <div className="flex justify-between items-start mb-1">
                                   <div className="font-bold text-slate-800">{t.item_name}</div>
                                   <div className={`font-black ${t.type === 'IN' || t.type === 'LAUNDRY_RECEIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                       {t.type === 'IN' || t.type === 'LAUNDRY_RECEIVE' ? '+' : '-'}{t.quantity}
                                   </div>
                               </div>
                               <div className="flex items-center gap-2 mb-2">
                                   <span className="text-xs text-slate-500">{t.staff_name}</span>
                                   {getTransBadge(t.type)}
                               </div>
                               {t.note && <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg break-words">{t.note}</div>}
                           </div>
                       </div>
                    ))}
                    {filteredHistory.length === 0 && <div className="text-center text-slate-400 text-sm py-10">Không có lịch sử.</div>}
                </div>
            </div>
        ) : (
            <div className="md:flex-1 md:overflow-x-auto md:overflow-y-auto md:custom-scrollbar">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            {activeTab === 'Linen' ? (
                                <tr>
                                    <th className="p-5">Tên Đồ Vải / Tài Sản</th>
                                    <th className="p-5 text-center bg-blue-50/50 text-blue-700">Đang Dùng (In Circulation)</th>
                                    <th className="p-5 text-center bg-emerald-50/50 text-emerald-700">Kho Sạch (Stock)</th>
                                    <th className="p-5 text-center bg-rose-50/50 text-rose-700">Đang Giặt (Laundry)</th>
                                    <th className="p-5 text-center font-black text-slate-800">
                                        <div className="flex items-center justify-center gap-1">
                                            Tổng Thực Tế
                                            <span title="= Đang dùng + Kho Sạch + Kho Bẩn">
                                                <HelpCircle size={12} className="text-slate-400 cursor-help"/>
                                            </span>
                                        </div>
                                    </th>
                                    <th className="p-5 text-center font-black text-slate-800">
                                        <div className="flex items-center justify-center gap-1">
                                            Database (Tài sản)
                                            <span title="Tổng số lượng đang sở hữu trên sổ sách">
                                                <Info size={12} className="text-slate-400 cursor-help" />
                                            </span>
                                        </div>
                                    </th>
                                    <th className="p-5 text-center">Đối Soát (Lệch)</th>
                                    <th className="p-5 text-center">Thao tác</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-5">Tên Hàng Hóa / Amenity</th>
                                    <th className="p-5 text-center">ĐVT</th>
                                    <th className="p-5 text-center">Giá bán</th>
                                    <th className="p-5 text-center">Tồn Kho Hiện Tại</th>
                                    <th className="p-5 text-center">Tồn Tối Thiểu</th>
                                    <th className="p-5 text-center">Trạng thái</th>
                                    <th className="p-5 text-center">Thao tác</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.map(item => {
                                const isLow = (item.stock || 0) <= (item.minStock || 0) && item.category !== 'Service';
                                
                                // Logic Tổng Kho cho Linen/Asset
                                const inRoom = Number(item.in_circulation) || 0; 
                                const currentTotalCycle = (Number(item.stock) || 0) + (Number(item.laundryStock) || 0) + inRoom;
                                const recordedTotal = Number(item.totalassets) || 0;
                                const variance = currentTotalCycle - recordedTotal; 

                                if (activeTab === 'Linen') return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-black text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.category}</div>
                                            <div className="text-[9px] text-slate-400 mt-1">Định mức: <b className="text-slate-600">{item.default_qty || 0}</b>/phòng</div>
                                        </td>
                                        <td className="p-5 text-center bg-blue-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-700 font-bold text-base">{inRoom}</span>
                                                <span className="text-[9px] text-blue-400 font-black uppercase mt-1">Trong phòng</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center bg-emerald-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-emerald-700 font-black text-base">{item.stock || 0}</span>
                                                <span className="text-[9px] text-emerald-400 font-bold uppercase mt-1">Sẵn sàng</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center bg-rose-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-rose-700 font-black text-base">{item.laundryStock || 0}</span>
                                                {item.laundryStock! > 0 && (
                                                    <button onClick={() => openTransaction(item, 'ReceiveLaundry')} className="text-[9px] font-black text-rose-500 hover:underline flex items-center gap-0.5 mt-1 bg-white px-2 py-1 rounded shadow-sm border border-rose-100 hover:bg-rose-50">
                                                        <ArrowDownCircle size={10}/> NHẬP GIẶT
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="font-black text-lg text-slate-800">{currentTotalCycle}</div>
                                        </td>
                                        <td className="p-5 text-center bg-slate-50">
                                            <div className="font-black text-lg text-slate-600 border-b-2 border-slate-300 inline-block px-2 cursor-pointer hover:text-brand-600 hover:border-brand-500 transition-colors" title="Bấm vào nút bút chì để sửa số liệu gốc này" onClick={() => { setEditForm(item); setEditModalOpen(true); }}>
                                                {recordedTotal}
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            {variance === 0 ? (
                                                <div className="text-[9px] text-emerald-500 font-black uppercase flex items-center justify-center gap-1 bg-emerald-50 py-1 px-2 rounded-full border border-emerald-100">
                                                    <CheckCircle2 size={10}/> Khớp
                                                </div>
                                            ) : variance < 0 ? (
                                                 <div className="text-[9px] text-rose-500 font-black uppercase flex items-center justify-center gap-1 bg-rose-50 py-1 px-2 rounded-full border border-rose-100 animate-pulse">
                                                    <AlertTriangle size={10}/> Thiếu {Math.abs(variance)}
                                                </div>
                                            ) : (
                                                <div className="text-[9px] text-amber-500 font-black uppercase flex items-center justify-center gap-1 bg-amber-50 py-1 px-2 rounded-full border border-amber-100">
                                                    <AlertOctagon size={10}/> Thừa {variance}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => openTransaction(item, 'Purchase')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Nhập hàng mới / Tăng tài sản"><Plus size={18}/></button>
                                                <button onClick={() => openTransaction(item, 'SendLaundry')} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Gửi đồ đi giặt (Sạch -> Bẩn)"><Repeat size={18}/></button>
                                                <button onClick={() => openTransaction(item, 'Liquidate')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Thanh lý / Hủy / Vỡ"><Trash2 size={18}/></button>
                                                <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"><Pencil size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );

                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-black text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.category}</div>
                                        </td>
                                        <td className="p-5 text-center text-slate-500 font-bold">{item.unit}</td>
                                        <td className="p-5 text-center text-slate-800 font-bold">{item.price.toLocaleString()}</td>
                                        <td className="p-5 text-center">
                                            <div className={`text-lg font-black ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{item.stock || 0}</div>
                                        </td>
                                        <td className="p-5 text-center text-slate-400 font-bold">{item.minStock || 0}</td>
                                        <td className="p-5 text-center">
                                            {isLow ? (
                                                <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[10px] font-black rounded-lg border border-rose-200 uppercase flex items-center justify-center gap-1">
                                                    <AlertTriangle size={12}/> Sắp hết
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg border border-emerald-200 uppercase flex items-center justify-center gap-1">
                                                    <CheckCircle2 size={12}/> Đủ hàng
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => openTransaction(item, 'Purchase')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Nhập hàng"><Plus size={18}/></button>
                                                <button onClick={() => openTransaction(item, 'Liquidate')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Hủy / Hết hạn"><Trash2 size={18}/></button>
                                                <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"><Pencil size={18}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr><td colSpan={7} className="p-20 text-center text-slate-300 italic font-medium">Không tìm thấy mặt hàng nào.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Smart Cards */}
                <div className="md:hidden space-y-3">
                   {filteredItems.map(item => {
                       const isLow = (item.stock || 0) <= (item.minStock || 0) && item.category !== 'Service';
                       // Percent calculation for visual bar (Stock vs MinStock or TotalAssets)
                       const max = Math.max(item.minStock || 10, item.totalassets || item.stock || 10);
                       const percent = Math.min(100, ((item.stock || 0) / max) * 100);
                       let barColor = 'bg-emerald-500';
                       if (isLow) barColor = 'bg-rose-500';
                       else if ((item.stock || 0) < (item.minStock || 0) * 1.5) barColor = 'bg-amber-500';

                       return (
                           <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                               {/* Card Header */}
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <div className="font-bold text-slate-800 text-lg line-clamp-1">{item.name}</div>
                                       <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">{item.category}</span>
                                   </div>
                                   <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                                       <Pencil size={18}/>
                                   </button>
                               </div>
                               
                               {/* Visual Stock Bar */}
                               {activeTab === 'Linen' ? (
                                   <div className="w-full h-2 bg-slate-100 rounded-full mb-3 overflow-hidden flex">
                                       <div className="bg-emerald-500 h-full" style={{ width: `${(item.stock || 0) / (item.totalassets || 1) * 100}%` }} title="Sạch"></div>
                                       <div className="bg-blue-500 h-full" style={{ width: `${(item.in_circulation || 0) / (item.totalassets || 1) * 100}%` }} title="Đang dùng"></div>
                                       <div className="bg-rose-500 h-full" style={{ width: `${(item.laundryStock || 0) / (item.totalassets || 1) * 100}%` }} title="Bẩn"></div>
                                   </div>
                               ) : (
                                   <div className="w-full h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
                                       <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }}></div>
                                   </div>
                               )}

                               {/* Details Grid */}
                               {(item.category === 'Linen' || item.category === 'Asset') ? (
                                   <div className="grid grid-cols-3 gap-2 mb-4">
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Kho Sạch</div>
                                           <div className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.stock}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Đang Dùng</div>
                                           <div className="font-bold text-blue-600 text-sm">{item.in_circulation || 0}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Kho Bẩn</div>
                                           <div className="font-bold text-rose-600 text-sm">{item.laundryStock || 0}</div>
                                       </div>
                                   </div>
                               ) : (
                                   <div className="grid grid-cols-3 gap-2 mb-4">
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Giá</div>
                                           <div className="font-bold text-slate-700 text-xs">{item.price > 0 ? `${item.price/1000}k` : '-'}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Kho Sạch</div>
                                           <div className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.stock}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Đơn Vị</div>
                                           <div className="font-bold text-slate-700 text-xs">{item.unit}</div>
                                       </div>
                                   </div>
                               )}

                               {/* Action Grid Buttons */}
                               <div className="grid grid-cols-3 gap-2">
                                   <button onClick={() => openTransaction(item, 'Purchase')} className="py-3 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                                       <Plus size={18} strokeWidth={2.5}/> Nhập
                                   </button>
                                   
                                   {activeTab === 'Linen' ? (
                                       <button onClick={() => openTransaction(item, 'SendLaundry')} className="py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                                           <Repeat size={18} strokeWidth={2.5}/> Giặt
                                       </button>
                                   ) : (
                                       // Empty space filler if not Linen
                                       <div className="hidden"></div>
                                   )}
                                   
                                   <button onClick={() => openTransaction(item, 'Liquidate')} className={`py-3 bg-white text-rose-600 hover:bg-rose-50 border border-rose-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all ${activeTab !== 'Linen' ? 'col-span-2' : ''}`}>
                                       <Trash2 size={18} strokeWidth={2.5}/> Hủy
                                   </button>
                               </div>
                           </div>
                       );
                   })}
                </div>
            </div>
        )}
      </div>
      )}

      {/* TRANSACTION MODAL */}
      <Modal isOpen={isTransModalOpen} onClose={() => setTransModalOpen(false)} 
        title={
            modalMode === 'Purchase' ? 'Nhập Hàng / Tăng Tài Sản' : 
            modalMode === 'SendLaundry' ? 'Gửi Đồ Đi Giặt (Sạch -> Bẩn)' : 
            modalMode === 'ReceiveLaundry' ? 'Nhận Đồ Sạch (Bẩn -> Sạch)' : 'Thanh Lý / Hủy Hàng'
        } 
        size="md"
      >
        <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-200">
                        {modalMode === 'Purchase' ? <ArrowUpCircle className="text-emerald-500"/> : 
                         modalMode === 'SendLaundry' ? <Shirt className="text-blue-500"/> : 
                         modalMode === 'Liquidate' ? <Trash2 className="text-rose-500"/> :
                         <ArrowDownCircle className="text-brand-600"/>}
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Mặt hàng</div>
                        <div className="text-lg font-black text-slate-800">{selectedItem?.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Người thực hiện</div>
                    <div className="text-sm font-bold text-brand-600 flex items-center gap-1 justify-end"><User size={14}/> {currentUser?.collaboratorName}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số lượng</label>
                        <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-xl font-black focus:border-brand-500 outline-none" value={actionQty} onChange={e => setActionQty(Number(e.target.value))} />
                    </div>
                    {modalMode === 'Purchase' ? (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá nhập</label>
                            <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-xl font-black text-emerald-600 focus:border-emerald-500 outline-none" value={actionPrice} onChange={e => setActionPrice(Number(e.target.value))} />
                        </div>
                    ) : modalMode === 'ReceiveLaundry' ? (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Hỏng/Mất (Giảm TS)</label>
                            <input type="number" className="w-full border-2 border-rose-100 rounded-xl p-3 bg-white text-xl font-black text-rose-600 focus:border-rose-500 outline-none" value={damageQty} onChange={e => setDamageQty(Number(e.target.value))} />
                        </div>
                    ) : (
                        <div className="space-y-1.5 opacity-40">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dòng tiền</label>
                            <div className="w-full border-2 border-slate-100 rounded-xl p-3 bg-slate-50 text-xl font-black text-slate-400">N/A</div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bằng chứng (Link ảnh phiếu/hóa đơn)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full border-2 border-slate-100 rounded-xl p-3 pl-10 bg-white text-sm font-bold focus:border-brand-500 outline-none" 
                                placeholder="Dán link ảnh tại đây..."
                                value={evidenceUrl}
                                onChange={e => setEvidenceUrl(e.target.value)}
                            />
                            <Camera className="absolute left-3 top-3.5 text-slate-300" size={18}/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cơ sở (Ghi nhận tài chính)</label>
                        <select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={selectedFacility} onChange={e => setSelectedFacility(e.target.value)}>
                            {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú chi tiết</label>
                    <textarea 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-sm font-medium focus:border-brand-500 outline-none h-20"
                        placeholder="Ví dụ: Nhập hàng từ nhà cung cấp A..."
                        value={transNote}
                        onChange={e => setTransNote(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button onClick={() => setTransModalOpen(false)} disabled={isSubmitting} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-all">Hủy bỏ</button>
                <button onClick={handleTransactionSubmit} disabled={isSubmitting} className={`flex-[2] py-4 text-white rounded-2xl font-black shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${modalMode === 'Liquidate' ? 'bg-rose-600' : 'bg-brand-600'}`}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                    {modalMode === 'Liquidate' ? 'Xác nhận hủy' : 'Lưu giao dịch'}
                </button>
            </div>
        </div>
      </Modal>

      {/* ADD NEW SERVICE MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Thêm Vật Tư Mới" size="sm">
          <form id="addServiceForm" onSubmit={handleAddServiceSubmit} className="space-y-4">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên vật tư</label>
                  <input required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" value={newServiceForm.name} onChange={e => setNewServiceForm({...newServiceForm, name: e.target.value})} placeholder="Vd: Coca lon, Khăn tắm..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phân loại</label>
                      <select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.category} onChange={e => setNewServiceForm({...newServiceForm, category: e.target.value as any})}>
                          <option value="Minibar">Minibar</option>
                          <option value="Amenity">Amenity</option>
                          <option value="Linen">Linen (Đồ vải)</option>
                          <option value="Asset">Asset (Tài sản)</option>
                          <option value="Service">Service</option>
                      </select>
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ĐVT</label>
                      <input className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.unit} onChange={e => setNewServiceForm({...newServiceForm, unit: e.target.value})} />
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán (VND)</label>
                      <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.price} onChange={e => setNewServiceForm({...newServiceForm, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá vốn (VND)</label>
                      <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.costPrice} onChange={e => setNewServiceForm({...newServiceForm, costPrice: Number(e.target.value)})} />
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn kho đầu</label>
                      <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.stock} onChange={e => setNewServiceForm({...newServiceForm, stock: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cảnh báo tồn</label>
                      <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none" value={newServiceForm.minStock} onChange={e => setNewServiceForm({...newServiceForm, minStock: Number(e.target.value)})} />
                  </div>
              </div>
              <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setAddModalOpen(false)} disabled={isSubmitting} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">Hủy</button>
                  <button type="submit" disabled={isSubmitting} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-black shadow-lg flex items-center justify-center gap-2">
                      {isSubmitting && <Loader2 size={16} className="animate-spin"/>} Lưu Vật Tư
                  </button>
              </div>
          </form>
      </Modal>

      {/* EDIT CONFIG MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Cấu hình Hàng hóa & Vật tư" size="sm">
          <form id="editInventoryForm" onSubmit={handleEditSubmit} className="space-y-5">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên vật tư/hàng hóa</label>
                  <input required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán (VND)</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-emerald-600 outline-none focus:border-brand-500" value={editForm.price || 0} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Định mức/Phòng</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-brand-600 outline-none focus:border-brand-500" value={editForm.default_qty || 0} onChange={e => setEditForm({...editForm, default_qty: Number(e.target.value)})} />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn tối thiểu (Cảnh báo)</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-rose-600 outline-none focus:border-brand-500" value={editForm.minStock || 0} onChange={e => setEditForm({...editForm, minStock: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phân loại</label>
                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value as any})}>
                        <option value="Minibar">Minibar (Đồ uống)</option>
                        <option value="Amenity">Amenity (Tiêu hao)</option>
                        <option value="Linen">Linen (Đồ vải)</option>
                        <option value="Asset">Asset (Tài sản)</option>
                        <option value="Voucher">Voucher</option>
                        <option value="Service">Service (Dịch vụ)</option>
                    </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn kho hiện tại (Sạch)</label>
                      <input 
                          type="number" 
                          className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                          value={editForm.stock ?? 0} 
                          onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})} 
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang giặt (Kho bẩn)</label>
                      <input 
                          type="number" 
                          className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                          value={editForm.laundryStock ?? 0} 
                          onChange={e => setEditForm({...editForm, laundryStock: Number(e.target.value)})} 
                          disabled={editForm.category !== 'Linen'}
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trong phòng (In Circulation)</label>
                      <input 
                          type="number" 
                          className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                          value={editForm.in_circulation ?? 0} 
                          onChange={e => setEditForm({...editForm, in_circulation: Number(e.target.value)})} 
                          disabled={editForm.category !== 'Linen' && editForm.category !== 'Asset'}
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá Vốn (Cost Price)</label>
                      <input 
                          type="number" 
                          className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                          value={editForm.costPrice ?? 0} 
                          onChange={e => setEditForm({...editForm, costPrice: Number(e.target.value)})} 
                      />
                  </div>
              </div>

              <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tài sản (Cố định)</label>
                  <input 
                    type="number" 
                    className="w-full border-2 border-white rounded-lg p-2 font-black text-slate-800" 
                    value={editForm.totalassets ?? 0} 
                    onChange={e => setEditForm({...editForm, totalassets: Number(e.target.value)})} 
                  />
                  <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold italic">* Chỉnh sửa khi kiểm kê thấy lệch so với thực tế.</p>
              </div>
          </form>
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
             <button type="button" onClick={() => setEditModalOpen(false)} disabled={isSubmitting} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Hủy</button>
             <button form="editInventoryForm" type="submit" disabled={isSubmitting} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                 {isSubmitting && <Loader2 size={16} className="animate-spin"/>} Lưu cấu hình
             </button>
          </div>
      </Modal>
    </div>
  );
};
