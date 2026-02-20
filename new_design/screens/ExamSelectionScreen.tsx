
import React from 'react';
import { motion } from 'framer-motion';
import { QrCode, Link as LinkIcon, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';

interface ExamSelectionScreenProps {
  onManualInput: () => void;
  onQRScan: () => void;
  onBack: () => void;
  onSettings: () => void;
  lang: 'en' | 'id';
  theme: 'light' | 'dark';
}

const ExamSelectionScreen: React.FC<ExamSelectionScreenProps> = ({ 
  onManualInput, onQRScan, onBack, onSettings, lang, theme 
}) => {
  const t = {
    en: {
      title: 'Exam Method',
      subtitle: 'Choose how you want to join the exam session.',
      qrTitle: 'Scan QR Code',
      qrSub: 'Scan printed proctor code',
      manualTitle: 'Manual URL',
      manualSub: 'Enter link manually',
      disclaimer: 'By continuing, you agree to the terminal session monitor. Any attempts to leave the application will be logged and reported to the proctor panel.'
    },
    id: {
      title: 'Metode Ujian',
      subtitle: 'Pilih cara Anda ingin bergabung dengan sesi ujian.',
      qrTitle: 'Pindai Kode QR',
      qrSub: 'Pindai kode cetak proktor',
      manualTitle: 'URL Manual',
      manualSub: 'Masukkan tautan secara manual',
      disclaimer: 'Dengan melanjutkan, Anda menyetujui monitor sesi terminal. Segala upaya untuk meninggalkan aplikasi akan dicatat dan dilaporkan ke panel proktor.'
    }
  }[lang];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`h-full w-full p-6 flex flex-col transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#fdfcfb]'}`}
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className={`p-2 -ml-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-green-400' : 'text-gray-400 hover:text-green-600'}`}>
          <ArrowLeft size={24} />
        </button>
        <button 
          onClick={onSettings}
          className={`p-2 rounded-xl transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-400 border border-gray-100 shadow-sm'}`}
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      <div className="mb-12">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{t.title}</h2>
        <p className="text-gray-400 text-sm mt-1">{t.subtitle}</p>
      </div>

      <div className="space-y-4 flex-1">
        <button 
          className={`w-full p-6 border-2 rounded-3xl flex items-center space-x-6 transition-all group ${
            theme === 'dark' 
            ? 'bg-gray-900 border-green-900/30 hover:bg-green-900/10' 
            : 'bg-white border-green-100 hover:bg-green-50'
          }`}
          onClick={onQRScan}
        >
          <div className="w-16 h-16 bg-green-100 bg-opacity-10 rounded-2xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
            <QrCode size={32} />
          </div>
          <div className="text-left">
            <div className={`font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{t.qrTitle}</div>
            <div className="text-xs text-gray-400">{t.qrSub}</div>
          </div>
        </button>

        <button 
          className={`w-full p-6 border-2 rounded-3xl flex items-center space-x-6 transition-all group ${
            theme === 'dark' 
            ? 'bg-gray-900 border-blue-900/30 hover:bg-blue-900/10' 
            : 'bg-white border-blue-50 hover:bg-blue-50'
          }`}
          onClick={onManualInput}
        >
          <div className="w-16 h-16 bg-blue-100 bg-opacity-10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
            <LinkIcon size={32} />
          </div>
          <div className="text-left">
            <div className={`font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{t.manualTitle}</div>
            <div className="text-xs text-gray-400">{t.manualSub}</div>
          </div>
        </button>
      </div>

      <div className="space-y-4">
        <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
          <p className="text-[10px] text-gray-400 leading-tight">
            {t.disclaimer}
          </p>
        </div>
        <div className="text-center text-[8px] text-gray-300 font-mono tracking-widest uppercase opacity-40">
          ©techivibes
        </div>
      </div>
    </motion.div>
  );
};

export default ExamSelectionScreen;
