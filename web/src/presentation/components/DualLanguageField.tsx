import React, { useState } from 'react';
import { MultiLanguageText } from '../../types/form';

interface DualLanguageFieldProps {
  label: string;
  value: string | MultiLanguageText;
  onChange: (value: string | MultiLanguageText) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const DualLanguageField: React.FC<DualLanguageFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'en' | 'ar'>('en');
  
  // Convert value to MultiLanguageText if it's a string
  const getMultiLanguageValue = (): MultiLanguageText => {
    if (typeof value === 'string') {
      return { en: value, ar: '' };
    }
    return value;
  };

  const multiLangValue = getMultiLanguageValue();

  const handleChange = (lang: 'en' | 'ar', text: string) => {
    const newValue = {
      ...multiLangValue,
      [lang]: text
    };
    onChange(newValue);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-semibold text-gray-900 text-left">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {/* Language Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('en')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'en'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ar'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          العربية
        </button>
      </div>

      {/* Input Fields */}
      <div className="space-y-3">
        {/* English Input */}
        <div className={`${activeTab === 'en' ? 'block' : 'hidden'}`}>
          <input
            type="text"
            value={multiLangValue.en}
            onChange={(e) => handleChange('en', e.target.value)}
            placeholder={placeholder || 'Enter English text...'}
            className="w-full pl-3 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left"
            dir="ltr"
          />
        </div>

        {/* Arabic Input */}
        <div className={`${activeTab === 'ar' ? 'block' : 'hidden'}`}>
          <input
            type="text"
            value={multiLangValue.ar}
            onChange={(e) => handleChange('ar', e.target.value)}
            placeholder={placeholder || 'أدخل النص العربي...'}
            className="w-full pr-3 pl-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
            dir="rtl"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-500 mb-2">Preview:</div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-600">EN:</span>
            <span className="text-sm">{multiLangValue.en || 'No English text'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-600">AR:</span>
            <span className="text-sm text-right" dir="rtl">{multiLangValue.ar || 'لا يوجد نص عربي'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 