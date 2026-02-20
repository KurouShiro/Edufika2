
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const lines = [
  "> EDUFIKA_CORE v3.11.2 initialized",
  "> Checking hardware integrity... [OK]",
  "> Bypassing OS restrictions... [OK]",
  "> Loading Terminal GUI Layer...",
  "> Establishing Session Authority connection...",
  "> Ready."
];

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    if (visibleLines < lines.length) {
      const timer = setTimeout(() => {
        setVisibleLines(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }
  }, [visibleLines, onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="h-full w-full bg-[#fdfcfb] p-8 flex flex-col justify-center font-mono text-sm"
    >
      <div className="mb-8">
        <div className="text-2xl font-bold text-green-600 mb-2">EDUFIKA</div>
        <div className="h-1 w-12 bg-green-500 rounded-full"></div>
      </div>
      
      <div className="space-y-2">
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={i === lines.length - 1 ? "text-green-600 font-bold" : "text-gray-500"}
          >
            {line}
          </motion.div>
        ))}
      </div>

      <div className="absolute bottom-12 left-0 w-full flex flex-col items-center space-y-4">
        <div className="flex space-x-2">
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-2 h-2 rounded-full bg-green-200" 
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
            className="w-2 h-2 rounded-full bg-green-300" 
          />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }} 
            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
            className="w-2 h-2 rounded-full bg-green-400" 
          />
        </div>
        <div className="text-[8px] text-gray-300 uppercase tracking-[0.2em]">
          ©techivibes
        </div>
      </div>
    </motion.div>
  );
};

export default SplashScreen;
