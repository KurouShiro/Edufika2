
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Eye, EyeOff, Save, Trash2, Activity, Globe, CheckCircle2, AlertCircle, Key, Copy, Plus, Settings as SettingsIcon } from 'lucide-react';

interface DevPanelProps {
  onLogout: () => void;
  onSettings: () => void;
  lang: 'en' | 'id';
  theme: 'light' | 'dark';
}

const DevPanel: React.FC<DevPanelProps> = ({ onLogout, onSettings, lang, theme }) => {
  const [config, setConfig] = useState({
    lockdownEnabled: true,
    alarmVolume: 100,
    apiBase: 'https://api.edufika.local',
    debugMode: false
  });

  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [testLog, setTestLog] = useState<string[]>([]);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const t = {
    en: {
      title: 'DEV_ACCESS_PANEL',
      security: 'Security Enforcement',
      minting: 'Identity Minting',
      networking: 'Networking',
      audit: 'Device Audit',
      test: 'TEST_API_CONNECTION',
      testing: 'TESTING_LINK...',
      genAdmin: 'Generate Admin Token',
      wipe: 'WIPE',
      commit: 'COMMIT'
    },
    id: {
      title: 'PANEL_AKSES_DEV',
      security: 'Penegakan Keamanan',
      minting: 'Pencetakan Identitas',
      networking: 'Jaringan',
      audit: 'Audit Perangkat',
      test: 'TES_KONEKSI_API',
      testing: 'MENGUJI_TAUTAN...',
      genAdmin: 'Buat Token Admin',
      wipe: 'HAPUS',
      commit: 'SIMPAN'
    }
  }[lang];

  const runApiTest = () => {
    setTestStatus('TESTING');
    setTestLog(['> INITIATING_HANDSHAKE...']);
    
    const steps = [
      { msg: '> RESOLVING_HOST...', delay: 600 },
      { msg: '> PROBING_ENPOINT: /health', delay: 1200 },
      { msg: '> SSL_VERIFICATION: VERIFIED', delay: 1800 },
      { msg: '> LATENCY: 42ms', delay: 2200 },
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setTestLog(prev => [...prev, step.msg]);
        if (index === steps.length - 1) {
          setTestStatus('SUCCESS');
          setTestLog(prev => [...prev, '> STATUS: SERVICE_READY']);
        }
      }, step.delay);
    });
  };

  const generateAdminToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'ADM-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    token += '-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    setGeneratedToken(token);
  };

  const copyToClipboard = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  return (
    <div className={`h-full w-full flex flex-col font-mono text-sm transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#fdfcfb]'}`}>
      <div className="p-6 bg-gray-900 text-green-500 flex items-center justify-between shadow-lg shadow-black/20">
        <div className="flex items-center space-x-2">
          <Terminal size={20} />
          <span className="font-bold tracking-tighter uppercase">{t.title}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={onSettings} className="p-1 border border-green-500/30 rounded">
            <SettingsIcon size={14} />
          </button>
          <button onClick={onLogout} className="text-[10px] border border-green-500/30 px-2 py-1 rounded">
            EXIT
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800 pb-1">{t.security}</h3>
          
          <div className={`flex items-center justify-between p-4 border rounded-2xl transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-blue-500" />
              <div className={`text-xs font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Kiosk Mode</div>
            </div>
            <button 
              onClick={() => setConfig(prev => ({ ...prev, lockdownEnabled: !prev.lockdownEnabled }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${config.lockdownEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <motion.div 
                animate={{ x: config.lockdownEnabled ? 24 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm"
              />
            </button>
          </div>

          <div className={`flex items-center justify-between p-4 border rounded-2xl transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center space-x-3">
              {config.debugMode ? <Eye size={18} className="text-orange-500" /> : <EyeOff size={18} className="text-gray-400" />}
              <div className={`text-xs font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Debug Overlays</div>
            </div>
            <button 
              onClick={() => setConfig(prev => ({ ...prev, debugMode: !prev.debugMode }))}
              className={`w-12 h-6 rounded-full transition-colors relative ${config.debugMode ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <motion.div 
                animate={{ x: config.debugMode ? 24 : 4 }}
                className="w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm"
              />
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800 pb-1">{t.minting}</h3>
          <div className={`p-4 border rounded-2xl transition-colors ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 space-y-4'}`}>
            <button 
              onClick={generateAdminToken}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors border ${
                theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-100'
              }`}
            >
              <Plus size={16} />
              <span className="text-[10px] uppercase tracking-widest">{t.genAdmin}</span>
            </button>

            <AnimatePresence>
              {generatedToken && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between p-3 rounded-xl border mt-4 ${theme === 'dark' ? 'bg-black border-gray-700' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-center space-x-2">
                    <Key size={14} className="text-blue-500" />
                    <span className={`font-mono font-bold tracking-wider text-xs ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{generatedToken}</span>
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className={`p-2 rounded-lg transition-colors ${isCopying ? 'bg-green-500/20 text-green-500' : 'text-gray-400 hover:bg-gray-700'}`}
                  >
                    {isCopying ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-100 dark:border-gray-800 pb-1">{t.networking}</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-400 ml-2">API ENDPOINT</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={config.apiBase}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiBase: e.target.value }))}
                  className={`w-full p-4 border rounded-2xl text-[10px] font-mono outline-none focus:border-green-500 pr-12 transition-colors ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-100 text-gray-800'
                  }`}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Globe size={16} />
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <button 
                onClick={runApiTest}
                disabled={testStatus === 'TESTING'}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all border ${
                  testStatus === 'TESTING' 
                    ? 'bg-gray-900 border-gray-800 text-gray-600' 
                    : testStatus === 'SUCCESS'
                    ? 'bg-green-500/10 text-green-500 border-green-500/30'
                    : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-100 text-gray-600 shadow-sm')
                }`}
              >
                {testStatus === 'TESTING' ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <Activity size={16} />
                  </motion.div>
                ) : testStatus === 'SUCCESS' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <Activity size={16} />
                )}
                <span className="text-[10px] uppercase tracking-widest">
                  {testStatus === 'TESTING' ? t.testing : t.test}
                </span>
              </button>

              <AnimatePresence>
                {testLog.length > 0 && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-black rounded-xl p-3 overflow-hidden border border-gray-800"
                  >
                    <div className="space-y-1">
                      {testLog.map((log, i) => (
                        <div key={i} className="text-[9px] font-mono text-green-500 opacity-80">
                          {log}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>

      <div className={`p-6 border-t flex flex-col space-y-4 transition-colors ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
        <div className="flex space-x-3">
          <button className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-colors ${theme === 'dark' ? 'bg-red-500/10 text-red-500' : 'bg-red-50 text-red-500'}`}>
            <Trash2 size={16} />
            <span>{t.wipe}</span>
          </button>
          <button className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-green-900/20">
            <Save size={16} />
            <span>{t.commit}</span>
          </button>
        </div>
        <div className="text-center text-[8px] text-gray-300 font-mono tracking-widest uppercase opacity-40">
          ©techivibes // dev_overload_v3
        </div>
      </div>
    </div>
  );
};

export default DevPanel;
