
import React, { useState, useContext } from 'react';
import TerminalButton from '../components/TerminalButton';
import { WHITELIST_URLS } from '../constants';
import { LanguageContext } from '../App';

interface Props {
  onConfirm: (url: string) => void;
  onBack: () => void;
}

const ManualInputScreen: React.FC<Props> = ({ onConfirm, onBack }) => {
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useContext(LanguageContext);

  const allowedHosts = WHITELIST_URLS.map((value) => {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }).filter((value): value is string => value !== null);

  const validateUrl = (input: string): { valid: boolean; error?: string; normalized?: string } => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      return { valid: false, error: 'Input_Required: URL cannot be empty' };
    }

    if (/[<>"{}|\\^~[\]`]/.test(trimmedInput)) {
      return { valid: false, error: 'Format_Error: Contains invalid characters' };
    }

    if (!trimmedInput.startsWith('http://') && !trimmedInput.startsWith('https://')) {
      return { valid: false, error: 'Protocol_Error: Missing http:// or https://' };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedInput);
      if (!parsedUrl.hostname.includes('.')) {
        return { valid: false, error: 'Format_Error: Invalid hostname structure' };
      }
    } catch {
      return { valid: false, error: 'Format_Error: String is not a valid URL' };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const isWhitelisted = allowedHosts.some(
      (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    );

    if (!isWhitelisted) {
      return { valid: false, error: 'Access_Denied: Restricted Domain (Not in Registry)' };
    }

    return { valid: true, normalized: parsedUrl.toString() };
  };

  const handleSubmit = () => {
    const result = validateUrl(url);
    if (result.valid) {
      onConfirm(result.normalized || url.trim());
    } else {
      setErrorMessage(result.error || 'Unknown_Error');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full h-full max-sm font-mono animate-in fade-in duration-500">
      <div className={`w-full p-6 neon-border bg-[#0a0a0a]/90 transition-all duration-300 ${errorMessage ? 'border-red-500' : ''}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-bold tracking-[0.2em] uppercase">{t.target_endpoint}</h2>
          <div className={`w-2 h-2 rounded-full ${errorMessage ? 'bg-red-500 animate-pulse' : 'bg-[#39ff14] shadow-[0_0_5px_#39ff14]'}`} />
        </div>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[9px] uppercase opacity-40 ml-1">{t.registry_protocol}</label>
              {errorMessage && <span className="text-[8px] text-red-500 uppercase animate-pulse">! Blocked</span>}
            </div>
            <input 
              type="text" 
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="https://exam.link..."
              className={`w-full bg-black border ${errorMessage ? 'border-red-500 text-red-400' : 'border-[#39ff14]/30 text-[#39ff14]'} p-3 text-sm focus:outline-none focus:border-[#39ff14] placeholder:opacity-20 rounded-none transition-colors`}
            />
          </div>

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/40 p-3 text-[10px] text-red-500 text-center uppercase tracking-widest font-bold animate-in slide-in-from-top-1">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <TerminalButton onClick={handleSubmit} variant="primary" className="py-3 text-sm">
              {t.deploy_engine}
            </TerminalButton>
            <TerminalButton onClick={onBack} variant="outline" className="py-2 text-[10px] opacity-60">
              {t.back}
            </TerminalButton>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-2 opacity-20 text-[7px] uppercase tracking-[0.2em] text-center w-full">
        <div className="flex justify-between items-center px-2">
          <span>Registry_Active: {WHITELIST_URLS.length} Nodes</span>
          <span>Security_Level: Alpha</span>
        </div>
        <div className="border-t border-[#39ff14]/20 pt-2">
          Edufika Secure Handshake v1.0 // Auth_Required
        </div>
      </div>
    </div>
  );
};

export default ManualInputScreen;
