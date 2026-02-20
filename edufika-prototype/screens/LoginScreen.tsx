import React, { useContext, useState } from 'react';
import Keypad from '../components/Keypad';
import TerminalButton from '../components/TerminalButton';
import { LanguageContext } from '../App';

interface Props {
  onLogin: (token: string) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const { t } = useContext(LanguageContext);
  const [token, setToken] = useState('');

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-8 px-6 py-8">
      <div className="space-y-3 text-center">
        <h1 className="neon-glow text-2xl font-black uppercase tracking-[0.25em]">{t.auth_session}</h1>
        <p className="text-[10px] uppercase tracking-[0.22em] opacity-50">{t.encryption}</p>
      </div>

      <div className="w-full border border-[#39ff14]/30 bg-[#0a0a0a]/90 p-4">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] opacity-50">{t.master_id}</div>
        <div className="flex h-14 items-center justify-between border-b-2 border-[#39ff14] bg-[#39ff14]/5 px-3">
          <span className="truncate text-lg font-bold tracking-[0.2em]">
            {token || <span className="opacity-20">{t.enter_token}</span>}
          </span>
          <span className="h-6 w-0.5 animate-pulse bg-[#39ff14]" />
        </div>
      </div>

      <Keypad
        onPress={(value) => setToken((prev) => (prev.length < 20 ? prev + value : prev))}
        onClear={() => setToken('')}
        onDelete={() => setToken((prev) => prev.slice(0, -1))}
      />

      <TerminalButton onClick={() => onLogin(token)} className="w-full max-w-[400px] text-sm">
        {t.execute_handshake}
      </TerminalButton>
    </div>
  );
};

export default LoginScreen;
