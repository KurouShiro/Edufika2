
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Terminal, XCircle } from 'lucide-react';

interface ViolationScreenProps {
  type: string;
  onReset: () => void;
}

const ViolationScreen: React.FC<ViolationScreenProps> = ({ type, onReset }) => {
  useEffect(() => {
    // Simulated alarm sound logic could go here
    console.log("ALARM TRIGGERED: " + type);
  }, [type]);

  return (
    <motion.div 
      initial={{ backgroundColor: '#fff' }}
      animate={{ backgroundColor: '#fef2f2' }}
      className="h-full w-full p-6 flex flex-col items-center justify-center relative overflow-hidden"
    >
      {/* Glitch Background Effect */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <XCircle size={500} />
      </div>

      <motion.div 
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="w-24 h-24 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-red-200 mb-8 z-10"
      >
        <AlertTriangle size={48} />
      </motion.div>

      <div className="text-center z-10 mb-8">
        <h2 className="text-3xl font-bold text-red-600 tracking-tighter uppercase mb-2">Security Breach</h2>
        <div className="inline-block px-4 py-2 bg-red-100 rounded-full border border-red-200">
          <span className="text-[10px] font-bold text-red-700 font-mono">{type}</span>
        </div>
      </div>

      <div className="w-full bg-white/50 backdrop-blur border border-red-100 rounded-3xl p-6 mb-8 z-10">
        <div className="flex items-center space-x-2 mb-4">
          <Terminal size={14} className="text-red-600" />
          <span className="text-[10px] font-bold text-red-600 uppercase">Automated Log</span>
        </div>
        <div className="space-y-2 text-[10px] font-mono text-red-400">
          <p>> DETECTED: Illegal navigation attempt</p>
          <p>> REASON: {type === 'BACKGROUND_ACTIVITY' ? 'App switched to background' : 'Session expired'}</p>
          <p>> STATUS: Lockdown active</p>
          <p>> COUNTER: Signal sent to Proctor API</p>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 max-w-[200px] mb-8 z-10">
        Please contact the proctor to unlock your device and continue.
      </p>

      <div className="w-full space-y-4 z-10">
        <button
          onClick={onReset}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-95 transition-transform"
        >
          RETURN TO PORTAL
        </button>
        <div className="text-center text-[8px] text-gray-400 font-mono tracking-widest uppercase">
          ©techivibes
        </div>
      </div>
    </motion.div>
  );
};

export default ViolationScreen;
