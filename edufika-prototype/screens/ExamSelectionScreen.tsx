
import React, { useContext } from 'react';
import TerminalButton from '../components/TerminalButton';
import { LanguageContext } from '../App';

interface Props {
  onManual: () => void;
  onScan: () => void;
  onSettings: () => void;
}

const ExamSelectionScreen: React.FC<Props> = ({ onManual, onScan, onSettings }) => {
  const { t } = useContext(LanguageContext);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8 max-w-md relative">
      <button 
        onClick={onSettings}
        className="absolute top-4 right-4 p-2 text-[#39ff14] opacity-40 hover:opacity-100 transition-opacity"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <div className="w-full neon-border p-6 bg-[#0a0a0a]/80 space-y-4">
        <h2 className="text-xl font-bold tracking-widest text-center border-b border-[#39ff14]/30 pb-4 uppercase">{t.exam_init}</h2>
        
        <p className="text-xs opacity-70 leading-relaxed text-center">
          {t.selection_desc}
        </p>

        <div className="grid grid-cols-1 gap-4 pt-4">
          <TerminalButton onClick={onScan} variant="primary" className="flex items-center justify-center space-x-3">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
             </svg>
             <span>{t.scan_qr}</span>
          </TerminalButton>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-[#39ff14]/20"></div>
            <span className="flex-shrink mx-4 text-[10px] opacity-40 uppercase">OR</span>
            <div className="flex-grow border-t border-[#39ff14]/20"></div>
          </div>

          <TerminalButton onClick={onManual} variant="outline" className="flex items-center justify-center space-x-3">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
             </svg>
             <span>{t.manual_input}</span>
          </TerminalButton>
        </div>
      </div>
      
      <div className="text-[9px] text-center opacity-30 uppercase tracking-[0.2em] w-full mt-8">
        {t.lockdown_warning}
      </div>
    </div>
  );
};

export default ExamSelectionScreen;
