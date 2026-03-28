
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Shield, RefreshCw } from 'lucide-react';
import { WHITELIST_URLS } from '../constants';

interface QRScannerScreenProps {
  onScan: (url: string) => void;
  onBack: () => void;
}

const QRScannerScreen: React.FC<QRScannerScreenProps> = ({ onScan, onBack }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [status, setStatus] = useState('ALIGN_CODE_IN_VIEWFINDER');

  // Simulate scanning process
  useEffect(() => {
    const timer = setTimeout(() => {
      // In a real app, this would be triggered by a camera scan event
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const simulateSuccess = () => {
    setStatus('VALIDATING_ENDPOINT...');
    setIsScanning(false);
    setTimeout(() => {
      // Pick the first whitelist URL as a mock scan result
      onScan(WHITELIST_URLS[0]);
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full w-full bg-black flex flex-col relative overflow-hidden"
    >
      {/* Simulated Camera View (Placeholder) */}
      <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
         <div className="w-full h-full opacity-20 bg-[radial-gradient(circle,rgba(34,197,94,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
         <Camera className="text-white opacity-5 animate-pulse" size={120} />
      </div>

      {/* Overlay Header */}
      <div className="z-10 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onBack} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
          <X size={24} />
        </button>
        <div className="flex items-center space-x-2">
          <Shield className="text-green-500" size={18} />
          <span className="text-white text-[10px] font-bold uppercase tracking-widest">Secure Lens Active</span>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Viewfinder and Scanning Line */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 z-10">
        <div className="relative w-full aspect-square max-w-[280px]">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>

          {/* Scanning Line */}
          {isScanning && (
            <motion.div 
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="absolute left-0 right-0 h-0.5 bg-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.8)] z-20"
            />
          )}

          {/* Inner Shadow to emphasize scanning area */}
          <div className="absolute inset-0 border border-white/10 rounded-lg"></div>
        </div>

        <div className="mt-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-green-500 font-mono text-[10px] font-bold tracking-[0.2em] mb-2"
          >
            {status}
          </motion.div>
          <p className="text-gray-400 text-xs px-6">
            Hold your device steady while scanning the proctor's QR code.
          </p>
        </div>
      </div>

      {/* Footer Simulation Controls */}
      <div className="z-10 p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col space-y-4">
        <button 
          onClick={simulateSuccess}
          disabled={!isScanning}
          className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-2 ${
            !isScanning ? 'bg-gray-800 text-gray-500' : 'bg-green-500 text-white shadow-lg active:scale-95'
          }`}
        >
          {isScanning ? (
            <>
              <Shield size={18} />
              <span>SIMULATE SCAN SUCCESS</span>
            </>
          ) : (
            <>
              <RefreshCw className="animate-spin" size={18} />
              <span>VALIDATING...</span>
            </>
          )}
        </button>
        
        <div className="text-[8px] text-gray-500 text-center font-mono uppercase space-y-1">
          <div>EDUFIKA_VISUAL_AUTH // ID_BOUNDING: ENABLED</div>
          <div className="opacity-30 tracking-[0.2em]">©techivibes</div>
        </div>
      </div>
    </motion.div>
  );
};

export default QRScannerScreen;
