
import React from 'react';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface ListFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  options: FilterOption[];
  selectedFilter: string;
  onFilterChange: (value: string) => void;
  placeholder?: string;
  secondaryOptions?: FilterOption[];
  selectedSecondaryFilter?: string;
  onSecondaryFilterChange?: (value: string) => void;
}

export const ListFilter: React.FC<ListFilterProps> = ({
  searchTerm,
  onSearchChange,
  options,
  selectedFilter,
  onFilterChange,
  placeholder = "Tìm kiếm theo tên, mã...",
  secondaryOptions,
  selectedSecondaryFilter,
  onSecondaryFilterChange
}) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Row 1: Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-white shadow-sm"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <button 
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Row 2: Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => {
          const isActive = selectedFilter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`
                px-4 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm
                ${isActive 
                  ? 'bg-brand-500 text-white border-brand-500' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
              `}
            >
              {option.label}
              {option.count !== undefined && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Vertical Divider if secondary options exist */}
        {secondaryOptions && secondaryOptions.length > 0 && (
          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
        )}

        {/* Secondary Filter Group (e.g., Stock Status) */}
        {secondaryOptions?.map((option) => {
          const isActive = selectedSecondaryFilter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onSecondaryFilterChange?.(option.value)}
              className={`
                px-4 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm
                ${isActive 
                  ? 'bg-brand-500 text-white border-brand-500' 
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
