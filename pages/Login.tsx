
import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { MOCK_COLLABORATORS } from '../constants';
import { storageService } from '../services/storage';

export const Login: React.FC = () => {
  const { setCurrentUser, refreshData, notify, isLoading } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    try {
        await refreshData();
        const freshUsers = await storageService.getCollaborators();
        const inputUser = username.trim().toLowerCase();
        const inputPass = password.trim();

        let user = freshUsers.find(c => 
          (c.username || '').toLowerCase() === inputUser && c.password === inputPass
        );
        
        // Fallback Admin
        if (!user && freshUsers.length === 0) {
          const defaultAdmin = MOCK_COLLABORATORS.find(c => c.username === 'admin');
          if (defaultAdmin && defaultAdmin.username === inputUser && defaultAdmin.password === inputPass) {
            user = defaultAdmin;
          }
        }
        
        if (user) {
          setCurrentUser(user);
          // Explicitly save user based on Remember Me checkbox
          storageService.saveUser(user, rememberMe);
          
          if (user.role === 'Buồng phòng') {
             navigate('/staff-portal');
          } else {
             navigate('/dashboard');
          }
        } else {
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        }
    } catch (e) {
        console.error(e);
        setError('Lỗi kết nối hoặc dữ liệu.');
    } finally {
        setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/50 relative z-10 animate-enter">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-brand-500 to-brand-400 p-4 rounded-2xl shadow-lg shadow-brand-200 text-white transform rotate-3 hover:rotate-0 transition-all duration-300">
            <Lock size={32} />
          </div>
        </div>
        
        <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Welcome Back!</h2>
            <p className="text-slate-500 text-sm font-medium">Đăng nhập để truy cập hệ thống quản lý</p>
        </div>
        
        {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl mb-6 text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                {error}
            </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tài khoản</label>
            <input 
              type="text" 
              required
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              disabled={isLoggingIn}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Mật khẩu</label>
            <input 
              type="password" 
              required
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoggingIn}
            />
          </div>

          <div className="flex items-center gap-2 py-1">
             <input 
               type="checkbox" 
               id="remember"
               checked={rememberMe}
               onChange={e => setRememberMe(e.target.checked)}
               className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
             />
             <label htmlFor="remember" className="text-sm text-slate-600 font-medium cursor-pointer select-none">Ghi nhớ đăng nhập</label>
          </div>

          <button 
            type="submit" 
            disabled={isLoggingIn || isLoading}
            className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition-all active:scale-[0.98] disabled:bg-brand-400 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-xl shadow-brand-200 text-sm uppercase tracking-widest mt-2"
          >
            {isLoggingIn ? <><Loader2 className="animate-spin" size={18}/> Đang xử lý...</> : 'Đăng Nhập Hệ Thống'}
          </button>
        </form>
      </div>
      
      <div className="absolute bottom-6 text-center w-full text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
          Hotel Manager Pro © 2024
      </div>
    </div>
  );
};
