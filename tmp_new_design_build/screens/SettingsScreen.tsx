
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, Sun, Moon, Monitor, Check } from 'lucide-react';

interface SettingsScreenProps {
  lang: 'en' | 'id';
  theme: 'light' | 'dark';
  brightness: number;
  onBack: () => void;
  onSetLanguage: (l: 'en' | 'id') => void;
  onSetTheme: (t: 'light' | 'dark') => void;
  onSetBrightness: (b: number) => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  lang,
  theme,
  brightness,
  onBack,
  onSetLanguage,
  onSetTheme,
  onSetBrightness
}) => {
  const t = {
    en: {
      title: 'Settings',
      subtitle: 'System Configuration',
      language: 'Language',
      brightness: 'Brightness',
      theme: 'Appearance',
      light: 'Light',
      dark: 'Dark',
      done: 'Apply Changes'
    },
    id: {
      title: 'Pengaturan',
      subtitle: 'Konfigurasi Sistem',
      language: 'Bahasa',
      brightness: 'Kecerahan',
      theme: 'Tampilan',
      light: 'Terang',
      dark: 'Gelap',
      done: 'Terapkan Perubahan'
    }
  }[lang];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`h-full w-full p-6 flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a] text-gray-100' : 'bg-[#fdfcfb] text-gray-800'}`}
    >
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className={`p-2 -ml-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-green-400' : 'text-gray-400 hover:text-green-600'}`}>
          <ArrowLeft size={24} />
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold">{t.title}</h2>
          <p className="text-[10px] uppercase tracking-widest text-green-500 font-bold">{t.subtitle}</p>
        </div>
      </div>

      <div className="flex-1 space-y-8">
        {/* Language Section */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-gray-400">
            <Globe size={16} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">{t.language}</h3>
          </div>
          <div className="flex space-x-3">
            {[
              { id: 'en', label: 'English' },
              { id: 'id', label: 'Bahasa' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSetLanguage(item.id as 'en' | 'id')}
                className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all flex items-center justify-center space-x-2 ${
                  lang === item.id 
                  ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-900/20' 
                  : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-100 text-gray-400')
                }`}
              >
                {lang === item.id && <Check size={16} />}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Theme Section */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 text-gray-400">
            <Monitor size={16} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">{t.theme}</h3>
          </div>
          <div className="flex space-x-3">
            {[
              { id: 'light', label: t.light, icon: Sun },
              { id: 'dark', label: t.dark, icon: Moon }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSetTheme(item.id as 'light' | 'dark')}
                className={`flex-1 py-4 rounded-2xl border-2 font-bold transition-all flex flex-col items-center space-y-2 ${
                  theme === item.id 
                  ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-900/20' 
                  : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-100 text-gray-400')
                }`}
              >
                <item.icon size={20} />
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Brightness Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-gray-400">
              <Sun size={16} />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">{t.brightness}</h3>
            </div>
            <span className="font-mono text-xs text-green-500">{brightness}%</span>
          </div>
          <div className="relative h-12 flex items-center">
            <input 
              type="range"
              min="20"
              max="100"
              value={brightness}
              onChange={(e) => onSetBrightness(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500 transition-colors dark:bg-gray-700"
            />
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 uppercase tracking-widest font-mono">
            <span>Dim</span>
            <span>Default</span>
            <span>Max</span>
          </div>
        </section>
      </div>

      <div className="mt-auto space-y-4">
        <button
          onClick={onBack}
          className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-transform"
        >
          {t.done}
        </button>
        <div className="text-center text-[8px] text-gray-500 font-mono tracking-widest uppercase opacity-40">
          ©techivibes // sys_config_lock
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsScreen;
