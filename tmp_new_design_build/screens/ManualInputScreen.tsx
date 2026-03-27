
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { WHITELIST_URLS } from '../constants';

interface ManualInputScreenProps {
  onStart: (url: string) => void;
  onBack: () => void;
}

type ValidationStatus = 'IDLE' | 'VALIDATING' | 'SUCCESS' | 'ERROR';

const ManualInputScreen: React.FC<ManualInputScreenProps> = ({ onStart, onBack }) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ValidationStatus>('IDLE');
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!url) return;
    
    setError('');
    setStatus('VALIDATING');

    // Simulate server-side whitelist validation
    setTimeout(() => {
      const isValid = WHITELIST_URLS.some(w => url.toLowerCase().includes(w.toLowerCase()));
      if (isValid) {
        setStatus('SUCCESS');
        // Small delay to show the success icon before transitioning
        setTimeout(() => {
          onStart(url);
        }, 800);
      } else {
        setError('URL_NOT_WHITELISTED: Access denied by security policy.');
        setStatus('ERROR');
      }
    }, 1200);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (status !== 'IDLE') setStatus('IDLE');
    if (error) setError('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full w-full bg-[#fdfcfb] p-6 flex flex-col"
    >
      <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-green-600">
        <ArrowLeft size={24} />
      </button>

      <div className="mt-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Launch URL</h2>
        <p className="text-gray-400 text-sm mt-1">Enter the examination destination link.</p>
      </div>

      <div className="space-y-4 flex-1">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-2">Endpoint URL</label>
          <div className="relative">
            <input 
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://forms.google.com/..."
              className={`w-full p-4 pl-12 pr-12 bg-white border-2 rounded-2xl outline-none transition-all text-sm font-mono ${
                status === 'ERROR' ? 'border-red-200 focus:border-red-400' : 
                status === 'SUCCESS' ? 'border-green-200 focus:border-green-400' : 
                'border-gray-100 focus:border-green-400'
              }`}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              <ExternalLink size={20} />
            </div>
            
            {/* Validation Status Icon */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {status === 'VALIDATING' && (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                  >
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                  </motion.div>
                )}
                {status === 'SUCCESS' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                  >
                    <CheckCircle2 size={20} className="text-green-500" />
                  </motion.div>
                )}
                {status === 'ERROR' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                  >
                    <AlertCircle size={20} className="text-red-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-50 border border-red-100 rounded-xl"
          >
            <div className="text-red-600 text-xs font-bold mb-1 uppercase flex items-center space-x-2">
              <AlertCircle size={14} />
              <span>Validation Failure</span>
            </div>
            <div className="text-red-400 text-[10px] leading-relaxed font-mono">{error}</div>
          </motion.div>
        )}

        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-start space-x-3">
          <ShieldCheck className="text-green-600 shrink-0" size={18} />
          <div className="text-[10px] text-green-700 leading-tight">
            Only approved domains from the school whitelist can be accessed. Ensure your link begins with https://
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleStart}
          disabled={!url || status === 'VALIDATING' || status === 'SUCCESS'}
          className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center space-x-2 ${
            status === 'VALIDATING' || status === 'SUCCESS' 
              ? 'bg-gray-100 text-gray-400' 
              : 'bg-green-500 text-white shadow-green-100 active:scale-95'
          }`}
        >
          {status === 'VALIDATING' ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>VALIDATING...</span>
            </>
          ) : status === 'SUCCESS' ? (
            <>
              <CheckCircle2 size={18} />
              <span>ACCESS GRANTED</span>
            </>
          ) : (
            <span>ENTER EXAM ROOM</span>
          )}
        </button>
        <div className="text-center text-[8px] text-gray-300 font-mono tracking-widest uppercase">
          ©techivibes
        </div>
      </div>
    </motion.div>
  );
};

export default ManualInputScreen;
