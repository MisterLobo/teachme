import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Check, Copy } from 'lucide-react';
import { opaqueRegistration } from '@/lib/utils';
import { Control } from 'react-hook-form';
import { Input } from './input';
import { Button } from './button';
import { toast } from 'sonner';

const OTPInput = ({ control, onSubmit }: { control?: Control, onSubmit: (p: string) => void }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPasted, setIsPasted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const inputRefs = useRef<any>([]);
  const [step, setStep] = useState<'nominate' | 'confirm'>('nominate')
  const [header, setHeader] = useState('Enter Verification Code')
  const [subheader, setSubheader] = useState('Nominate 6-digit PIN')
  const [btnText, setBtnText] = useState('Continue')
  const [nominatedPIN, setNominatedPIN] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const allFilled = otp.every(digit => digit !== '');
    setIsComplete(allFilled);
  }, [otp]);

  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) return;
    
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setIsPasted(false);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: any) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: any) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length > 0) {
      const newOtp = Array(6).fill('');
      for (let i = 0; i < Math.min(pastedData.length, 6); i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      setIsPasted(true);
      
      // Focus the next empty input or the last one
      const nextEmptyIndex = newOtp.findIndex(digit => digit === '');
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
    }
  };

  const clearOtp = () => {
    setOtp(['', '', '', '', '', '']);
    setIsPasted(false);
    setIsComplete(false);
    inputRefs.current[0]?.focus();
  };

  const copyOtp = () => {
    const otpString = otp.join('');
    navigator.clipboard.writeText(otpString);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const themeClasses = {
    container: 'bg-gray-900 text-white min-h-screen',
    card: 'bg-gray-800 border-gray-700 shadow-xl',
    input: 'bg-gray-700 border-gray-600 text-white focus:border-blue-400 focus:ring-blue-400',
    inputPasted: 'bg-green-800 border-green-600 text-green-100',
    inputComplete: 'bg-blue-800 border-blue-600 text-blue-100',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonSecondary: 'bg-gray-600 hover:bg-gray-700 text-white border-gray-500',
    themeButton: 'bg-gray-700 hover:bg-gray-600 text-yellow-400'
  };

  const submitInput = async () => {
    setError(undefined)
    if (!isComplete) return
    const inputPin = otp.join('')
    if (!nominatedPIN) {
      setNominatedPIN(inputPin)
      clearOtp()
      setSubheader('Confirm 6-digit PIN')
      setBtnText('Confirm')
      return
    }

    clearOtp()
    if (inputPin !== nominatedPIN) {
      setError('PIN mismatch')
      return
    }
    onSubmit(inputPin)
  }

  return (

    <div className={`rounded-2xl p-8 transition-colors duration-200`}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">{header}</h1>
        <p className={`text-sm`}>
          {subheader}
        </p>
      </div>

      {error && <p className="text-red-500 text-center mb-2">{error}</p>}
      {/* OTP Input Fields */}
      <div className="flex justify-center gap-3 mb-6">
        {otp.map((digit, index) => (
          <Input
            key={index}
            ref={(el) => inputRefs.current[index] = el as any}
            type="password"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`
              w-12 h-14 text-center text-xl font-semibold rounded-lg border-2 transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2
              focus:ring-offset-gray-800
            `}
            maxLength={1}
            autoComplete="off"
          />
        ))}
      </div>

      {/* Status Indicators */}
      {isPasted && (
        <div className="text-center mb-4">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium`}>
            <Check size={14} />
            Code pasted successfully
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          onClick={submitInput}
          disabled={!isComplete}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 cursor-pointer border
          `}
        >
          {btnText}
        </Button>

        <div className="flex gap-2">
          <button
            onClick={clearOtp}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors duration-200`}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPInput;
