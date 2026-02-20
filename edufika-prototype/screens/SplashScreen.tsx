
import React, { useEffect, useState, useContext } from 'react';
import { LanguageContext } from '../App';

// Added Props interface to accept onFinish callback
interface Props {
  onFinish: () => void;
}

const SplashScreen: React.FC<Props> = ({ onFinish }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const { t } = useContext(LanguageContext);
  
  const sequence = [
    "[BOOT] EDUFIKA KERNEL INITIALIZING...",
    "[OK] LOADING SECURITY PROTOCOLS",
    "[OK] SYSTEM_UI_FLAG_IMMERSIVE_STICKY DETECTED",
    "[OK] EXOPLAYER CACHE CLEAR",
    "[OK] WEBRTC STUN/TURN CONFIG LOADED",
    "[WARN] REVISION CAMERA ACCESS: GRANTED",
    "[BOOT] APP READY. HANDSHAKE START."
  ];

  useEffect(() => {
    setLogs([]);
    const timeoutIds: number[] = [];

    sequence.forEach((text, i) => {
      const timeoutId = window.setTimeout(() => {
        setLogs(prev => [...prev, text]);
        if (i === sequence.length - 1) {
          const finishId = window.setTimeout(onFinish, 800);
          timeoutIds.push(finishId);
        }
      }, i * 400);
      timeoutIds.push(timeoutId);
    });

    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [onFinish]);

  return (
    <div className="flex flex-col items-start justify-center p-12 w-full max-w-2xl h-full font-mono">
      <div className="text-4xl font-bold mb-8 neon-glow tracking-tighter">EDUFIKA_</div>
      <div className="space-y-1 text-xs sm:text-sm">
        {logs.map((log, i) => (
          <div key={i} className="animate-pulse">
            <span className="text-[#39ff14]/50">{"> "}</span>
            {log}
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center">
        <div className="w-12 h-1 bg-[#39ff14] animate-ping" />
        <span className="ml-4 text-[10px] tracking-widest uppercase opacity-60">{t.mounting_ui}</span>
      </div>
    </div>
  );
};

export default SplashScreen;
