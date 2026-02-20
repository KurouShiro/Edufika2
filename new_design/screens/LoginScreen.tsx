
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Keypad } from '../components/Keypad';
import { SessionInfo } from '../types';
import { DEV_PASSCODE } from '../constants';
import { Settings as SettingsIcon } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (session: SessionInfo) => void;
  onSettings: () => void;
  lang: 'en' | 'id';
  theme: 'light' | 'dark';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSettings, lang, theme }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const t = {
    en: {
      title: 'Access Gate',
      subtitle: 'Enter your temporary session token',
      claim: 'CLAIM SESSION',
      error: 'INVALID SESSION TOKEN'
    },
    id: {
      title: 'Gerbang Akses',
      subtitle: 'Masukkan token sesi sementara',
      claim: 'KLAIM SESI',
      error: 'TOKEN SESI TIDAK VALID'
    }
  }[lang];

  const handleKeyPress = (key: string) => {
    setError('');
    if (key === 'BACK') {
      setToken(prev => prev.slice(0, -1));
    } else if (key === 'CLEAR') {
      setToken('');
    } else {
      if (token.length < 24) setToken(prev => prev + key);
    }
  };

  const handleSubmit = () => {
    const normalizedToken = token.toUpperCase();
    if (normalizedToken === 'STUDENTID') {
      onLogin({ token: normalizedToken, type: 'STUDENT', expiresAt: Date.now() + 3600000 });
    } else if (normalizedToken === 'ADMINID') {
      onLogin({ token: normalizedToken, type: 'ADMIN', expiresAt: Date.now() + 86400000 });
    } else if (normalizedToken === DEV_PASSCODE) {
      onLogin({ token: normalizedToken, type: 'DEVELOPER', expiresAt: Date.now() + 86400000 });
    } else {
      setError(t.error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`h-full w-full p-4 flex flex-col items-center justify-between transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#fdfcfb]'}`}
    >
      <div className="w-full flex justify-between items-start mt-2 px-2">
        <div className="w-10" /> {/* Spacer */}
        <div className="text-center">
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{t.title}</h1>
          <p className="text-gray-400 text-[9px] uppercase tracking-widest mt-0.5">{t.subtitle}</p>
        </div>
        <button 
          onClick={onSettings}
          className={`p-2 rounded-xl transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-400'}`}
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      <div className="w-full flex flex-col items-center space-y-2 my-2">
        <div className={`w-full max-w-xs h-12 border-2 rounded-2xl flex items-center justify-center terminal-shadow transition-all duration-300 ${
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        } ${error ? 'border-red-400' : 'border-green-100'}`}>
          <span className={`text-base font-bold tracking-widest font-mono truncate px-4 ${error ? 'text-red-500' : 'text-green-600'}`}>
            {token || (error ? 'ERROR' : '____-____')}
          </span>
          <motion.div 
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="w-0.5 h-4 bg-green-500 ml-1"
          />
        </div>
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[9px] text-red-500 font-bold uppercase tracking-tight"
          >
            {error}
          </motion.p>
        )}
      </div>

      <div className="w-full space-y-3">
        <Keypad onKeyPress={handleKeyPress} theme={theme} />
        <button
          onClick={handleSubmit}
          className="w-full py-3.5 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-transform uppercase tracking-widest text-xs"
        >
          {t.claim}
        </button>
      </div>

      <div className="mt-2 text-[8px] text-gray-300 font-mono flex flex-col items-center space-y-1">
        <div>EDUFIKA_SECURE_AUTH // V3.11.2</div>
        <div className="opacity-50 tracking-widest">©TECHIVIBES</div>
      </div>
    </motion.div>
  );
};

export default LoginScreen;
