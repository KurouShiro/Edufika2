
import React, { useEffect, useState, useContext } from 'react';
import TerminalButton from '../components/TerminalButton';
import Keypad from '../components/Keypad';
import { AUTH } from '../constants';
import { LanguageContext } from '../App';

interface Props {
  onResolve: () => void;
}

const ViolationScreen: React.FC<Props> = ({ onResolve }) => {
  const { t } = useContext(LanguageContext);
  const [flicker, setFlicker] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setFlicker(prev => !prev), 100);
    return () => clearInterval(interval);
  }, []);

  const handleAuth = () => {
    if (pin === AUTH.PROCTOR_PIN) {
      setIsAuthorized(true);
      setShowAuth(false);
    } else {
      alert("UNAUTHORIZED_ACCESS_DENIED");
      setPin('');
    }
  };

  const mockLogs = [
    { time: '14:20:01', event: 'SYS_CALL_INTERRUPT', node: 'EF_NODE_09' },
    { time: '14:21:45', event: 'BG_TASK_DETECTED', node: 'EF_NODE_09' },
    { time: '14:22:10', event: 'WINDOW_FOCUS_LOST', node: 'EF_NODE_09' },
  ];

  return (
    <div className={`fixed inset-0 z-[999] flex flex-col items-center justify-center p-4 text-white transition-colors duration-75 ${flicker && !isAuthorized ? 'bg-red-600' : 'bg-black'}`}>
      <div className="absolute top-0 left-0 w-full p-2 flex justify-between uppercase text-[8px] tracking-widest font-black opacity-80 border-b border-white/20 bg-black/20">
        <span>{t.security_alert}</span>
        <span>NODE_EF_BLOCK</span>
      </div>

      {!isAuthorized ? (
        <div className="w-full max-w-sm p-6 border-2 border-white neon-glow flex flex-col items-center space-y-6 bg-black animate-digitized shadow-[0_0_80px_rgba(255,255,255,0.1)]">
          <div className="p-3 bg-red-600 rounded-full animate-pulse border-2 border-white/20">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{t.session_locked}</h1>
            <div className="h-0.5 w-full bg-red-600 mx-auto mt-2" />
          </div>
          
          <p className="text-[11px] text-center opacity-80 leading-snug font-mono">
            {t.violation_desc}
          </p>

          <div className="grid grid-cols-1 gap-2 w-full">
            <TerminalButton onClick={onResolve} variant="primary" className="w-full py-2 text-xs bg-white text-black border-white hover:bg-black hover:text-white transition-all">
               {t.return_to_login}
            </TerminalButton>
            <button onClick={() => setShowAuth(true)} className="text-[9px] uppercase font-bold text-zinc-500 tracking-[0.2em] pt-2 hover:text-white transition-colors hover:scale-105 active:scale-95">
              {t.proctor_logs}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md p-6 border-2 border-[#39ff14] bg-black flex flex-col space-y-4 animate-digitized shadow-[0_0_50px_rgba(57,255,20,0.2)]">
          <div className="flex justify-between items-center border-b border-[#39ff14]/30 pb-2">
            <h2 className="text-sm font-bold text-[#39ff14] uppercase tracking-widest italic neon-glow">Blackbox_Registry</h2>
            <button onClick={() => setIsAuthorized(false)} className="text-[8px] border border-[#39ff14] px-2 py-0.5 uppercase hover:bg-[#39ff14] hover:text-black transition-all">{t.back}</button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto terminal-scroll">
            {mockLogs.map((log, i) => (
              <div key={i} className="p-2 border border-[#39ff14]/10 bg-[#39ff14]/5 flex justify-between items-center text-[10px] font-mono hover:bg-[#39ff14]/10 transition-colors">
                <span className="opacity-40">{log.time}</span>
                <span className="text-[#39ff14] font-bold">{log.event}</span>
                <span className="opacity-40">{log.node}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/40 text-[9px] uppercase text-yellow-500 leading-tight italic">
            Warning: These logs are anonymized to protect student privacy but sufficient for integrity verification.
          </div>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-[1000] bg-black/98 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="w-full max-w-xs p-6 border border-red-500 bg-black space-y-6 flex flex-col items-center animate-digitized shadow-[0_0_40px_rgba(220,38,38,0.2)]">
             <div className="text-center">
                <h3 className="text-sm font-bold uppercase text-red-500 tracking-widest">Authorized Only</h3>
                <p className="text-[8px] opacity-40 uppercase">Enter Proctor PIN to reveal logs</p>
             </div>
             <div className="h-10 w-full flex items-center justify-center border-b border-red-500 text-lg tracking-[0.8em] font-bold text-red-500 bg-red-500/5">
                {pin.split('').map(() => '●').join('') || <span className="opacity-20 text-xs tracking-normal font-mono">____</span>}
             </div>
             <Keypad 
               onPress={(v) => setPin(prev => (prev.length < 8 ? prev + v : prev))}
               onClear={() => setPin('')}
               onDelete={() => setPin(prev => prev.slice(0, -1))}
             />
             <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => {setShowAuth(false); setPin('');}} className="py-2 text-[10px] uppercase font-bold border border-zinc-800 text-zinc-500 hover:text-white transition-colors">{t.abort}</button>
                <button onClick={handleAuth} className="py-2 text-[10px] uppercase font-bold bg-red-600 text-white hover:bg-red-500 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]">{t.confirm}</button>
             </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-2 flex justify-center text-[8px] tracking-[0.4em] font-black opacity-60">
        EDUFIKA_LOCKDOWN_ENGINE_V1.0.2
      </div>
    </div>
  );
};

export default ViolationScreen;
