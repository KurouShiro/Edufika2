import React, { useEffect, useMemo, useState } from 'react';
import Keypad from '../components/Keypad';
import { AUTH } from '../constants';

interface Props {
  url: string;
  onFinish: () => void;
  onViolation: () => void;
}

const ExamBrowserScreen: React.FC<Props> = ({ url, onFinish, onViolation }) => {
  const [showExitModal, setShowExitModal] = useState(false);
  const [pin, setPin] = useState('');
  const [timeLeft, setTimeLeft] = useState(3600);

  const safeUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return '';
    } catch {
      return '';
    }
  }, [url]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTimeLeft((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (timeLeft === 0) {
      onViolation();
    }
  }, [onViolation, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExit = () => {
    if (pin.trim() === AUTH.PROCTOR_PIN) {
      onFinish();
      return;
    }

    alert('INVALID_CREDENTIALS');
    setPin('');
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-white font-mono text-black">
      <div className="z-30 flex h-12 items-center justify-between border-b border-[#39ff14]/30 bg-black px-3 text-[#39ff14]">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.2em]">SECURE_BROWSER</div>
          <div className="truncate text-[8px] uppercase tracking-[0.1em] opacity-60">{safeUrl || 'NO_TARGET_URL'}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold">{formatTime(timeLeft)}</span>
          <button
            onClick={() => setShowExitModal(true)}
            className="bg-red-600 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white hover:bg-red-500"
          >
            Quit
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-zinc-100">
        {safeUrl ? (
          <>
            <iframe
              title="edufika-exam-browser"
              src={safeUrl}
              className="h-full w-full border-0"
              sandbox="allow-forms allow-modals allow-same-origin allow-scripts"
              referrerPolicy="strict-origin"
            />
            <div className="pointer-events-none absolute bottom-2 left-2 border border-zinc-800/20 bg-white/70 px-2 py-1 text-[9px] uppercase">
              If this page is blank, the target site blocks iframe embedding.
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-md space-y-3 border border-red-500/50 bg-red-500/10 p-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">Invalid Exam URL</h2>
              <p className="text-xs text-red-700">The current exam session URL is invalid or unsupported.</p>
            </div>
          </div>
        )}
      </div>

      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-2 backdrop-blur-md">
          <div className="animate-digitized flex w-full max-w-sm flex-col items-center space-y-6 border border-[#39ff14]/30 bg-black p-4 shadow-[0_0_50px_rgba(57,255,20,0.2)]">
            <div className="text-center">
              <h3 className="neon-glow text-sm font-bold uppercase tracking-widest text-red-500">Admin_Bypass</h3>
              <p className="text-[8px] uppercase opacity-40">Enter_Proctor_PIN_To_Release</p>
            </div>

            <div className="flex h-10 w-full items-center justify-center border-b border-red-500 bg-red-500/5 text-lg font-bold tracking-[0.4em] text-red-500">
              {pin.split('').map(() => '*').join('') || (
                <span className="text-[10px] tracking-normal opacity-20">AWAITING_PIN</span>
              )}
            </div>

            <Keypad
              onPress={(value) => setPin((previous) => (previous.length < 8 ? previous + value : previous))}
              onClear={() => setPin('')}
              onDelete={() => setPin((previous) => previous.slice(0, -1))}
            />

            <div className="grid w-full grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setShowExitModal(false);
                  setPin('');
                }}
                className="border border-zinc-800 py-2.5 text-[10px] font-bold uppercase text-zinc-500 transition-colors hover:border-zinc-600 hover:text-white"
              >
                Abort
              </button>
              <button
                onClick={handleExit}
                className="bg-red-600 py-2.5 text-[10px] font-bold uppercase text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all hover:bg-red-500"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 z-40 opacity-20 transition-opacity hover:opacity-70">
        <button
          onClick={onViolation}
          className="border border-red-500 bg-red-900 p-1.5 text-[7px] font-bold uppercase text-white"
        >
          Trigger_Violation
        </button>
      </div>
    </div>
  );
};

export default ExamBrowserScreen;
