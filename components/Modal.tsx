
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;

  // Lấy target là container nội dung được định nghĩa trong App.tsx
  const target = document.getElementById('main-layout-container') || document.body;

  // Mapping kích thước modal - Desktop only
  const sizeClasses = {
    sm: 'md:max-w-[400px]',
    md: 'md:max-w-[600px]',
    lg: 'md:max-w-[850px]', // Rộng hơn cho trang đặt phòng
    xl: 'md:max-w-[1100px]'
  };

  const modalContent = (
    <div className="absolute inset-0 z-[60] flex items-end md:items-center justify-center md:p-8">
      {/* Backdrop - Chỉ phủ lên vùng nội dung */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal Container 
          Mobile: w-full h-full (full screen) or rounded-t-2xl (bottom sheet)
          Desktop: rounded-2xl, height auto (max-h)
      */}
      <div className={`
        relative bg-white w-full h-full md:h-auto md:rounded-2xl shadow-2xl flex flex-col md:max-h-[95%]
        ${sizeClasses[size]}
        transform transition-all duration-300 animate-in slide-in-from-bottom-10 md:zoom-in-95
        border border-slate-200 z-[70] overflow-hidden
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body - Cuộn nội dung */}
        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 md:px-6 py-4 border-t border-slate-100 bg-slate-50/50 md:rounded-b-2xl flex flex-col-reverse md:flex-row justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, target);
};
