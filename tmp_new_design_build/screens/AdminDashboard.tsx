
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileText, Settings as SettingsIcon, Plus, ShieldAlert, LogOut, Copy, Download, Key, Check, X, ShieldCheck, Clock, Zap, Info, Monitor, Smartphone, Globe, AlertCircle } from 'lucide-react';
import { MOCK_TOKENS } from '../constants';
import { TokenStatus } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
  onSettings: () => void;
  lang: 'en' | 'id';
  theme: 'light' | 'dark';
}

interface StudentDetail extends TokenStatus {
  ipAddress: string;
  deviceName: string;
  sessionStart: string;
  timeRemaining: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSettings, lang, theme }) => {
  const [activeTab, setActiveTab] = useState('MONITOR');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [proctorPin, setProctorPin] = useState('1234');
  const [tempPin, setTempPin] = useState('1234');
  
  // Generation Config State
  const [sessionDuration, setSessionDuration] = useState('60');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const t = {
    en: {
      title: 'Proctor Panel',
      server: 'Server: Online',
      monitor: 'MONITOR',
      tokens: 'TOKENS',
      logs: 'LOGS',
      active: 'Active',
      alerts: 'Alerts',
      generate: 'GENERATE SESSION',
      newReady: 'New Token Ready',
      copy: 'COPY TO CLIPBOARD',
      download: 'Download logger.txt',
      pin: 'PROCTOR_PIN',
      mintTitle: 'Configure Session',
      mintSubtitle: 'Set parameters for the new exam token',
      durationLabel: 'Session Duration (Min)',
      proctorPinLabel: 'Verification PIN',
      mintAction: 'Mint Token',
      profileTitle: 'Token Profile',
      device: 'Device Name',
      ip: 'IP Address',
      started: 'Session Start',
      timer: 'Remaining',
      risk: 'Risk Score'
    },
    id: {
      title: 'Panel Proktor',
      server: 'Server: Terhubung',
      monitor: 'PANTAU',
      tokens: 'TOKEN',
      logs: 'LOG',
      active: 'Aktif',
      alerts: 'Peringatan',
      generate: 'BUAT SESI',
      newReady: 'Token Baru Tersedia',
      copy: 'SALIN KE PAPAN KLIP',
      download: 'Unduh logger.txt',
      pin: 'PIN_PROKTOR',
      mintTitle: 'Konfigurasi Sesi',
      mintSubtitle: 'Atur parameter untuk token ujian baru',
      durationLabel: 'Durasi Sesi (Menit)',
      proctorPinLabel: 'PIN Verifikasi',
      mintAction: 'Cetak Token',
      profileTitle: 'Profil Token',
      device: 'Nama Perangkat',
      ip: 'Alamat IP',
      started: 'Sesi Dimulai',
      timer: 'Sisa Waktu',
      risk: 'Skor Risiko'
    }
  }[lang];

  const mockLogs = [
    `[${new Date().toISOString()}] SESSION_STARTED: ID_A7X-982Q`,
    `[${new Date().toISOString()}] HEARTBEAT_SYNC: DEVICE_ID_8821`,
    `[${new Date().toISOString()}] VIOLATION_REPORTED: BACKGROUND_ACTIVITY (ST-1144)`,
    `[${new Date().toISOString()}] TOKEN_EXPIRED: ID_B22-441P`,
    `[${new Date().toISOString()}] PROCTOR_AUTH_SUCCESS: EXIT_GRANTED`,
  ].join('\n');

  const handleDownloadLogs = () => {
    const element = document.createElement("a");
    const file = new Blob([mockLogs], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "logger.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSavePin = () => {
    if (tempPin.length === 4) {
      setProctorPin(tempPin);
      setIsPinModalOpen(false);
    } else {
      alert("PIN must be 4 digits");
    }
  };

  const handleMintToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 3; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    token += '-';
    for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    
    setGeneratedToken(token);
    setIsGenerateModalOpen(false);
  };

  const openStudentProfile = (student: any) => {
    // Adding mock metadata for the detailed profile view
    const detailedStudent: StudentDetail = {
      ...student,
      ipAddress: student.id === 'ST-9021' ? '192.168.1.45' : student.id === 'ST-1144' ? '10.0.0.22' : '172.16.5.101',
      deviceName: student.id === 'ST-9021' ? 'Samsung Galaxy Tab S7' : student.id === 'ST-1144' ? 'Redmi Note 10 Pro' : 'iPad Air (Gen 4)',
      sessionStart: '08:42:15 AM',
      timeRemaining: student.status === 'ACTIVE' ? '45m 12s' : student.status === 'LOCKED' ? 'PAUSED' : '00m 00s'
    };
    setSelectedStudent(detailedStudent);
  };

  return (
    <div className={`h-full w-full flex flex-col relative overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-[#fdfcfb]'}`}>
      {/* Admin Header */}
      <div className={`p-6 border-b flex items-center justify-between transition-colors ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
        <div>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{t.title}</h2>
          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t.server}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onSettings}
            className={`p-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-green-400' : 'text-gray-400 hover:text-green-600'}`}
          >
            <SettingsIcon size={20} />
          </button>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b transition-colors ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
        {['MONITOR', 'TOKENS', 'LOGS'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 text-[10px] font-bold tracking-widest transition-all duration-300 ${
              activeTab === tab 
              ? 'text-green-600 border-b-2 border-green-500' 
              : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t[tab.toLowerCase() as keyof typeof t] || tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'MONITOR' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t.active}</div>
                <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>12</div>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-50'}`}>
                <div className="text-[10px] text-red-400 uppercase font-bold mb-1">{t.alerts}</div>
                <div className="text-2xl font-bold text-red-600">02</div>
              </div>
            </div>

            <h4 className="text-[10px] uppercase font-bold text-gray-400 ml-2 mt-4">Active Students</h4>
            <div className="space-y-3">
              {MOCK_TOKENS.map((student) => (
                <button 
                  key={student.id} 
                  onClick={() => openStudentProfile(student)}
                  className={`w-full text-left p-4 border rounded-2xl flex items-center justify-between group transition-all active:scale-[0.98] ${
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:border-green-800' : 'bg-white border-gray-100 hover:border-green-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      student.status === 'LOCKED' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      <Users size={20} />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{student.studentName}</div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: {student.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 rounded text-[8px] font-bold ${
                      student.status === 'LOCKED' ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700'
                    }`}>
                      {student.status}
                    </div>
                    <Info size={14} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'TOKENS' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <button 
              onClick={() => setIsGenerateModalOpen(true)}
              className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 flex items-center justify-center space-x-2 active:scale-95 transition-transform"
            >
              <Plus size={20} />
              <span>{t.generate}</span>
            </button>

            <div className={`p-6 border-2 border-dashed rounded-3xl text-center ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-2">{t.newReady}</div>
              <div className={`text-3xl font-bold tracking-widest mb-4 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                {generatedToken || 'A7X-982Q'}
              </div>
              <button 
                onClick={() => {
                  if(generatedToken) navigator.clipboard.writeText(generatedToken);
                  else navigator.clipboard.writeText('A7X-982Q');
                }}
                className="flex items-center space-x-2 mx-auto text-green-600 text-xs font-bold active:text-green-800"
              >
                <Copy size={14} />
                <span>{t.copy}</span>
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'LOGS' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className={`rounded-2xl p-4 font-mono text-[9px] min-h-[200px] border shadow-inner overflow-hidden relative ${
              theme === 'dark' ? 'bg-black border-gray-800 text-green-400' : 'bg-gray-900 border-gray-800 text-green-500'
            }`}>
              <div className="absolute top-2 right-2 flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-red-500/30" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
                <div className="w-2 h-2 rounded-full bg-green-500/30" />
              </div>
              <div className="space-y-2 opacity-80">
                {mockLogs.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                <div className="animate-pulse">_</div>
              </div>
            </div>

            <button 
              onClick={handleDownloadLogs}
              className={`w-full py-4 rounded-2xl font-bold shadow-sm flex items-center justify-center space-x-2 transition-colors ${
                theme === 'dark' ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-white border border-gray-100 text-gray-600'
              }`}
            >
              <Download size={18} className="text-green-500" />
              <span className="text-xs uppercase tracking-widest">{t.download}</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Footer Navigation Overlay */}
      <div className="p-4 space-y-2">
        <div className={`rounded-2xl p-4 flex items-center justify-between text-white shadow-xl ${
          theme === 'dark' ? 'bg-gray-800 shadow-black/40' : 'bg-gray-900 shadow-black/10'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="text-[10px] font-bold tracking-widest uppercase">
              {t.pin}: <span className="text-green-400 font-mono tracking-normal">{proctorPin}</span>
            </div>
          </div>
          <button 
            onClick={() => {
              setTempPin(proctorPin);
              setIsPinModalOpen(true);
            }}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <Key size={16} />
          </button>
        </div>
        <div className="text-center text-[8px] text-gray-300 font-mono tracking-widest uppercase opacity-40">
          ©techivibes
        </div>
      </div>

      {/* Student Token Profile Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`rounded-[32px] w-full max-w-sm p-8 shadow-2xl relative overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 bg-opacity-5 rounded-full -mr-16 -mt-16" />
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/20 text-green-500' : 'bg-green-50 text-green-500'}`}>
                    <Users size={28} />
                  </div>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-6">
                  <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{selectedStudent.studentName}</h3>
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400">
                    <span className="uppercase tracking-widest">UID:</span>
                    <span>{selectedStudent.id}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {/* Detailed Profile Rows */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center space-x-2">
                      <Smartphone size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.device}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{selectedStudent.deviceName}</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center space-x-2">
                      <Globe size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.ip}</span>
                    </div>
                    <span className="text-[10px] font-mono text-green-600">{selectedStudent.ipAddress}</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center space-x-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.timer}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${selectedStudent.status === 'LOCKED' ? 'text-red-500' : 'text-green-600'}`}>{selectedStudent.timeRemaining}</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center space-x-2">
                      <Zap size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.started}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{selectedStudent.sessionStart}</span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={14} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.risk}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${selectedStudent.riskScore > 10 ? 'text-red-500' : 'text-green-600'}`}>{selectedStudent.riskScore}.00</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-400'}`}
                  >
                    CLOSE
                  </button>
                  <button 
                    className={`flex-[2] py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-transform ${
                      selectedStudent.status === 'LOCKED' ? 'bg-red-500 shadow-red-900/20' : 'bg-green-500 shadow-green-900/20'
                    }`}
                  >
                    {selectedStudent.status === 'LOCKED' ? <ShieldAlert size={18} /> : <Zap size={18} />}
                    <span className="text-[10px] uppercase tracking-widest">
                      {selectedStudent.status === 'LOCKED' ? 'AUTHORIZE_UNLOCK' : 'REVOKE_SESSION'}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generation Config Modal */}
      <AnimatePresence>
        {isGenerateModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`rounded-[32px] w-full max-w-sm p-8 shadow-2xl relative overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-green-500 bg-opacity-5 rounded-full -ml-16 -mt-16" />
              
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 bg-blue-500 bg-opacity-10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Zap size={32} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{t.mintTitle}</h3>
                <p className="text-xs text-gray-400 mb-8">{t.mintSubtitle}</p>

                <div className="space-y-6">
                  <div className="space-y-2 text-left">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                      <Clock size={12} />
                      <span>{t.durationLabel}</span>
                    </div>
                    <input 
                      type="number"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(e.target.value)}
                      className={`w-full h-14 px-4 text-center text-xl font-mono font-bold border-2 rounded-2xl outline-none focus:border-blue-400 transition-all ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-gray-50 border-gray-100 text-gray-800'
                      }`}
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                      <Key size={12} />
                      <span>{t.proctorPinLabel}</span>
                    </div>
                    <input 
                      type="password"
                      maxLength={4}
                      value={proctorPin}
                      readOnly
                      className={`w-full h-14 px-4 text-center text-xl font-mono font-bold border-2 rounded-2xl outline-none opacity-60 ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-gray-50 border-gray-100 text-gray-800'
                      }`}
                    />
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button 
                      onClick={() => setIsGenerateModalOpen(false)}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-400'}`}
                    >
                      <X size={18} className="mx-auto" />
                    </button>
                    <button 
                      onClick={handleMintToken}
                      className="flex-[2] py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2 active:scale-95 transition-transform"
                    >
                      <Zap size={18} />
                      <span className="text-[10px] uppercase tracking-widest">{t.mintAction}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Modal */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`rounded-[32px] w-full max-w-sm p-8 shadow-2xl relative overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white'}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 bg-opacity-5 rounded-full -mr-16 -mt-16" />
              
              <div className="text-center relative z-10">
                <div className="w-16 h-16 bg-green-100 bg-opacity-10 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Key size={32} />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>Security Policy</h3>
                <p className="text-xs text-gray-400 mb-8 px-4">
                  Configure the proctor PIN for manual override.
                </p>

                <div className="space-y-6">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{t.pin}</label>
                    <input 
                      type="text"
                      maxLength={4}
                      placeholder="____"
                      value={tempPin}
                      onChange={(e) => setTempPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className={`w-full h-16 text-center text-3xl font-mono font-bold tracking-[0.5em] border-2 rounded-2xl outline-none focus:border-green-400 transition-all ${
                        theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-100' : 'bg-gray-50 border-gray-100 text-gray-800'
                      }`}
                    />
                  </div>

                  <div className="flex space-x-4 pt-2">
                    <button 
                      onClick={() => setIsPinModalOpen(false)}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-colors ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-400'}`}
                    >
                      <X size={18} className="mx-auto" />
                    </button>
                    <button 
                      onClick={handleSavePin}
                      className="flex-[2] py-4 bg-green-500 text-white rounded-2xl font-bold shadow-lg shadow-green-900/20 flex items-center justify-center space-x-2 active:scale-95 transition-transform"
                    >
                      <Check size={18} />
                      <span className="text-[10px] uppercase tracking-widest">Update</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
