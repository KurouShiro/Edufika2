
import React, { useState } from 'react';
import { Delete, Trash2, ArrowUp } from 'lucide-react';

interface KeypadProps {
  onKeyPress: (key: string) => void;
  theme?: 'light' | 'dark';
}

export const Keypad: React.FC<KeypadProps> = ({ onKeyPress, theme = 'light' }) => {
  const [isUppercase, setIsUppercase] = useState(true);

  const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  const handleCharPress = (char: string) => {
    onKeyPress(isUppercase ? char.toUpperCase() : char.toLowerCase());
  };

  const btnBase = theme === 'dark' 
    ? 'bg-[#2a2a2a] border-gray-800 text-gray-300 active:bg-green-900 active:text-green-400 active:border-green-700 shadow-none' 
    : 'bg-white border-gray-100 text-gray-600 active:bg-green-50 active:text-green-600 active:border-green-200 shadow-sm';

  const controlBase = theme === 'dark'
    ? 'bg-gray-800 border-gray-700 text-gray-400'
    : 'bg-white border-gray-100 text-gray-400';

  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {/* Number and QWERTY Rows */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={`flex justify-center space-x-1 ${rowIndex === 2 ? 'px-4' : rowIndex === 3 ? 'px-8' : ''}`}>
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handleCharPress(key)}
              className={`flex-1 min-w-[28px] h-10 border rounded-lg text-xs font-bold transition-all transform active:scale-90 font-mono flex items-center justify-center ${btnBase}`}
            >
              {isUppercase ? key.toUpperCase() : key.toLowerCase()}
            </button>
          ))}
        </div>
      ))}

      {/* Control Row */}
      <div className="flex justify-center space-x-1.5 mt-2">
        <button
          onClick={() => setIsUppercase(!isUppercase)}
          className={`flex-[1.5] h-11 rounded-xl flex items-center justify-center transition-all shadow-sm border ${
            isUppercase 
              ? 'bg-green-500 text-white border-green-400 shadow-green-900/10' 
              : controlBase
          }`}
          title="Toggle Case"
        >
          <ArrowUp size={16} className={isUppercase ? 'opacity-100' : 'opacity-40'} />
          <span className="ml-1 text-[10px] font-bold uppercase tracking-tight">Shift</span>
        </button>

        <button
          onClick={() => onKeyPress('_')}
          className={`flex-[2] h-11 border rounded-xl text-lg font-bold active:bg-opacity-50 transition-colors shadow-sm font-mono flex items-center justify-center ${controlBase}`}
        >
          _
        </button>

        <button
          onClick={() => onKeyPress('BACK')}
          className={`flex-1 h-11 border rounded-xl flex items-center justify-center transition-colors shadow-sm ${
            theme === 'dark' ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}
          title="Backspace"
        >
          <Delete size={18} />
        </button>
      </div>

      <div className="flex justify-center mt-1">
        <button
          onClick={() => onKeyPress('CLEAR')}
          className="w-full h-10 bg-red-500 bg-opacity-10 text-red-500 border border-red-500 border-opacity-20 rounded-xl flex items-center justify-center active:bg-opacity-20 transition-colors shadow-sm"
        >
          <Trash2 size={16} />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest">Clear Session Input</span>
        </button>
      </div>
    </div>
  );
};
