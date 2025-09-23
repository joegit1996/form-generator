import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { Form, FormField, FormSubmission, MultiLanguageText } from '../types/form';
import { Button } from '../presentation/components/ui/core/Button';
import PhoneInput from '../presentation/components/PhoneInput';

export const PublicForm: React.FC = () => {
  const { formId, language } = useParams<{ formId: string; language: 'ar' | 'en' }>();
  const [form, setForm] = useState<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Default to English if no language specified
  const currentLanguage = language || 'en';
  const isRTL = currentLanguage === 'ar';

  // Helper function to get text in current language - FIXED
  const getText = (multiLangText: MultiLanguageText | string): string => {
    // Handle backward compatibility with old single-language strings
    if (typeof multiLangText === 'string') {
      return multiLangText;
    }
    // Handle new multi-language objects
    return multiLangText?.[currentLanguage] || multiLangText?.en || '';
  };

  // Labels for phone number field in both languages
  const phoneLabel = currentLanguage === 'ar' ? 'رقم الهاتف' : 'Phone Number';
  const submitButtonText = currentLanguage === 'ar' ? 'إرسال' : 'Submit';
  const loadingText = currentLanguage === 'ar' ? 'جاري التحميل...' : 'Loading form...';
  const errorNotFound = currentLanguage === 'ar' ? 'النموذج غير موجود أو غير متاح' : 'Form not found or unavailable';

  useEffect(() => {
    if (formId) {
      loadForm(parseInt(formId));
    }
  }, [formId]);

  const loadForm = async (id: number) => {
    try {
      setIsLoading(true);
      const formData = await apiService.getForm(id);
      setForm(formData);
    } catch (err) {
      setError(errorNotFound);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!phoneNumber.trim()) {
      // keep page banner clean; inline phone input will show the message
      return false;
    }
    // E.164 minimal sanity check: + followed by 8-15 digits
    const e164Pattern = /^\+[1-9]\d{7,14}$/;
    if (!e164Pattern.test(phoneNumber)) {
      return false;
    }

    if (!form) return false;

    for (const field of form.fields) {
      if (field.required && (!formData[field.id] || formData[field.id] === '')) {
        const fieldLabel = getText(field.label);
        setError(currentLanguage === 'ar' ? `${fieldLabel} مطلوب` : `${fieldLabel} is required`);
        return false;
      }
    }

    setError(null);
    return true;
  };

  const submitForm = async () => {
    setSubmitAttempted(true);
    if (!validateForm() || !form) return;

    try {
      setIsSubmitting(true);
      const submission: FormSubmission = {
        formId: form.id,
        phoneNumber: phoneNumber.trim(),
        responseData: formData,
        language: currentLanguage
      };

      await apiService.submitForm(submission);
      setIsSubmitted(true);
    } catch (err) {
      setError(currentLanguage === 'ar' ? 'فشل في إرسال النموذج. حاول مرة أخرى.' : 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    // const fieldLabel = getText(field.label);
    const fieldPlaceholder = field.placeholder ? getText(field.placeholder) : '';
    
    const baseClasses = `w-full py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isRTL ? 'pr-4 pl-2 text-right' : 'pl-4 pr-2 text-left'}`;
    const rtlClass = isRTL ? 'force-rtl' : '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <input
            type={field.type}
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={`${baseClasses} ${rtlClass}`}
            placeholder={fieldPlaceholder}
            required={field.required}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={isRTL ? { textAlign: 'right' } : {}}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={`${baseClasses} min-h-24 resize-y ${rtlClass}`}
            placeholder={fieldPlaceholder}
            required={field.required}
            rows={4}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={isRTL ? { textAlign: 'right' } : {}}
          />
        );

      case 'select':
        return (
          <select
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={`${baseClasses} ${rtlClass}`}
            required={field.required}
            dir={isRTL ? 'rtl' : 'ltr'}
            style={isRTL ? { textAlign: 'right' } : {}}
          >
            <option value="">{fieldPlaceholder || (currentLanguage === 'ar' ? 'اختر خيار' : 'Select an option')}</option>
            {field.options?.map((option, index) => (
              <option key={index} value={getText(option)}>
                {getText(option)}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-3">
            {field.options?.map((option, index) => (
              <label key={index} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                <input
                  type="radio"
                  name={field.id}
                  value={getText(option)}
                  checked={formData[field.id] === getText(option)}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 ${isRTL ? 'ml-3' : 'mr-3'}`}
                  required={field.required}
                />
                <span className="text-gray-700">{getText(option)}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-3">
            {field.options?.map((option, index) => (
              <label key={index} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                <input
                  type="checkbox"
                  value={getText(option)}
                  checked={(formData[field.id] || []).includes(getText(option))}
                  onChange={(e) => {
                    const currentValues = formData[field.id] || [];
                    const optionValue = getText(option);
                    if (e.target.checked) {
                      handleFieldChange(field.id, [...currentValues, optionValue]);
                    } else {
                      handleFieldChange(field.id, currentValues.filter((v: string) => v !== optionValue));
                    }
                  }}
                  className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${isRTL ? 'ml-3' : 'mr-3'}`}
                />
                <span className="text-gray-700">{getText(option)}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => handleFieldChange(field.id, e.target.files?.[0])}
            className={baseClasses}
            required={field.required}
          />
        );

      case 'date':
      case 'time':
        return (
          <input
            type={field.type}
            value={formData[field.id] || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={baseClasses}
            required={field.required}
          />
        );

      default:
        return null;
    }
  };

  if (isSubmitted) {
    return (
      <div className={`min-h-screen bg-gray-50 py-12 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-lg mx-auto px-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentLanguage === 'ar' ? 'شكراً لك!' : 'Thank You!'}
            </h2>
            <p className="text-gray-600 text-lg">
              {currentLanguage === 'ar' 
                ? 'تم إرسال ردك بنجاح. سيتواصل معك فريقنا قريباً.'
                : 'Your response has been submitted successfully. Our team will contact you soon.'}
            </p>
            
            {/* Powered by 4Sale */}
                      <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">
              {currentLanguage === 'ar' ? 'مدعوم من' : 'Powered by'}
            </p>
            <div className="flex items-center justify-center">
              <img src="/4sale-logo.png" alt="4Sale" className="h-24" />
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 py-12 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto px-6">
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{loadingText}</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <div className="h-8 w-8 mx-auto mb-4 text-red-600 flex items-center justify-center">
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {(() => {
          if (!form || isSubmitted) return null;
          
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Hero Banner */}
              {form.heroImageUrl && (
                <div className="w-full h-40 sm:h-48 bg-gray-200 overflow-hidden hero-banner">
                  <img 
                    src={form.heroImageUrl} 
                    alt="Form banner" 
                    className="w-full h-full object-contain sm:object-cover"
                    onError={(e) => {
                      e.currentTarget.parentElement!.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="p-8">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-gray-900 mb-3">{getText(form.title)}</h1>
                  {form.description && (
                    <p className="text-gray-600 leading-relaxed">{getText(form.description)}</p>
                  )}
                </div>

              {/* Phone Number Field - Country-aware with validation */}
              <div className="mb-6">
                <PhoneInput
                  isRTL={isRTL}
                  defaultCountry={currentLanguage === 'ar' ? 'KW' : 'KW'}
                  labels={{
                    country: currentLanguage === 'ar' ? 'الدولة' : 'Country',
                    number: phoneLabel,
                    invalid: currentLanguage === 'ar' ? 'رقم غير صالح للدولة المختارة' : 'Invalid number for selected country',
                  }}
                  required
                  submitAttempted={submitAttempted}
                  onChange={({ e164, national, isValid }: { e164?: string; national: string; country: string; isValid: boolean }) => {
                    // store E.164 when valid, otherwise keep raw to allow correction
                    setPhoneNumber(e164 || national);
                    // no page-level error; inline component handles display
                  }}
                />
                <p className={`text-xs text-gray-500 mt-1 ${isRTL ? 'text-left' : 'text-left'}`}>
                  {currentLanguage === 'ar' 
                    ? 'مطلوب للتواصل معك من قبل فريقنا'
                    : 'Required for our agent to contact you'}
                </p>
              </div>

              {/* Dynamic Form Fields */}
              <div className="space-y-6 mb-8">
                {form.fields.map((field) => (
                  <div key={field.id}>
                    <label className={`block text-sm font-semibold text-gray-900 mb-2 ${isRTL ? 'text-left' : 'text-left'}`}>
                      {getText(field.label)}
                      {field.required && <span className={`text-red-500 ${isRTL ? 'mr-1' : 'ml-1'}`}>*</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <Button
                onClick={submitForm}
                loading={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 py-4 text-lg font-semibold rounded-xl"
              >
                {form.submitButtonText ? getText(form.submitButtonText) : submitButtonText}
              </Button>

              {/* Powered by 4Sale */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-sm text-gray-500 mb-2">
                  {currentLanguage === 'ar' ? 'مدعوم من' : 'Powered by'}
                </p>
                <div className="flex items-center justify-center">
                  <img src="/4sale-logo.png" alt="4Sale" className="h-24" />
                </div>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
};