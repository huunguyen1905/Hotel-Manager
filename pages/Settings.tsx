import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Save, Loader2, Key } from 'lucide-react';

export const Settings: React.FC = () => {
  const { getGeminiApiKey, setAppConfig, notify } = useAppContext();
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
      const loadKey = async () => {
          const key = await getGeminiApiKey();
          if (key) setGeminiKey(key);
      };
      loadKey();
  }, [getGeminiApiKey]);

  const handleSaveGeminiKey = async () => {
      if (!geminiKey.trim()) {
          notify('error', 'Vui lòng nhập API Key');
          return;
      }

      setIsSavingKey(true);
      try {
          const { error } = await setAppConfig({
              key: 'GEMINI_API_KEY',
              value: geminiKey.trim(),
              description: 'API Key Google Gemini cho tính năng OCR và Chat AI'
          });

          if (error) {
              console.error(error);
              notify('error', 'Lỗi lưu database: ' + (error.message || 'Check console'));
          } else {
              notify('success', 'Đã lưu API Key thành công!');
          }
      } catch (e) {
          notify('error', 'Lỗi kết nối khi lưu API Key');
      } finally {
          setIsSavingKey(false);
      }
  };

  return (
    <div className="space-y-6 animate-enter">
      <h1 className="text-2xl font-bold text-slate-800">Cài đặt Hệ thống</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Key size={24}/></div>
              <div>
                  <h3 className="text-lg font-bold text-slate-800">Cấu hình AI (Gemini)</h3>
                  <p className="text-sm text-slate-500">Dùng cho tính năng OCR CCCD & Chatbot.</p>
              </div>
          </div>
          
          <div className="space-y-4">
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Google Gemini API Key</label>
                  <input 
                      type="password" 
                      className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="sk-..."
                      value={geminiKey}
                      onChange={e => setGeminiKey(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 mt-1">Lấy key tại: <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Google AI Studio</a></p>
              </div>
              
              <button 
                  onClick={handleSaveGeminiKey} 
                  disabled={isSavingKey}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
              >
                  {isSavingKey ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Lưu Cấu Hình
              </button>
          </div>
      </div>
    </div>
  );
};