
import React, { useState } from 'react';
import TerminalButton from '../components/TerminalButton';

interface Props {
  onBack: () => void;
}

const DeveloperAccessScreen: React.FC<Props> = ({ onBack }) => {
  const [config, setConfig] = useState({
    kioskMode: true,
    cameraAccess: true,
    backgroundAlarm: true,
    whitelistActive: true,
    devBrowser: false,
    debugOverlay: true,
  });

  const toggle = (key: keyof typeof config) => setConfig(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] font-mono text-[#39ff14] p-4 terminal-scroll overflow-y-auto pb-10">
      <div className="flex flex-col border-b border-[#39ff14] pb-4 mb-6">
        <h1 className="text-lg font-black tracking-widest uppercase italic underline">DEV_CORE_ACCESS</h1>
        <div className="flex justify-between items-center mt-2">
           <p className="text-[8px] opacity-40 uppercase">Entity: Administrator</p>
           <button onClick={onBack} className="text-[9px] border border-[#39ff14] px-2 py-0.5 uppercase">Exit</button>
        </div>
      </div>

      <div className="flex flex-col space-y-8">
        {/* Feature Flags */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-bold bg-[#39ff14] text-black px-2 py-0.5 uppercase tracking-widest inline-block">App_Flags</h2>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(config).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between p-3 border border-[#39ff14]/20 bg-white/5">
                <div className="text-[10px] font-bold uppercase tracking-tighter">{key.replace(/([A-Z])/g, '_$1')}</div>
                <button 
                  onClick={() => toggle(key as any)}
                  className={`w-10 h-5 border transition-all relative ${val ? 'bg-[#39ff14] border-[#39ff14]' : 'bg-transparent border-white/20'}`}
                >
                  <div className={`absolute top-0.5 w-3.5 h-3.5 transition-all ${val ? 'right-0.5 bg-black' : 'left-0.5 bg-white/40'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Console */}
        <div className="space-y-3">
           <h2 className="text-[10px] font-bold bg-[#39ff14] text-black px-2 py-0.5 uppercase tracking-widest inline-block">Console_Output</h2>
           <div className="bg-black border border-[#39ff14]/30 p-3 h-48 overflow-y-auto text-[9px] space-y-1 opacity-70 terminal-scroll font-mono">
              <div>[AUTH_OK] TOKEN_VERIFIED</div>
              <div>[SYSTEM] IMMERSIVE_STICKY: ON</div>
              <div>[WEBRTC] READY_ICE_CANDIDATE</div>
              <div>[CAM] SCANNING_ACTIVE</div>
              <div className="text-yellow-500">[WARN] LOW_MEMORY_THRESHOLD_BYPASS</div>
              <div className="animate-pulse">_</div>
           </div>

           <div className="p-3 border border-[#39ff14]/30 space-y-3">
              <p className="text-[9px] uppercase font-bold opacity-60">Command_Input</p>
              <div className="flex space-x-2">
                 <input type="text" placeholder="CMD > " className="flex-grow bg-black border-b border-[#39ff14] text-[10px] p-1 focus:outline-none" />
                 <button className="bg-[#39ff14] text-black px-3 py-1 text-[9px] font-bold">EXEC</button>
              </div>
           </div>
        </div>
      </div>
      
      <div className="mt-8 text-center opacity-20 text-[7px] uppercase tracking-[0.3em] font-bold">
        (c) 2024 Technivibes Internal Dev Kit
      </div>
    </div>
  );
};

export default DeveloperAccessScreen;
