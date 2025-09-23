import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../presentation/components/ui/core/Button';

export const LanguageSelection: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const selectLanguage = (language: 'ar' | 'en') => {
    navigate(`/form/${formId}/${language}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-6">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 text-center">
          {/* 4Sale Logo */}
          <div className="mb-6 sm:mb-8">
            <img 
              src="/4sale-logo.png" 
              alt="4Sale" 
              className="h-16 sm:h-20 mx-auto mb-3 sm:mb-4"
            />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              اختر لغتك المفضلة
            </h1>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-6">
              Choose Your Preferred Language
            </h2>
          </div>

          {/* Language Options */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            {/* Arabic Option */}
            <Button
              onClick={() => selectLanguage('ar')}
              className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <span className="text-lg sm:text-xl">العربية</span>
            </Button>

            {/* English Option */}
            <Button
              onClick={() => selectLanguage('en')}
              className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-green-600 hover:bg-green-700 text-white border-0 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <span className="text-lg sm:text-xl">English</span>
            </Button>
          </div>

          {/* Powered by 4Sale */}
          <div className="pt-4 sm:pt-6 border-t border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500 mb-2">Powered by</p>
            <div className="flex items-center justify-center">
              <img 
                src="/4sale-logo.png" 
                alt="4Sale" 
                className="h-16 sm:h-24"
              />
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 text-gray-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}; 