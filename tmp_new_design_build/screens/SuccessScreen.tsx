
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight } from 'lucide-react';

const SuccessScreen: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full bg-[#fdfcfb] p-8 flex flex-col items-center justify-center"
    >
      <motion.div 
        initial={{ scale: 0.5, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12 }}
        className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-8"
      >
        <CheckCircle size={56} />
      </motion.div>

      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-800 tracking-tight mb-2">Submission Finalized</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-[220px] mx-auto">
          Your exam session has been closed securely. All telemetry logs have been synchronized with the proctor server.
        </p>
      </div>

      <div className="w-full bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-12 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 uppercase font-bold tracking-widest">Session ID</span>
          <span className="text-gray-800 font-bold font-mono">A7X-982Q</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 uppercase font-bold tracking-widest">Total Risk Score</span>
          <span className="text-green-600 font-bold font-mono">0.00 (EXCELLENT)</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 uppercase font-bold tracking-widest">Duration</span>
          <span className="text-gray-800 font-bold font-mono">42m 12s</span>
        </div>
      </div>

      <button
        onClick={onHome}
        className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-100 flex items-center justify-center space-x-2 active:scale-95 transition-transform"
      >
        <span>EXIT TO LOGIN</span>
        <ArrowRight size={20} />
      </button>

      <div className="mt-8 text-[10px] text-gray-400 uppercase font-bold tracking-widest flex flex-col items-center space-y-2">
        <div className="animate-pulse">Encrypted Handshake Complete</div>
        <div className="text-[8px] opacity-40 font-mono tracking-[0.2em]">©techivibes</div>
      </div>
    </motion.div>
  );
};

export default SuccessScreen;
