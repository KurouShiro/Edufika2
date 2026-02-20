
import React, { useState, useContext } from 'react';
import TerminalButton from '../components/TerminalButton';
import { LanguageContext } from '../App';

interface Props {
  onBack: () => void;
  role: 'STUDENT' | 'ADMIN' | 'DEVELOPER' | null;
}

const SettingsScreen: React.FC<Props> = ({ onBack, role }) => {
  const { lang: currentLang, setLang, t } = useContext(LanguageContext);
  const [fontSize, setFontSize] = useState<'SM' | 'MD' | 'LG'>('MD');
  const [alerts, setAlerts] = useState(true);

  const languages = [
    { code: 'EN', name: 'English (US)' },
    { code: 'ID', name: 'Bahasa Indonesia' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] font-mono p-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-[#39ff14]/30 pb-4 mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-[0.2em] uppercase neon-glow text-[#39ff14]">{t.config_title}</h1>
          <p className="text-[9px] opacity-40 uppercase tracking-widest">{t.user_role}: {role || 'GUEST'}</p>
        </div>
        <button onClick={onBack} className="text-[#39ff14] text-xs border border-[#39ff14]/30 px-3 py-1 hover:bg-[#39ff14]/10 uppercase">{t.exit}</button>
      </div>

      <div className="space-y-8 flex-grow">
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase text-[#39ff14]/60 tracking-widest">{t.lang_registry}</h2>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as any)}
                className={`p-3 border text-left transition-all ${
                  currentLang === l.code 
                    ? 'bg-[#39ff14] text-black border-[#39ff14]' 
                    : 'bg-black text-[#39ff14] border-[#39ff14]/20 opacity-50'
                }`}
              >
                <div className="text-xs font-bold">{l.name}</div>
                <div className="text-[8px] tracking-widest opacity-60">LOCALE: {l.code}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase text-[#39ff14]/60 tracking-widest">{t.ui_scale}</h2>
          <div className="flex space-x-2">
            {['SM', 'MD', 'LG'].map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size as any)}
                className={`flex-1 py-2 text-[10px] font-bold border ${
                  fontSize === size 
                    ? 'bg-[#39ff14]/20 border-[#39ff14] text-[#39ff14]' 
                    : 'border-white/10 text-white/30'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase text-[#39ff14]/60 tracking-widest">{t.sys_protocols}</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 border border-[#39ff14]/10 bg-white/5">
              <div>
                <div className="text-xs font-bold text-[#39ff14]">{t.secure_alarm}</div>
                <div className="text-[8px] opacity-40 uppercase">{t.alarm_desc}</div>
              </div>
              <button 
                onClick={() => setAlerts(!alerts)}
                className={`w-12 h-6 border transition-all relative ${alerts ? 'bg-[#39ff14] border-[#39ff14]' : 'bg-transparent border-white/20'}`}
              >
                <div className={`absolute top-1 w-4 h-4 transition-all ${alerts ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
              </button>
            </div>
            
            <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 text-[8px] uppercase text-yellow-500/80 leading-relaxed italic">
              {t.handshake_note}
            </div>
          </div>
        </section>
      </div>

      <div className="pt-8">
        <TerminalButton onClick={onBack} className="w-full text-xs">
          {t.save}
        </TerminalButton>
      </div>

      <div className="mt-6 text-center text-[7px] opacity-20 tracking-[0.4em] font-bold uppercase">
        Edufika Node Config v1.0.2-STABLE
      </div>
    </div>
  );
};

export default SettingsScreen;
