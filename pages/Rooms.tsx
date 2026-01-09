
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Trash2, Pencil, Home, DollarSign, Settings2, Box, Maximize2, Mountain } from 'lucide-react';
import { Facility, Room } from '../types';
import { FacilityModal } from '../components/FacilityModal';
import { RoomModal } from '../components/RoomModal';

export const Rooms: React.FC = () => {
  const { facilities, rooms, updateFacility, deleteFacility, notify, upsertRoom, deleteRoom } = useAppContext();
  
  // Facility Modal State
  const [isFacilityModalOpen, setFacilityModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);

  // Room Modal State
  const [isRoomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  // Local state for adding rooms inline
  const [newRoomCodes, setNewRoomCodes] = useState<Record<string, string>>({});
  const [newRoomPrices, setNewRoomPrices] = useState<Record<string, string>>({});

  const handleEditFacility = (f: Facility) => {
    setEditingFacility(f);
    setFacilityModalOpen(true);
  };

  const handleAddFacility = () => {
    setEditingFacility(null);
    setFacilityModalOpen(true);
  };

  // --- ROOM LOGIC (SQL RELATIONAL) ---

  const addRoomToFacility = (f: Facility) => {
     const code = newRoomCodes[f.id]?.trim();
     const priceStr = newRoomPrices[f.id]?.trim();
     
     if(!code) return;
     
     const price = priceStr ? Number(priceStr) : f.facilityPrice;

     // Check duplicate in 'rooms' table state
     const exists = rooms.some(r => r.facility_id === f.id && r.name === code);
     if (exists) {
        notify('error', `Phòng ${code} đã tồn tại trong cơ sở này`);
        return;
     }

     // Upsert directly to DB via Context
     upsertRoom({
         id: `${f.id}_${code}`,
         facility_id: f.id,
         facility_name: f.facilityName, 
         name: code,
         status: 'Đã dọn',
         price: price,
         note: '',
         type: 'Standard',
         view: 'Không',
         area: 20
     });

     notify('success', `Đã thêm phòng ${code}`);
     setNewRoomCodes(prev => ({ ...prev, [f.id]: '' }));
  };

  const removeRoom = (id: string, name: string) => {
     if(!confirm(`Xóa phòng ${name}?`)) return;
     deleteRoom(id);
     notify('info', `Đã xóa phòng ${name}`);
  };

  const openEditRoom = (r: Room) => {
      setEditingRoom(r);
      setRoomModalOpen(true);
  };

  const handleSaveRoom = (updatedRoom: Room) => {
      // Check duplicate name if name changed
      if (editingRoom && editingRoom.name !== updatedRoom.name) {
          const exists = rooms.some(r => r.facility_id === updatedRoom.facility_id && r.name === updatedRoom.name && r.id !== updatedRoom.id);
          if(exists) {
              notify('error', `Mã phòng ${updatedRoom.name} đã tồn tại!`);
              return;
          }
      }
      
      const newId = `${updatedRoom.facility_id}_${updatedRoom.name}`;
      
      if (editingRoom && editingRoom.id !== newId) {
          deleteRoom(editingRoom.id); // Remove old record
      }
      
      upsertRoom({
          ...updatedRoom,
          id: newId
      });

      notify('success', 'Đã cập nhật phòng');
  };

  const toggleStatus = (room: Room) => {
    const current = room.status;
    const next = current === 'Đã dọn' ? 'Bẩn' : current === 'Bẩn' ? 'Đang dọn' : 'Đã dọn';
    
    upsertRoom({
        ...room,
        status: next
    });
  };

  const getRoomTypeBadgeColor = (type?: string) => {
      switch(type) {
          case 'Suite': return 'bg-purple-100 text-purple-700 border-purple-200';
          case 'Deluxe': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Superior': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'Dorm': return 'bg-slate-100 text-slate-600 border-slate-200';
          default: return 'bg-gray-50 text-gray-600 border-gray-200';
      }
  };

  return (
    <div className="space-y-6 animate-enter">
       <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý Phòng & Cơ sở</h1>
            <p className="text-sm text-gray-500">Phân hạng phòng, view và diện tích chi tiết.</p>
          </div>
          <button onClick={handleAddFacility} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-colors shadow-sm font-medium">
            <Plus size={20} /> <span className="hidden md:inline">Thêm cơ sở</span>
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {facilities.map(f => {
            // FILTER ROOMS FROM RELATIONAL STATE
            const facilityRooms = rooms
                .filter(r => r.facility_id === f.id)
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            return (
              <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                 {/* Header Facility */}
                 <div className="bg-brand-50 p-4 border-b flex justify-between items-start group">
                    <div>
                       <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                          <Home size={18} className="text-brand-600"/> {f.facilityName}
                       </h3>
                       <p className="text-xs text-gray-500 mt-1 line-clamp-1">{f.note || 'Không có mô tả'}</p>
                       <p className="text-xs font-semibold text-brand-600 mt-1 flex items-center gap-1">
                          <DollarSign size={12}/> Giá chuẩn: {f.facilityPrice.toLocaleString()} ₫
                       </p>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleEditFacility(f)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Sửa thông tin cơ sở">
                         <Settings2 size={16} />
                       </button>
                       <button onClick={() => { if(confirm(`Xóa cơ sở "${f.facilityName}" và toàn bộ phòng bên trong?`)) deleteFacility(f.id); }} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors" title="Xóa cơ sở (Đóng cửa)">
                         <Trash2 size={16} />
                       </button>
                    </div>
                 </div>
                 
                 {/* Room List */}
                 <div className="p-4 flex-1">
                    {facilityRooms.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm italic">
                            Chưa có phòng nào.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                        {facilityRooms.map((r) => (
                            <div key={r.id} className="relative group/room h-full">
                                <div 
                                onClick={() => toggleStatus(r)}
                                className={`
                                flex flex-col p-3 rounded-xl border-2 cursor-pointer select-none transition-all shadow-sm h-full justify-between
                                ${r.status === 'Đã dọn' ? 'bg-white border-green-500/50 hover:border-green-500' :
                                    r.status === 'Bẩn' ? 'bg-gray-50 border-gray-300 hover:border-gray-400' : 
                                    r.status === 'Sửa chữa' ? 'bg-red-50 border-red-300 hover:border-red-500' :
                                    'bg-white border-yellow-400 hover:border-yellow-500'}
                                `}>
                                    {/* HEADER: Name + Badge */}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-xl font-black ${r.status === 'Đã dọn' ? 'text-green-700' : 'text-slate-700'}`}>{r.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black border uppercase ${getRoomTypeBadgeColor(r.type)}`}>
                                            {r.type || 'Standard'}
                                        </span>
                                    </div>
                                    
                                    {/* DETAILS: View + Area */}
                                    <div className="flex flex-col gap-0.5 mb-2">
                                        {r.view && r.view !== 'Không' && (
                                            <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                                                <Mountain size={10}/> {r.view}
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <Maximize2 size={10}/> {r.area || 20}m²
                                        </span>
                                    </div>

                                    {/* FOOTER: Price + Mobile Actions */}
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-xs font-bold text-slate-700">
                                            {(r.price || f.facilityPrice) / 1000}k
                                        </span>

                                        {/* MOBILE ACTIONS (In-flow, Bottom Right) */}
                                        <div className="flex gap-2 lg:hidden">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); openEditRoom(r); }}
                                                className="bg-blue-50 text-blue-600 rounded-lg p-2 shadow-sm hover:bg-blue-100 transition-colors"
                                                title="Cấu hình"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeRoom(r.id, r.name); }}
                                                className="bg-red-50 text-red-500 rounded-lg p-2 shadow-sm hover:bg-red-100 transition-colors"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* DESKTOP ACTIONS (Absolute, Hover Only) */}
                                <div className="hidden lg:flex absolute top-2 right-2 gap-1 opacity-0 group-hover/room:opacity-100 transition-all z-10 scale-90 lg:scale-100">
                                    <button 
                                    onClick={(e) => { e.stopPropagation(); openEditRoom(r); }}
                                    className="bg-blue-500 text-white rounded-lg w-7 h-7 flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                                    title="Cấu hình chi tiết"
                                    >
                                    <Pencil size={12} />
                                    </button>
                                    <button 
                                    onClick={(e) => { e.stopPropagation(); removeRoom(r.id, r.name); }}
                                    className="bg-white border border-red-200 text-red-500 rounded-lg w-7 h-7 flex items-center justify-center shadow-md hover:bg-red-50 transition-colors"
                                    title="Xóa phòng"
                                    >
                                    <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                 </div>

                 {/* Inline Add Room Form */}
                 <div className="p-3 bg-gray-50 border-t mt-auto">
                    <div className="flex flex-col md:flex-row gap-2">
                       <input 
                         type="text" 
                         className="flex-1 border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900" 
                         placeholder="Mã P..."
                         value={newRoomCodes[f.id] || ''}
                         onChange={(e) => setNewRoomCodes(prev => ({ ...prev, [f.id]: e.target.value }))}
                         onKeyDown={(e) => e.key === 'Enter' && addRoomToFacility(f)}
                       />
                       <div className="flex gap-2">
                           <input 
                             type="number" 
                             className="w-full md:w-24 border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900" 
                             placeholder="Giá..."
                             title="Để trống sẽ lấy giá chuẩn"
                             value={newRoomPrices[f.id] || ''}
                             onChange={(e) => setNewRoomPrices(prev => ({ ...prev, [f.id]: e.target.value }))}
                             onKeyDown={(e) => e.key === 'Enter' && addRoomToFacility(f)}
                           />
                           <button 
                             onClick={() => addRoomToFacility(f)}
                             className="bg-brand-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-brand-700 whitespace-nowrap"
                           >
                             Thêm
                           </button>
                       </div>
                    </div>
                 </div>
              </div>
            )
          })}
          
          {/* Add Facility Card Placeholder */}
          <button onClick={handleAddFacility} className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-brand-500 hover:text-brand-500 hover:bg-brand-50 transition-all min-h-[200px] group">
             <div className="bg-gray-100 p-4 rounded-full group-hover:bg-brand-100 transition-colors mb-3">
                 <Plus size={32} className="opacity-50 group-hover:opacity-100" />
             </div>
             <span className="font-medium">Thêm cơ sở mới</span>
          </button>
       </div>

       {/* MODALS */}
       <FacilityModal 
          isOpen={isFacilityModalOpen} 
          onClose={() => setFacilityModalOpen(false)} 
          facility={editingFacility} 
       />
       
       <RoomModal 
          isOpen={isRoomModalOpen}
          onClose={() => setRoomModalOpen(false)}
          roomData={editingRoom}
          onSave={handleSaveRoom}
       />
    </div>
  );
};
