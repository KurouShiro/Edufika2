
import React, { useContext } from 'react';
import TerminalButton from '../components/TerminalButton';
import { LanguageContext } from '../App';

interface Props {
  onRestart: () => void;
}

const SuccessScreen: React.FC<Props> = ({ onRestart }) => {
  const { t } = useContext(LanguageContext);
  
  return (
    <div className="flex flex-col items-center justify-center space-y-8 p-12 text-center">
      <div className="w-32 h-32 border-4 border-[#39ff14] rounded-full flex items-center justify-center animate-in zoom-in duration-500">
         <svg className="w-16 h-16 text-[#39ff14] neon-glow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
         </svg>
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl font-black uppercase tracking-widest neon-glow">{t.mission_complete}</h1>
        <p className="text-sm opacity-60 max-w-sm mx-auto leading-relaxed">
          {t.success_desc}
        </p>
      </div>

      <div className="bg-[#39ff14]/10 border border-[#39ff14]/30 p-6 space-y-2 w-full max-w-sm">
         <div className="text-[10px] uppercase opacity-40">{t.receipt}</div>
         <div className="text-lg font-mono font-bold">TX-ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}</div>
         <div className="text-[8px] uppercase">Synced: {new Date().toLocaleString()}</div>
      </div>

      <TerminalButton onClick={onRestart} variant="outline" className="w-full max-w-xs">
         {t.close_app}
      </TerminalButton>
      
      <p className="text-[9px] opacity-30 uppercase tracking-[0.3em]">Edufika Security Engine - Logout Complete</p>
    </div>
  );
};

export default SuccessScreen;
