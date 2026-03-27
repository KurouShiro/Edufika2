
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import ExamSelectionScreen from './screens/ExamSelectionScreen';
import ExamBrowserScreen from './screens/ExamBrowserScreen';
import ViolationScreen from './screens/ViolationScreen';
import AdminDashboard from './screens/AdminDashboard';
import DevPanel from './screens/DevPanel';
import ManualInputScreen from './screens/ManualInputScreen';
import SuccessScreen from './screens/SuccessScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import SettingsScreen from './screens/SettingsScreen';
import { AppScreen, SessionInfo } from './types';

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>('SPLASH');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [examUrl, setExamUrl] = useState<string>('');
  const [violationType, setViolationType] = useState<string>('');
  
  // Settings State
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brightness, setBrightness] = useState(100);

  const navigate = useCallback((target: AppScreen) => {
    setScreen(target);
  }, []);

  const handleViolation = (type: string) => {
    setViolationType(type);
    navigate('VIOLATION');
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && screen === 'EXAM_BROWSER') {
        handleViolation('BACKGROUND_ACTIVITY');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [screen]);

  // Brightness Overlay Opacity: 0 when 100%, 0.8 when 20%
  const brightnessOverlayOpacity = useMemo(() => (100 - brightness) / 100 * 0.8, [brightness]);

  return (
    <div className={`h-screen w-screen overflow-hidden flex items-center justify-center font-mono transition-colors duration-500 ${theme === 'dark' ? 'bg-[#121212]' : 'bg-[#fdfcfb]'}`}>
      {/* Mobile Frame Simulation for Web Preview */}
      <div className={`relative w-full h-full max-w-md mx-auto shadow-2xl border-x overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-100'}`}>
        
        {/* Brightness Simulation Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none z-[9999] bg-black" 
          style={{ opacity: brightnessOverlayOpacity }}
        />

        <AnimatePresence mode="wait">
          {screen === 'SPLASH' && (
            <SplashScreen key="splash" onComplete={() => navigate('LOGIN')} />
          )}
          {screen === 'LOGIN' && (
            <LoginScreen 
              key="login" 
              lang={language}
              theme={theme}
              onSettings={() => navigate('SETTINGS')}
              onLogin={(sess) => {
                setSession(sess);
                if (sess.type === 'ADMIN') navigate('ADMIN_DASHBOARD');
                else if (sess.type === 'DEVELOPER') navigate('DEV_PANEL');
                else navigate('EXAM_SELECTION');
              }} 
            />
          )}
          {screen === 'SETTINGS' && (
            <SettingsScreen
              key="settings"
              lang={language}
              theme={theme}
              brightness={brightness}
              onBack={() => {
                // Return to appropriate screen
                if (!session) navigate('LOGIN');
                else if (session.type === 'ADMIN') navigate('ADMIN_DASHBOARD');
                else if (session.type === 'DEVELOPER') navigate('DEV_PANEL');
                else navigate('EXAM_SELECTION');
              }}
              onSetLanguage={setLanguage}
              onSetTheme={setTheme}
              onSetBrightness={setBrightness}
            />
          )}
          {screen === 'EXAM_SELECTION' && (
            <ExamSelectionScreen 
              key="selection" 
              lang={language}
              theme={theme}
              onSettings={() => navigate('SETTINGS')}
              onManualInput={() => navigate('MANUAL_INPUT')}
              onQRScan={() => navigate('QR_SCAN')}
              onBack={() => navigate('LOGIN')}
            />
          )}
          {screen === 'QR_SCAN' && (
            <QRScannerScreen
              key="qr_scan"
              onScan={(url) => {
                setExamUrl(url);
                navigate('EXAM_BROWSER');
              }}
              onBack={() => navigate('EXAM_SELECTION')}
            />
          )}
          {screen === 'MANUAL_INPUT' && (
            <ManualInputScreen 
              key="manual"
              onStart={(url) => {
                setExamUrl(url);
                navigate('EXAM_BROWSER');
              }}
              onBack={() => navigate('EXAM_SELECTION')}
            />
          )}
          {screen === 'EXAM_BROWSER' && (
            <ExamBrowserScreen 
              key="browser"
              url={examUrl}
              session={session}
              theme={theme}
              onFinish={() => navigate('SUCCESS')}
              onViolation={handleViolation}
            />
          )}
          {screen === 'VIOLATION' && (
            <ViolationScreen 
              key="violation"
              type={violationType}
              onReset={() => navigate('LOGIN')}
            />
          )}
          {screen === 'ADMIN_DASHBOARD' && (
            <AdminDashboard 
              key="admin"
              lang={language}
              theme={theme}
              onSettings={() => navigate('SETTINGS')}
              onLogout={() => {
                setSession(null);
                navigate('LOGIN');
              }}
            />
          )}
          {screen === 'DEV_PANEL' && (
            <DevPanel 
              key="dev"
              lang={language}
              theme={theme}
              onSettings={() => navigate('SETTINGS')}
              onLogout={() => {
                setSession(null);
                navigate('LOGIN');
              }}
            />
          )}
          {screen === 'SUCCESS' && (
            <SuccessScreen 
              key="success"
              onHome={() => navigate('LOGIN')}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
