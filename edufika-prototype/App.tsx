import React, { createContext, useState } from 'react';
import { AUTH, TRANSLATIONS } from './constants';
import { DigitizedView } from './components/DigitizedView';
import AdminDashboardPanel from './screens/AdminDashboardPanel';
import DeveloperAccessScreen from './screens/DeveloperAccessScreen';
import ExamBrowserScreen from './screens/ExamBrowserScreen';
import ExamSelectionScreen from './screens/ExamSelectionScreen';
import LoginScreen from './screens/LoginScreen';
import ManualInputScreen from './screens/ManualInputScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import SettingsScreen from './screens/SettingsScreen';
import SplashScreen from './screens/SplashScreen';
import SuccessScreen from './screens/SuccessScreen';
import ViolationScreen from './screens/ViolationScreen';

type Screen =
  | 'SPLASH'
  | 'LOGIN'
  | 'SELECTION'
  | 'MANUAL'
  | 'SCAN'
  | 'EXAM'
  | 'VIOLATION'
  | 'ADMIN'
  | 'DEV_PANEL'
  | 'SUCCESS'
  | 'SETTINGS';

type LanguageCode = 'EN' | 'ID';

export const LanguageContext = createContext({
  lang: 'EN' as LanguageCode,
  t: TRANSLATIONS.EN,
  setLang: (_lang: LanguageCode) => undefined,
});

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('SPLASH');
  const [lang, setLang] = useState<LanguageCode>('EN');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [userRole, setUserRole] = useState<'STUDENT' | 'ADMIN' | 'DEVELOPER' | null>(null);

  const handleLogout = () => {
    setSelectedUrl('');
    setUserRole(null);
    setCurrentScreen('LOGIN');
  };

  const handleLogin = (token: string) => {
    const input = token.trim().toLowerCase();

    if (input === AUTH.STUDENT_TOKEN.toLowerCase()) {
      setUserRole('STUDENT');
      setCurrentScreen('SELECTION');
      return;
    }

    if (input === AUTH.ADMIN_TOKEN.toLowerCase()) {
      setUserRole('ADMIN');
      setCurrentScreen('ADMIN');
      return;
    }

    if (input === AUTH.DEV_TOKEN.toLowerCase()) {
      setUserRole('DEVELOPER');
      setCurrentScreen('DEV_PANEL');
      return;
    }

    alert('AUTH_FAIL: ACCESS_DENIED');
  };

  const startExam = (url: string) => {
    setSelectedUrl(url);
    setCurrentScreen('EXAM');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'SPLASH':
        return <SplashScreen onFinish={() => setCurrentScreen('LOGIN')} />;
      case 'LOGIN':
        return <LoginScreen onLogin={handleLogin} />;
      case 'SELECTION':
        return (
          <ExamSelectionScreen
            onManual={() => setCurrentScreen('MANUAL')}
            onScan={() => setCurrentScreen('SCAN')}
            onSettings={() => setCurrentScreen('SETTINGS')}
          />
        );
      case 'MANUAL':
        return <ManualInputScreen onConfirm={startExam} onBack={() => setCurrentScreen('SELECTION')} />;
      case 'SCAN':
        return <QRScannerScreen onResult={startExam} onBack={() => setCurrentScreen('SELECTION')} />;
      case 'SETTINGS':
        return (
          <SettingsScreen
            onBack={() => setCurrentScreen(userRole === 'DEVELOPER' ? 'DEV_PANEL' : 'SELECTION')}
            role={userRole}
          />
        );
      case 'ADMIN':
        return <AdminDashboardPanel onLogout={handleLogout} />;
      case 'DEV_PANEL':
        return <DeveloperAccessScreen onBack={handleLogout} />;
      case 'EXAM':
        return (
          <ExamBrowserScreen
            url={selectedUrl}
            onFinish={() => setCurrentScreen('SUCCESS')}
            onViolation={() => setCurrentScreen('VIOLATION')}
          />
        );
      case 'SUCCESS':
        return <SuccessScreen onRestart={handleLogout} />;
      case 'VIOLATION':
        return <ViolationScreen onResolve={handleLogout} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, t: TRANSLATIONS[lang], setLang }}>
      <div className="min-h-screen bg-[#050505] text-[#39ff14]">
        <div className="relative min-h-screen">
          <DigitizedView key={currentScreen}>{renderScreen()}</DigitizedView>
          <div className="pointer-events-none absolute bottom-2 left-4 text-[8px] uppercase tracking-[0.32em] opacity-30">
            EDUFIKA_CORE_v1.0.2 // SECURE_ACTIVE
          </div>
        </div>
      </div>
    </LanguageContext.Provider>
  );
};

export default App;
