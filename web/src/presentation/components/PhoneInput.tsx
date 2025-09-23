import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parsePhoneNumberFromString, getCountryCallingCode, getCountries } from 'libphonenumber-js';
import countriesNames from 'i18n-iso-countries';
import enNames from 'i18n-iso-countries/langs/en.json';
import arNames from 'i18n-iso-countries/langs/ar.json';

type PhoneInputProps = {
  isRTL?: boolean;
  defaultCountry?: string; // ISO2 like 'KW'
  valueE164?: string;
  onChange: (payload: {
    e164?: string;
    national: string;
    country: string;
    isValid: boolean;
  }) => void;
  submitAttempted?: boolean;
  labels?: {
    country?: string;
    number?: string;
    invalid?: string;
  };
  required?: boolean;
  className?: string;
};

// Optional examples for a few countries; others will use a generic placeholder
const COUNTRY_EXAMPLES: Record<string, string> = {
  KW: '9000 0000',
  SA: '512 345 678',
  AE: '50 123 4567',
  QA: '3312 3456',
  OM: '9212 3456',
  BH: '3600 0000',
  EG: '100 123 4567',
  JO: '7 9012 3456',
  LB: '71 234 567',
  US: '(201) 555-0123',
  GB: '7400 123456',
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  isRTL = false,
  defaultCountry = 'KW',
  valueE164,
  onChange,
  submitAttempted,
  labels,
  required,
  className,
}) => {
  // Register locales once
  countriesNames.registerLocale(enNames as any);
  countriesNames.registerLocale(arNames as any);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<string>(defaultCountry);
  const [national, setNational] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(false);
  const [touched, setTouched] = useState<boolean>(false);

  // All available countries from libphonenumber-js
  const countriesWithCodes = useMemo(() => {
    const all = getCountries();
    return all.map((iso) => {
      let code = '';
      try {
        code = getCountryCallingCode(iso as string);
      } catch { code = ''; }
      const name = countriesNames.getName(iso as string, isRTL ? 'ar' : 'en');
      return { iso: iso as string, code, name: name || (iso as string) };
    }).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [isRTL]);

  useEffect(() => {
    // Validate on changes
    const phone = parsePhoneNumberFromString(national, country);
    const valid = Boolean(phone?.isValid());
    setIsValid(valid);
    onChange({
      e164: valid ? phone!.number : undefined,
      national,
      country,
      isValid: valid,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, national]);

  const currentExample = useMemo(() => COUNTRY_EXAMPLES[country] || '', [country]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const invalidMsg = labels?.invalid || (isRTL ? 'رقم غير صالح للدولة المختارة' : 'Invalid number for selected country');
  const countryLabel = labels?.country || (isRTL ? 'الدولة' : 'Country');
  const numberLabel = labels?.number || (isRTL ? 'رقم الهاتف' : 'Phone number');

  return (
    <div className={className || ''}>
      <label className={`block text-sm font-semibold text-gray-900 mb-2 text-left`}>
        {numberLabel}{required ? ' *' : ''}
      </label>

      {/* One-line input: country select + national number */}
      <div
        className={`flex items-stretch w-full rounded-lg border ${
          isValid || !touched ? 'border-gray-300' : 'border-red-400'
        } focus-within:ring-2 ${
          isValid || !touched ? 'focus-within:ring-blue-500 focus-within:border-blue-500' : 'focus-within:ring-red-500 focus-within:border-red-500'
        } ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        {/* Custom country selector: shows ISO in field; full names in dropdown */}
        <div ref={dropdownRef} className="relative flex-none">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`pl-3 pr-7 py-3 h-full bg-transparent outline-none text-left whitespace-nowrap`}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={countryLabel}
          >
            {country} (+{(() => { try { return getCountryCallingCode(country); } catch { return ''; } })()})
            <span aria-hidden className="ml-2 align-middle">▾</span>
          </button>
          {open && (
            <div className={`absolute z-10 mt-1 w-64 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg ${isRTL ? 'right-0' : ''}`}>
              <ul role="listbox">
                {countriesWithCodes.map((c) => (
                  <li key={c.iso}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() => { setCountry(c.iso); setOpen(false); }}
                    >
                      {c.name} (+{c.code})
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="w-px bg-gray-200 my-2" />

        <input
          type="tel"
          inputMode="numeric"
          value={national}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
            setNational(digitsOnly);
          }}
          onBlur={() => setTouched(true)}
          className={`form-input flex-1 min-w-0 bg-transparent outline-none border-0 py-3 placeholder-gray-500 ${
            isRTL ? 'pr-4 pl-2 text-right' : 'pl-4 pr-2 text-left'
          }`}
          dir={isRTL ? 'rtl' : 'ltr'}
          placeholder={currentExample || (isRTL ? 'أدخل الرقم الوطني' : 'Enter national number')}
          aria-invalid={!isValid && (touched || submitAttempted)}
        />
      </div>

      {!isValid && (touched || submitAttempted) && (
        <p className={`mt-1 text-sm ${isRTL ? 'text-left' : 'text-left'} text-red-600`}>{invalidMsg}</p>
      )}
    </div>
  );
};

export default PhoneInput;


