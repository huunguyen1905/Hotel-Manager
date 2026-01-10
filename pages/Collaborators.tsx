
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Collaborator, ShiftSchedule, AttendanceAdjustment, LeaveRequest } from '../types';
import { CollaboratorModal } from '../components/CollaboratorModal';
import { 
  Pencil, Trash2, Plus, Search, ClipboardList,
  ChevronLeft, ChevronRight, Calendar, Edit2, FileDown, Wallet, DollarSign, Sun, Moon, 
  CheckCircle, AlertCircle, Send, User, Cake, HeartPulse, ShieldCheck, CalendarDays, Palmtree, UserCheck, Loader2, X, Check, Clock
} from 'lucide-react';
import { HRTabs, HRTabType } from '../components/HRTabs';
import { ListFilter, FilterOption } from '../components/ListFilter';
import { ShiftScheduleModal } from '../components/ShiftScheduleModal';
import { AttendanceAdjustmentModal } from '../components/AttendanceAdjustmentModal';
import { format, addDays, isSameDay, isWithinInterval, parseISO, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Modal } from '../components/Modal';

export const Collaborators: React.FC = () => {
  const { collaborators, deleteCollaborator, schedules, adjustments, notify, currentUser, leaveRequests, addLeaveRequest, updateLeaveRequest, triggerWebhook } = useAppContext();
  const [activeTab, setActiveTab] = useState<HRTabType>('overview'); // Default is Overview
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedMonthStr = format(currentDate, 'yyyy-MM');

  // NEW: Mobile specific state for Shift Agenda
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date());

  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Collaborator | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<Date>(new Date());
  const [activeSchedule, setActiveSchedule] = useState<ShiftSchedule | null>(null);

  const [isAdjModalOpen, setAdjModalOpen] = useState(false);
  const [selectedAdjStaff, setSelectedAdjStaff] = useState<Collaborator | null>(null);

  // Leave Request States
  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRequest>>({
      leave_type: 'Nghỉ phép năm',
      reason: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10)
  });
  
  // Loading state for approval actions
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);

    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Effect to sync mobile selection when week changes
  useEffect(() => {
      const start = weekDays[0];
      const end = weekDays[6];
      // If currently selected mobile date is out of view, reset to first day of week
      if (!isWithinInterval(mobileSelectedDate, { start, end })) {
          setMobileSelectedDate(start);
      }
  }, [weekDays, mobileSelectedDate]);

  const timesheetData = useMemo(() => {
     // Use native Date to get start and end of month
     const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
     const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
     end.setHours(23, 59, 59, 999);
     
     return collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => {
        const monthlySchedules = schedules.filter(s => 
           s.staff_id === staff.id && 
           isWithinInterval(new Date(s.date), { start, end })
        );

        let standardDays = 0;
        let nightShifts = 0;
        let dayShifts = 0;

        monthlySchedules.forEach(s => {
           if (s.shift_type === 'Sáng' || s.shift_type === 'Chiều' as any) {
               standardDays += 1;
               dayShifts += 1;
           } else if (s.shift_type === 'Tối') {
               standardDays += 1.2; // Ca tối tính hệ số 1.2
               nightShifts += 1;
           }
        });

        const adj = adjustments.find(a => a.staff_id === staff.id && a.month === selectedMonthStr);
        if (adj) {
            standardDays += Number(adj.standard_days_adj || 0);
        }

        const baseSalary = Number(staff.baseSalary) || 0;
        const dailyWage = baseSalary / 26; 
        const calculatedSalary = dailyWage * standardDays;

        return {
           staff,
           standardDays,
           dayShifts,
           nightShifts,
           calculatedSalary,
           adjustment: adj
        };
     });
  }, [collaborators, schedules, adjustments, currentDate, selectedMonthStr]);

  const roleOptions: FilterOption[] = useMemo(() => {
    const counts = collaborators.reduce((acc, c) => {
      acc[c.role] = (acc[c.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { label: 'Tất cả', value: 'All', count: collaborators.length },
      { label: 'Admin', value: 'Admin', count: counts['Admin'] || 0 },
      { label: 'Quản lý', value: 'Quản lý', count: counts['Quản lý'] || 0 },
      { label: 'Lễ tân', value: 'Nhân viên', count: counts['Nhân viên'] || 0 },
      { label: 'Buồng phòng', value: 'Buồng phòng', count: counts['Buồng phòng'] || 0 },
    ];
  }, [collaborators]);

  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      const nameMatch = (c.collaboratorName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'All' || c.role === roleFilter;
      return nameMatch && matchesRole;
    });
  }, [collaborators, searchTerm, roleFilter]);

  const overviewStats = useMemo(() => {
      const totalStaff = collaborators.length;
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      const onLeaveToday = leaveRequests.filter(lr => 
          lr.status === 'Approved' && 
          todayStr >= lr.start_date && 
          todayStr <= lr.end_date
      );

      const pendingLeaves = leaveRequests.filter(lr => lr.status === 'Pending');
      const totalSalaryEstimate = timesheetData.reduce((acc, curr) => acc + curr.calculatedSalary, 0);

      // Get shifts for today
      const todayShifts = schedules.filter(s => s.date === todayStr);
      const morningStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Sáng'));
      const nightStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Tối'));

      return { totalStaff, onLeaveToday, pendingLeaves, totalSalaryEstimate, morningStaff, nightStaff };
  }, [collaborators, leaveRequests, timesheetData, schedules]);

  const handleEdit = (c: Collaborator) => {
    setEditingCollab(c);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCollab(null);
    setModalOpen(true);
  };

  const openScheduleSlot = (staff: Collaborator, date: Date) => {
    const existing = schedules.find(s => s.staff_id === staff.id && s.date === format(date, 'yyyy-MM-dd'));
    setSelectedStaff(staff);
    setSelectedDateSlot(date);
    setActiveSchedule(existing || null);
    setScheduleModalOpen(true);
  };

  const openAdjustment = (staff: Collaborator) => {
      setSelectedAdjStaff(staff);
      setAdjModalOpen(true);
  };

  const submitLeaveRequest = async () => {
      if (!leaveForm.reason || !currentUser) {
          notify('error', 'Vui lòng nhập lý do nghỉ.');
          return;
      }
      
      const req: LeaveRequest = {
          id: `LR${Date.now()}`,
          staff_id: currentUser.id,
          staff_name: currentUser.collaboratorName,
          start_date: leaveForm.start_date!,
          end_date: leaveForm.end_date!,
          leave_type: leaveForm.leave_type as any,
          reason: leaveForm.reason,
          status: 'Pending',
          created_at: new Date().toISOString()
      };

      await addLeaveRequest(req);
      setLeaveModalOpen(false);
      setLeaveForm({ ...leaveForm, reason: '' }); // Reset partial
      notify('success', 'Đã gửi đơn xin nghỉ.');
      
      // Auto trigger webhook notification for new request
      triggerWebhook('leave_update', {
          event: 'new_request',
          staff: req.staff_name,
          type: req.leave_type,
          dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
          reason: req.reason,
          status: 'Chờ duyệt'
      });
  };

  const handleApproveLeave = async (req: LeaveRequest, isApproved: boolean) => {
      // One-click action: No blocking confirm dialog
      setProcessingLeaveId(req.id);
      try {
          const status = isApproved ? 'Approved' : 'Rejected';
          // Optimistic update: Context will update UI immediately
          await updateLeaveRequest({ ...req, status });
          
          if (isApproved) {
              notify('success', `Đã duyệt đơn của ${req.staff_name}.`);
          } else {
              notify('info', `Đã từ chối đơn của ${req.staff_name}.`);
          }

          // Trigger Webhook Notification to Zalo
          triggerWebhook('leave_update', {
              event: 'status_update',
              staff: req.staff_name,
              status: isApproved ? 'ĐÃ DUYỆT ✅' : 'ĐÃ TỪ CHỐI ❌',
              dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
              approver: currentUser?.collaboratorName || 'Admin'
          });
      } catch (err) {
          notify('error', 'Có lỗi khi cập nhật trạng thái.');
      } finally {
          setProcessingLeaveId(null);
      }
  };

  const getShiftColor = (type: string) => {
    switch(type) {
      case 'Sáng': return 'bg-amber-500 text-white shadow-amber-200';
      case 'Tối': return 'bg-indigo-700 text-white shadow-indigo-200';
      case 'OFF': return 'bg-slate-200 text-slate-500';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'Quản lý': return 'bg-violet-50 text-violet-600 border border-violet-100';
      case 'Buồng phòng': return 'bg-blue-50 text-blue-600 border border-blue-100';
      default: return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    }
  };

  return (
    <div className="space-y-6 animate-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Nhân Sự</h1>
          <p className="text-slate-500 text-sm mt-1">Hệ thống quản lý chấm công & nghỉ phép tập trung.</p>
        </div>
        {activeTab === 'employees' && (
            <button 
            onClick={handleAdd} 
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-all shadow-md font-bold active:scale-95"
            >
            <Plus size={20} /> <span className="inline">Thêm nhân viên</span>
            </button>
        )}
      </div>

      <HRTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* --- TAB 1: OVERVIEW DASHBOARD --- */}
      {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-blue-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><User size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><User size={20}/></div>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">Total</span>
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.totalStaff}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Tổng nhân sự</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-rose-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><HeartPulse size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><HeartPulse size={20}/></div>
                          {overviewStats.onLeaveToday.length > 0 && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.onLeaveToday.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Nghỉ hôm nay</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 cursor-pointer hover:border-amber-200 hover:shadow-md transition-all relative overflow-hidden group" onClick={() => setActiveTab('leave')}>
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><ShieldCheck size={20}/></div>
                          {overviewStats.pendingLeaves.length > 0 && (
                              <span className="text-xs font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md animate-bounce">
                                  {overviewStats.pendingLeaves.length}
                              </span>
                          )}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.pendingLeaves.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">Đơn chờ duyệt <ChevronRight size={12}/></div>
                      </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg flex flex-col justify-between h-32 text-white relative overflow-hidden">
                      <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><Wallet size={20}/></div>
                      </div>
                      <div className="relative z-10">
                          <div className="text-2xl font-black">{overviewStats.totalSalaryEstimate.toLocaleString()} ₫</div>
                          <div className="text-xs text-emerald-100 font-bold uppercase tracking-wider mt-1">Lương dự tính T{format(currentDate, 'MM')}</div>
                      </div>
                  </div>
              </div>

              {/* MAIN CONTENT GRID (3 COLUMNS) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* COL 1: SHIFT MONITOR (Operations) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={18} className="text-brand-600"/> Ca Trực Hôm Nay
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              {format(new Date(), 'EEEE, dd/MM', {locale: vi})}
                          </span>
                      </div>
                      
                      <div className="space-y-4 flex-1">
                          {/* Ca Sáng */}
                          <div className="relative">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Sun size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Sáng</div>
                                      <div className="text-[10px] text-slate-400 font-medium">06:00 - 18:00</div>
                                  </div>
                              </div>
                              <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100 space-y-2 min-h-[80px]">
                                  {overviewStats.morningStaff.length > 0 ? (
                                      overviewStats.morningStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>

                          {/* Ca Tối */}
                          <div className="relative pt-2">
                              <div className="absolute left-4 top-[-10px] bottom-full w-[2px] bg-slate-100 -z-10"></div>
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><Moon size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Tối</div>
                                      <div className="text-[10px] text-slate-400 font-medium">18:00 - 06:00</div>
                                  </div>
                              </div>
                              <div className="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100 space-y-2 min-h-[80px]">
                                  {overviewStats.nightStaff.length > 0 ? (
                                      overviewStats.nightStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* COL 2: LEAVE STATUS (Management) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <UserCheck size={18} className="text-brand-600"/> Nhân sự & Duyệt đơn
                          </h3>
                      </div>

                      <div className="flex-1 flex flex-col gap-4">
                          {/* Current Leaves */}
                          <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Đang nghỉ hôm nay</div>
                              {overviewStats.onLeaveToday.length === 0 ? (
                                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                      <div className="bg-white p-1.5 rounded-full text-emerald-500 shadow-sm"><CheckCircle size={16}/></div>
                                      <span className="text-xs font-bold text-emerald-700">Đầy đủ quân số!</span>
                                  </div>
                              ) : (
                                  <div className="space-y-2">
                                      {overviewStats.onLeaveToday.map(req => (
                                          <div key={req.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-rose-600 font-bold text-xs shadow-sm">
                                                      {req.staff_name.charAt(0)}
                                                  </div>
                                                  <div>
                                                      <div className="font-bold text-slate-800 text-xs">{req.staff_name}</div>
                                                      <div className="text-[10px] text-slate-500">{req.leave_type}</div>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>

                          {/* Pending Requests */}
                          <div className="flex-1 flex flex-col">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex justify-between items-center">
                                  <span>Cần duyệt ({overviewStats.pendingLeaves.length})</span>
                                  {overviewStats.pendingLeaves.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                              </div>
                              
                              <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100 overflow-y-auto max-h-[200px] custom-scrollbar">
                                  {overviewStats.pendingLeaves.length === 0 ? (
                                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-4">
                                          <ShieldCheck size={24} className="mb-1 opacity-50"/>
                                          <span className="text-[10px] font-medium">Không có đơn mới</span>
                                      </div>
                                  ) : (
                                      <div className="space-y-2">
                                          {overviewStats.pendingLeaves.map(req => (
                                              <div key={req.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:border-brand-200 transition-colors cursor-pointer group" onClick={() => setActiveTab('leave')}>
                                                  <div className="flex justify-between items-start">
                                                      <div className="font-bold text-slate-800 text-xs">{req.staff_name}</div>
                                                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-medium">{format(parseISO(req.start_date), 'dd/MM')}</span>
                                                  </div>
                                                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{req.leave_type}: {req.reason}</div>
                                                  <div className="mt-2 text-[10px] text-brand-600 font-bold group-hover:underline">Xem chi tiết &rarr;</div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  {/* COL 3: UTILITIES (Birthday & Quick Actions) */}
                  <div className="space-y-6 flex flex-col h-full">
                      {/* Birthdays */}
                      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden flex-1 min-h-[180px] flex flex-col justify-center">
                          <div className="absolute top-0 right-0 p-12 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                          <div className="bg-white/20 p-3 rounded-xl w-fit mb-4 backdrop-blur-sm shadow-inner border border-white/10">
                              <Cake size={24} />
                          </div>
                          <h3 className="font-bold text-lg mb-1">Sinh nhật tháng {format(currentDate, 'MM')}</h3>
                          <p className="text-purple-100 text-xs mb-4 leading-relaxed opacity-90 font-medium">
                              Đừng quên gửi lời chúc mừng đến các thành viên có sinh nhật!
                          </p>
                          
                          {/* Placeholder for Birthdays */}
                          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-md border border-white/10 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">?</div>
                              <span className="text-xs font-bold opacity-80">Không có sinh nhật nào sắp tới.</span>
                          </div>
                      </div>

                      {/* QUICK ACTIONS */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex-1">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lối tắt quản lý</h4>
                          <div className="space-y-3">
                              <button onClick={() => { setActiveTab('shifts'); }} className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 transition-all text-xs font-bold text-slate-700 flex items-center gap-3 border border-blue-100 hover:border-blue-200 group">
                                  <div className="p-1.5 rounded-lg bg-blue-200 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors"><CalendarDays size={16}/></div> 
                                  <span>Xem lịch phân ca</span>
                              </button>
                              <button onClick={() => { setActiveTab('timesheet'); }} className="w-full text-left px-4 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-all text-xs font-bold text-slate-700 flex items-center gap-3 border border-emerald-100 hover:border-emerald-200 group">
                                  <div className="p-1.5 rounded-lg bg-emerald-200 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><ClipboardList size={16}/></div> 
                                  <span>Bảng công & Lương</span>
                              </button>
                              <button onClick={() => { setLeaveModalOpen(true); }} className="w-full text-left px-4 py-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-all text-xs font-bold text-slate-700 flex items-center gap-3 border border-purple-100 hover:border-purple-200 group">
                                  <div className="p-1.5 rounded-lg bg-purple-200 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors"><Palmtree size={16}/></div> 
                                  <span>Tạo đơn nghỉ phép</span>
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB 2: EMPLOYEE LIST --- */}
      {activeTab === 'employees' && (
        <div className="animate-in fade-in">
          <ListFilter 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            options={roleOptions}
            selectedFilter={roleFilter}
            onFilterChange={setRoleFilter}
            placeholder="Tìm theo tên nhân viên..."
          />

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="p-lg text-slate-500 text-xs uppercase font-extrabold tracking-wider">Họ và tên</th>
                    <th className="p-lg text-slate-500 text-xs uppercase font-extrabold tracking-wider">Vai trò</th>
                    <th className="p-lg text-slate-500 text-xs uppercase font-extrabold tracking-wider">Lương cứng</th>
                    <th className="p-lg text-slate-500 text-xs uppercase font-extrabold tracking-wider text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredCollaborators.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-lg">
                        <div className="flex items-center gap-md">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-md" style={{ backgroundColor: c.color || '#3b82f6' }}>
                            {(c.collaboratorName || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{c.collaboratorName}</div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">@{c.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-lg">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${getRoleBadgeColor(c.role)}`}>
                          {c.role}
                        </span>
                      </td>
                      <td className="p-lg">
                        <div className="text-slate-700 font-black flex items-center gap-1">
                          {(Number(c.baseSalary) || 0).toLocaleString()} <span className="text-[9px] font-bold text-slate-400 uppercase">VND</span>
                        </div>
                      </td>
                      <td className="p-lg text-center">
                        <div className="flex items-center justify-center gap-sm">
                          <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa"><Pencil size={18} /></button>
                          <button onClick={() => { if(confirm('Xóa nhân viên?')) deleteCollaborator(c.id); }} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Xóa"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Profile Cards */}
          <div className="md:hidden space-y-3">
             {filteredCollaborators.map(c => (
                 <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-3">
                     <div className="flex items-start justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-black shadow-lg ring-2 ring-offset-2 ring-white" style={{ backgroundColor: c.color || '#3b82f6' }}>
                                {(c.collaboratorName || '?').charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg">{c.collaboratorName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getRoleBadgeColor(c.role)}`}>
                                        {c.role}
                                    </span>
                                    <span className="text-xs text-slate-400">@{c.username}</span>
                                </div>
                            </div>
                         </div>
                     </div>
                     
                     <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-500 uppercase">Lương cứng</span>
                         <span className="font-black text-slate-800 text-lg">{(Number(c.baseSalary) || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">đ</span></span>
                     </div>

                     <div className="grid grid-cols-2 gap-3 pt-1">
                         <button onClick={() => handleEdit(c)} className="py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2">
                             <Pencil size={16}/> Chỉnh sửa
                         </button>
                         <button onClick={() => { if(confirm('Xóa nhân viên?')) deleteCollaborator(c.id); }} className="py-3 bg-rose-50 text-rose-600 rounded-xl font-bold text-sm hover:bg-rose-100 flex items-center justify-center gap-2">
                             <Trash2 size={16}/> Xóa
                         </button>
                     </div>
                 </div>
             ))}
          </div>
        </div>
      )}

      {/* --- TAB 3: SHIFT SCHEDULE --- */}
      {activeTab === 'shifts' && (
        <div className="animate-in fade-in space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-4">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Calendar size={24} /></div>
                <div>
                   <h2 className="text-lg font-bold text-slate-800">Lịch phân ca tuần</h2>
                   <p className="text-xs text-slate-500 font-medium tracking-tight">Hệ thống 2 ca chuẩn (Sáng - Tối).</p>
                </div>
             </div>

             {/* Week Navigation (Desktop) */}
             <div className="hidden md:flex items-center gap-3">
                 <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 hover:bg-white text-slate-500 border-r border-slate-200 transition-colors"><ChevronLeft size={18}/></button>
                    <span className="px-4 py-2 text-sm font-bold text-slate-700 min-w-[180px] text-center">
                        {format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM')}
                    </span>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 hover:bg-white text-slate-500 border-l border-slate-200 transition-colors"><ChevronRight size={18}/></button>
                 </div>
             </div>
          </div>

          {/* DESKTOP WEEKLY TABLE */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
                  <tr>
                    <th className="p-4 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 w-52 font-black text-[10px] text-slate-400 uppercase tracking-widest">Nhân viên / Ngày</th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className={`p-4 text-center border-r border-slate-100 ${isSameDay(day, new Date()) ? 'bg-brand-50/50' : ''}`}>
                         <div className={`text-xs font-black uppercase tracking-wider ${isSameDay(day, new Date()) ? 'text-brand-600' : 'text-slate-400'}`}>
                           {format(day, 'EEEE', { locale: vi })}
                         </div>
                         <div className={`text-lg font-black mt-1 ${isSameDay(day, new Date()) ? 'text-brand-700' : 'text-slate-700'}`}>
                           {format(day, 'dd/MM')}
                         </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => (
                    <tr key={staff.id} className="group">
                      <td className="p-4 sticky left-0 z-10 bg-white border-r border-slate-200 group-hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-inner" style={{ backgroundColor: staff.color || '#3b82f6' }}>
                            {(staff.collaboratorName || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{staff.collaboratorName}</div>
                            <div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{staff.role}</div>
                          </div>
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const schedule = schedules.find(s => s.staff_id === staff.id && s.date === dateStr);

                        return (
                          <td 
                            key={day.toISOString()} 
                            className={`p-2 border-r border-slate-100 text-center relative group/cell hover:bg-brand-50/30 transition-all cursor-pointer min-h-[80px]`}
                            onClick={() => openScheduleSlot(staff, day)}
                          >
                            {schedule ? (
                              <div className={`
                                mx-auto w-full max-w-[90px] p-2.5 rounded-xl text-[10px] font-black shadow-sm flex flex-col items-center gap-1 animate-in zoom-in-95 duration-200
                                ${getShiftColor(schedule.shift_type)}
                              `}>
                                <span>{schedule.shift_type}</span>
                              </div>
                            ) : (
                              <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-2 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 text-slate-300 flex items-center justify-center hover:border-brand-400 hover:text-brand-500">
                                   <Plus size={16} />
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest overflow-x-auto">
               <span className="flex items-center gap-1.5 whitespace-nowrap"><Sun size={14} className="text-amber-500"/> Ca Sáng (Ngày)</span>
               <span className="flex items-center gap-1.5 whitespace-nowrap"><Moon size={14} className="text-indigo-700"/> Ca Tối (Đêm)</span>
               <span className="flex items-center gap-1.5 whitespace-nowrap"><div className="w-3 h-3 rounded-full bg-slate-200"></div> Ngày Nghỉ (OFF)</span>
            </div>
          </div>

          {/* MOBILE AGENDA VIEW */}
          <div className="md:hidden space-y-4">
              {/* Horizontal Date Picker */}
              <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar px-1">
                  {weekDays.map(day => {
                      const isSelected = isSameDay(day, mobileSelectedDate);
                      const isToday = isSameDay(day, new Date());
                      return (
                          <button
                              key={day.toISOString()}
                              onClick={() => setMobileSelectedDate(day)}
                              className={`
                                  flex flex-col items-center justify-center p-3 rounded-xl min-w-[70px] border-2 transition-all
                                  ${isSelected 
                                      ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-200 scale-105' 
                                      : 'bg-white border-slate-100 text-slate-500'}
                              `}
                          >
                              <span className="text-[10px] font-bold uppercase">{format(day, 'EEE', {locale: vi})}</span>
                              <span className="text-lg font-black">{format(day, 'dd')}</span>
                              {isToday && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-brand-500'}`}></div>}
                          </button>
                      )
                  })}
              </div>

              {/* Agenda Body */}
              <div className="space-y-4">
                  {/* CA SÁNG */}
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100">
                      <div className="flex items-center gap-2 mb-3 text-amber-800 font-black uppercase text-xs tracking-widest">
                          <Sun size={16}/> Ca Sáng (Ngày)
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                          {collaborators.filter(c => {
                              const s = schedules.find(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'));
                              return s?.shift_type === 'Sáng' || s?.shift_type === 'Chiều'; // Handle legacy 'Chiều'
                          }).map(c => (
                              <div key={c.id} onClick={() => openScheduleSlot(c, mobileSelectedDate)} className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: c.color }}>{c.collaboratorName.charAt(0)}</div>
                                  <div>
                                      <div className="font-bold text-slate-800">{c.collaboratorName}</div>
                                      <div className="text-xs text-slate-400 font-bold uppercase">{c.role}</div>
                                  </div>
                              </div>
                          ))}
                          {/* Add Button Logic? No, list remaining staff in separate block */}
                      </div>
                  </div>

                  {/* CA TỐI */}
                  <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-3 text-indigo-800 font-black uppercase text-xs tracking-widest">
                          <Moon size={16}/> Ca Tối (Đêm)
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                          {collaborators.filter(c => {
                              const s = schedules.find(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'));
                              return s?.shift_type === 'Tối';
                          }).map(c => (
                              <div key={c.id} onClick={() => openScheduleSlot(c, mobileSelectedDate)} className="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: c.color }}>{c.collaboratorName.charAt(0)}</div>
                                  <div>
                                      <div className="font-bold text-slate-800">{c.collaboratorName}</div>
                                      <div className="text-xs text-slate-400 font-bold uppercase">{c.role}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* CHƯA PHÂN CA / OFF */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 text-slate-500 font-black uppercase text-xs tracking-widest">
                          Chưa phân ca / Nghỉ
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          {collaborators.filter(c => {
                              const s = schedules.find(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'));
                              return !s || s.shift_type === 'OFF';
                          }).map(c => (
                              <div key={c.id} onClick={() => openScheduleSlot(c, mobileSelectedDate)} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: c.color }}>{c.collaboratorName.charAt(0)}</div>
                                  <div className="truncate text-xs font-bold text-slate-600">{c.collaboratorName}</div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: LEAVE MANAGEMENT --- */}
      {activeTab === 'leave' && (
          <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div>
                      <h2 className="text-lg font-bold text-slate-800">Quản lý nghỉ phép</h2>
                      <p className="text-xs text-slate-500">Gửi đơn & Duyệt tự động báo Zalo</p>
                  </div>
                  <button onClick={() => setLeaveModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-brand-700 shadow-lg">
                      <Send size={16} /> Gửi yêu cầu
                  </button>
              </div>

              {/* SECTION: APPROVAL (ADMIN ONLY) */}
              {(currentUser?.role === 'Admin' || currentUser?.role === 'Quản lý') && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                          <h3 className="font-bold text-orange-800 text-sm flex items-center gap-2"><AlertCircle size={18}/> Danh sách chờ duyệt</h3>
                          <span className="bg-white text-orange-600 px-2 py-0.5 rounded text-xs font-black">{overviewStats.pendingLeaves.length}</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                          {overviewStats.pendingLeaves.length === 0 ? (
                              <div className="p-8 text-center text-slate-400 text-sm italic">Không có đơn nào cần duyệt.</div>
                          ) : (
                              overviewStats.pendingLeaves.map(req => (
                                  <div key={req.id} className="p-4 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                      <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="font-bold text-slate-800">{req.staff_name}</span>
                                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase font-black text-slate-500">{req.leave_type}</span>
                                          </div>
                                          <div className="text-sm text-slate-600 mb-1">
                                              {format(parseISO(req.start_date), 'dd/MM/yyyy')} - {format(parseISO(req.end_date), 'dd/MM/yyyy')}
                                          </div>
                                          <div className="text-xs text-slate-500 italic">" {req.reason} "</div>
                                      </div>
                                      
                                      {/* ACTION BUTTONS: Redesigned */}
                                      <div className="flex items-center gap-3">
                                          <button 
                                            onClick={() => handleApproveLeave(req, false)} 
                                            disabled={processingLeaveId === req.id}
                                            className="group relative flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90 disabled:opacity-50"
                                            title="Từ chối"
                                          >
                                              {processingLeaveId === req.id ? <Loader2 size={14} className="animate-spin"/> : <X size={16} strokeWidth={3}/>}
                                          </button>
                                          
                                          <button 
                                            onClick={() => handleApproveLeave(req, true)} 
                                            disabled={processingLeaveId === req.id}
                                            className="group relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 transition-all active:scale-90 disabled:opacity-50 disabled:shadow-none"
                                            title="Duyệt ngay"
                                          >
                                              {processingLeaveId === req.id ? <Loader2 size={14} className="animate-spin"/> : <Check size={16} strokeWidth={4}/>}
                                          </button>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              )}

              {/* SECTION: HISTORY (EVERYONE) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-bold text-slate-700 text-sm">Lịch sử nghỉ phép</h3>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                      {leaveRequests
                        .filter(r => currentUser?.role === 'Admin' || currentUser?.role === 'Quản lý' || r.staff_id === currentUser?.id)
                        .map(req => (
                          <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-700 text-sm">{req.staff_name}</span>
                                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-black border
                                          ${req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            req.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                            'bg-amber-50 text-amber-600 border-amber-100'}
                                      `}>
                                          {req.status === 'Approved' ? 'Đã duyệt' : req.status === 'Rejected' ? 'Từ chối' : 'Chờ duyệt'}
                                      </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                      {format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')} ({req.leave_type})
                                  </div>
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                  {format(parseISO(req.created_at), 'dd/MM HH:mm')}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB 5: TIMESHEET --- */}
      {activeTab === 'timesheet' && (
        <div className="animate-in fade-in space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-soft gap-4">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><ClipboardList size={28} /></div>
                <div>
                   <h2 className="text-xl font-black text-slate-800 tracking-tight">Công & Dự Tính Lương</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hệ số chuẩn: Sáng (1.0) | Tối (1.2)</p>
                </div>
             </div>

             <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                 <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 shadow-inner">
                    <button onClick={() => setCurrentDate(addDays(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1), 0))} className="p-1 hover:text-brand-600 text-slate-400 transition-colors"><ChevronLeft size={18}/></button>
                    <span className="px-4 py-1 text-sm font-black text-slate-700 min-w-[120px] text-center uppercase tracking-widest">
                        {format(currentDate, 'MMMM yyyy', { locale: vi })}
                    </span>
                    <button onClick={() => setCurrentDate(addDays(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1), 0))} className="p-1 hover:text-brand-600 text-slate-400 transition-colors"><ChevronRight size={18}/></button>
                 </div>
                 <button className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-brand-700 active:scale-95 transition-all">
                    <FileDown size={18}/> <span className="hidden sm:inline">Xuất Excel</span>
                 </button>
             </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Họ tên nhân viên</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Lượt ca Sáng</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Lượt ca Tối</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Tổng công thực tế</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-right">Lương tạm tính</th>
                    <th className="p-4 font-black text-[10px] text-slate-400 uppercase tracking-widest text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {timesheetData.map(row => (
                    <tr key={row.staff.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: row.staff.color || '#3b82f6' }}>
                            {(row.staff.collaboratorName || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{row.staff.collaboratorName}</div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase">{row.staff.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                         <div className="text-base font-black text-slate-700">{row.dayShifts}</div>
                      </td>
                      <td className="p-4 text-center">
                         <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black border border-indigo-100 uppercase">
                             {row.nightShifts} buổi
                         </span>
                      </td>
                      <td className="p-4 text-center">
                         <div className="text-lg font-black text-brand-700 underline decoration-brand-200 underline-offset-4">{row.standardDays.toFixed(1)}</div>
                         <div className="text-[9px] text-slate-400 font-bold uppercase">Công quy đổi</div>
                      </td>
                      <td className="p-4 text-right">
                         <div className="text-base font-black text-slate-900 flex items-center justify-end gap-1">
                            <DollarSign size={14} className="text-emerald-500"/>
                            {row.calculatedSalary.toLocaleString(undefined, {maximumFractionDigits: 0})} ₫
                         </div>
                      </td>
                      <td className="p-4 text-center">
                         <button onClick={() => openAdjustment(row.staff)} className="p-2 text-slate-400 hover:text-brand-600 transition-all"><Edit2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Salary Summary Cards */}
          <div className="md:hidden space-y-3">
             {timesheetData.map(row => (
                 <div key={row.staff.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-md" style={{ backgroundColor: row.staff.color || '#3b82f6' }}>
                                {(row.staff.collaboratorName || '?').charAt(0)}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-sm">{row.staff.collaboratorName}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase">{row.staff.role}</div>
                            </div>
                         </div>
                         <button onClick={() => openAdjustment(row.staff)} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
                             Điều chỉnh
                         </button>
                     </div>
                     
                     <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                         <div className="flex justify-between items-end mb-2">
                             <span className="text-xs font-bold text-slate-500 uppercase">Tổng công</span>
                             <span className="text-xl font-black text-slate-800">{row.standardDays.toFixed(1)} <span className="text-xs font-medium text-slate-400">ngày</span></span>
                         </div>
                         {/* Progress Bar Visual */}
                         <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                             <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${Math.min(100, (row.standardDays / 26) * 100)}%` }}></div>
                         </div>
                         <div className="flex justify-between text-[9px] text-slate-400 mt-1 uppercase font-bold">
                             <span>0</span>
                             <span>26 (Chuẩn)</span>
                         </div>
                     </div>

                     <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                         <span className="text-xs font-bold text-slate-400 uppercase">Lương tạm tính</span>
                         <span className="font-black text-lg text-emerald-600">{row.calculatedSalary.toLocaleString()} ₫</span>
                     </div>
                 </div>
             ))}
          </div>

        </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Leave Request Form Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Gửi đơn xin nghỉ phép" size="sm">
          <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-100">
                  <span className="font-bold">Lưu ý:</span> Đơn sẽ được gửi cho Quản lý và tự động báo Zalo sau khi duyệt.
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Từ ngày</label>
                      <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Đến ngày</label>
                      <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
                  </div>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Loại nghỉ</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value as any})}>
                      <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                      <option value="Nghỉ ốm">Nghỉ ốm</option>
                      <option value="Việc riêng">Việc riêng (Có lương/Trừ phép)</option>
                      <option value="Không lương">Không lương</option>
                      <option value="Chế độ">Chế độ (Hiếu/Hỉ/Thai sản)</option>
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lý do</label>
                  <textarea className="w-full border rounded-lg p-2.5 text-sm h-24" placeholder="Nhập lý do cụ thể..." value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}></textarea>
              </div>
              <div className="flex gap-2 pt-2">
                  <button onClick={() => setLeaveModalOpen(false)} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Hủy</button>
                  <button onClick={submitLeaveRequest} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-700 shadow-lg">Gửi Đơn</button>
              </div>
          </div>
      </Modal>

      <CollaboratorModal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        collaborator={editingCollab} 
      />

      {selectedStaff && (
        <ShiftScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          staff={selectedStaff}
          date={selectedDateSlot}
          existingSchedule={activeSchedule}
        />
      )}

      {selectedAdjStaff && (
          <AttendanceAdjustmentModal
            isOpen={isAdjModalOpen}
            onClose={() => setAdjModalOpen(false)}
            staff={selectedAdjStaff}
            month={selectedMonthStr}
            adjustment={adjustments.find(a => a.staff_id === selectedAdjStaff.id && a.month === selectedMonthStr)}
          />
      )}
    </div>
  );
};
