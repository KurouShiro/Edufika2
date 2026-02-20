
import React, { useState, useEffect } from 'react';
// Added AnimatePresence to imports
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Clock, LogOut, Info } from 'lucide-react';
import { SessionInfo } from '../types';

interface ExamBrowserScreenProps {
  url: string;
  session: SessionInfo | null;
  theme: 'light' | 'dark';
  onFinish: () => void;
  onViolation: (type: string) => void;
}

const ExamBrowserScreen: React.FC<ExamBrowserScreenProps> = ({ url, session, theme, onFinish, onViolation }) => {
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour
  const [showExitModal, setShowExitModal] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          onViolation('SESSION_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onViolation]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExit = () => {
    if (pin === '1234') { // Mock proctor pin
      onFinish();
    } else {
      alert("INVALID PROCTOR PIN");
    }
  };

  return (
    <div className={`h-full w-full flex flex-col relative transition-colors duration-500 ${theme === 'dark' ? 'bg-[#121212]' : 'bg-white'}`}>
      {/* Header Bar */}
      <div className={`h-14 border-b px-4 flex items-center justify-between z-20 transition-colors ${
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
      }`}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-green-900/10">
            <Shield size={18} />
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-tighter truncate max-w-[120px] ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-800'
          }`}>
            {url}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full flex items-center space-x-2 transition-colors ${
            theme === 'dark' ? 'bg-green-900/20 border border-green-800/30' : 'bg-green-50'
          }`}>
            <Clock size={14} className="text-green-600" />
            <span className="text-xs font-bold text-green-700 font-mono">{formatTime(timeLeft)}</span>
          </div>
          <button 
            onClick={() => setShowExitModal(true)}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'bg-gray-800 text-gray-500 hover:text-red-400' : 'bg-gray-50 text-gray-400 hover:text-red-500'
            }`}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main WebView Simulator */}
      <div className={`flex-1 relative overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#121212]' : 'bg-gray-50'}`}>
        {/* The Watermark */}
        <div className="absolute inset-0 pointer-events-none z-10 opacity-5 flex flex-wrap content-start justify-center rotate-[-30deg] scale-150">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className={`m-8 text-sm font-bold select-none ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
              {session?.token || 'STUDENTID'} • {new Date().toLocaleTimeString()}
            </div>
          ))}
        </div>

        <div className="w-full h-full p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-sm transition-colors ${
            theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <Info size={40} className={`${theme === 'dark' ? 'text-gray-700' : 'text-gray-100'}`} />
          </div>
          <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">Simulated Exam Content</h3>
          <p className="text-gray-300 text-[10px] max-w-[200px] leading-relaxed">
            WebView implementation would render actual web content here. Lock restrictions are currently active.
          </p>
        </div>
      </div>

      {/* Footer / Status Bar */}
      <div className={`h-8 px-4 flex items-center justify-between text-[10px] text-green-400 font-mono transition-colors ${
        theme === 'dark' ? 'bg-black border-t border-gray-800' : 'bg-gray-900'
      }`}>
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span>LIVE_MONITOR: ACTIVE</span>
        </div>
        <div className="opacity-50 tracking-widest">©techivibes</div>
      </div>

      {/* Proctor Exit Modal */}
      <AnimatePresence>
        {showExitModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`rounded-3xl w-full p-6 shadow-2xl transition-colors ${
                theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'
              }`}
            >
              <div className="text-center mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  theme === 'dark' ? 'bg-red-900/20 text-red-500' : 'bg-red-50 text-red-500'
                }`}>
                  <Shield size={24} />
                </div>
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Proctor Authorization</h3>
                <p className="text-xs text-gray-400">Ask your teacher to enter the exit PIN.</p>
              </div>

              <input 
                type="password"
                placeholder="____"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                className={`w-full h-16 text-center text-2xl font-bold tracking-widest border-2 rounded-2xl outline-none focus:border-green-400 mb-6 transition-colors ${
                  theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-gray-50 border-gray-100 text-gray-800'
                }`}
              />

              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowExitModal(false)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                    theme === 'dark' ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleExit}
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20"
                >
                  VERIFY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExamBrowserScreen;
