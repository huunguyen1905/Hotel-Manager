
import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { RoomRecipe, ServiceItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, Minus, Trash2, Save, ChefHat, Package } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recipeKey?: string; // If editing existing
  existingRecipe?: RoomRecipe | null;
}

export const RecipeModal: React.FC<Props> = ({ isOpen, onClose, recipeKey, existingRecipe }) => {
  const { services, updateRoomRecipe, notify } = useAppContext();
  
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (existingRecipe && recipeKey) {
        setKey(recipeKey);
        setDescription(existingRecipe.description);
        const map: Record<string, number> = {};
        existingRecipe.items.forEach(i => map[i.itemId] = i.quantity);
        setSelectedItems(map);
    } else {
        setKey('');
        setDescription('');
        setSelectedItems({});
    }
  }, [existingRecipe, recipeKey, isOpen]);

  const filteredServices = useMemo(() => {
      return services.filter(s => 
          (s.category === 'Linen' || s.category === 'Minibar' || s.category === 'Amenity') &&
          s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [services, searchTerm]);

  const handleAddItem = (item: ServiceItem) => {
      setSelectedItems(prev => ({
          ...prev,
          [item.id]: (prev[item.id] || 0) + 1
      }));
  };

  const updateQty = (id: string, delta: number) => {
      setSelectedItems(prev => {
          const next = (prev[id] || 0) + delta;
          if (next <= 0) {
              const copy = { ...prev };
              delete copy[id];
              return copy;
          }
          return { ...prev, [id]: next };
      });
  };

  const handleSave = () => {
      if (!key.trim()) {
          notify('error', 'Vui lòng nhập Mã loại phòng (ví dụ: 1GM8)');
          return;
      }
      
      const itemsPayload = Object.entries(selectedItems).map(([id, qty]) => ({
          itemId: id,
          quantity: Number(qty)
      }));

      const newRecipe: RoomRecipe = {
          roomType: key,
          description: description,
          items: itemsPayload
      };

      updateRoomRecipe(key, newRecipe);
      notify('success', `Đã lưu công thức cho ${key}`);
      onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existingRecipe ? `Sửa Định Mức: ${key}` : 'Tạo Định Mức Mới'} size="xl">
        <div className="flex flex-col h-[70vh]">
            {/* Header Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Mã Loại Phòng</label>
                    <input 
                        className="w-full border-2 border-slate-200 rounded-lg p-2.5 font-black text-slate-800 focus:border-brand-500 outline-none uppercase" 
                        placeholder="VD: 2GM2"
                        value={key}
                        onChange={e => setKey(e.target.value.toUpperCase())}
                        disabled={!!existingRecipe}
                    />
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Mô tả (Diện tích/Giường)</label>
                    <input 
                        className="w-full border-2 border-slate-200 rounded-lg p-2.5 font-medium text-slate-700 focus:border-brand-500 outline-none" 
                        placeholder="VD: 2 Giường 1m2 (35m2)"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* LEFT: Service Selector */}
                <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input 
                                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
                                placeholder="Tìm vật tư..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-50/50">
                        {filteredServices.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => handleAddItem(s)}
                                className="w-full flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-brand-400 hover:shadow-md transition-all group text-left"
                            >
                                <div>
                                    <div className="font-bold text-sm text-slate-700">{s.name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">{s.category} • {s.unit}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-brand-50 text-slate-300 group-hover:text-brand-600 transition-colors">
                                    <Plus size={16}/>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Recipe Builder */}
                <div className="flex-1 flex flex-col border-2 border-brand-100 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="p-3 bg-brand-50 border-b border-brand-100 flex justify-between items-center">
                        <h4 className="font-black text-brand-700 text-sm uppercase flex items-center gap-2"><ChefHat size={18}/> Danh sách định mức</h4>
                        <span className="bg-white text-brand-600 px-2 py-0.5 rounded text-xs font-bold shadow-sm">{Object.keys(selectedItems).length} món</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {Object.entries(selectedItems).length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <Package size={48} className="mb-2 opacity-50"/>
                                <p className="text-sm font-medium">Chưa có vật tư nào</p>
                            </div>
                        ) : (
                            Object.entries(selectedItems).map(([id, qty]) => {
                                const item = services.find(s => s.id === id);
                                return (
                                    <div key={id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex-1">
                                            <div className="font-bold text-sm text-slate-800">{item?.name || id}</div>
                                            <div className="text-[10px] text-slate-500 uppercase">{item?.category}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateQty(id, -1)} className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-500 transition-colors"><Minus size={16}/></button>
                                            <span className="font-black text-lg w-6 text-center text-brand-600">{qty}</span>
                                            <button onClick={() => updateQty(id, 1)} className="p-1 hover:bg-white rounded text-slate-400 hover:text-green-500 transition-colors"><Plus size={16}/></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <button onClick={handleSave} className="w-full py-3 bg-brand-600 text-white rounded-xl font-black shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest">
                            <Save size={18}/> Lưu Định Mức
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
};
