import React from 'react';

interface CategoryFiltersProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryFilters({ selectedCategory, onSelectCategory }: CategoryFiltersProps) {
  const categories = [
    'All',
    'Live',
    'Programming',
    'Gaming',
    'Music',
    'Photography',
    'Cooking',
    'Education',
    'Sports',
    'News',
    'Recently uploaded',
  ];

  return (
    <div className="sticky top-14 bg-white/95 backdrop-blur-sm z-40 py-2.5 px-4 border-b border-slate-200">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {categories.map((category) => {
          const isActive = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
