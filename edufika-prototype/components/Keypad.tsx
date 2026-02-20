
import React from 'react';

interface Props {
  onPress: (val: string) => void;
  onClear: () => void;
  onDelete: () => void;
}

const Keypad: React.FC<Props> = ({ onPress, onClear, onDelete }) => {
  // Using a 20-column grid for flexible key widths
  // Standard keys = 2 columns wide
  // Special keys (CLR, Backspace) = 3 columns wide in the bottom row
  
  const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '_'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'CLR', '⌫']
  ];

  return (
    <div className="w-full max-w-[400px] bg-[#1a1a1a]/60 border border-[#39ff14]/30 p-1.5 rounded-sm shadow-2xl">
      <div className="grid grid-cols-20 gap-1">
        {rows.map((row, rowIndex) => {
          return (
            <React.Fragment key={rowIndex}>
              {row.map((key) => {
                const isBackspace = key === '⌫';
                const isClear = key === 'CLR';
                const isSpecial = isBackspace || isClear;
                
                // Determine column span
                // Rows 1, 2, 3 have 10 keys: each spans 2/20
                // Row 4 has 7 letters + 2 specials: 
                // Letters span 2 each (14 total), Specials span 3 each (6 total) = 20 total.
                let colSpan = "col-span-2";
                if (rowIndex === 3 && isSpecial) {
                  colSpan = "col-span-3";
                }

                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isClear) onClear();
                      else if (isBackspace) onDelete();
                      else onPress(key);
                    }}
                    className={`
                      ${colSpan} h-11 sm:h-12 flex items-center justify-center border transition-all font-bold text-[11px] sm:text-xs active:scale-95 touch-manipulation
                      ${isSpecial 
                        ? 'bg-[#39ff14]/10 border-[#39ff14]/40 text-[#39ff14]' 
                        : 'bg-black/40 border-[#39ff14]/20 text-[#39ff14] hover:bg-[#39ff14]/10'}
                      ${isClear ? 'text-red-400 border-red-500/30' : ''}
                    `}
                  >
                    {key}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <style>{`
        .grid-cols-20 { grid-template-columns: repeat(20, minmax(0, 1fr)); }
        .col-span-2 { grid-column: span 2 / span 2; }
        .col-span-3 { grid-column: span 3 / span 3; }
      `}</style>
    </div>
  );
};

export default Keypad;
