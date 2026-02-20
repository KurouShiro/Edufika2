import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import TerminalButton from '../components/TerminalButton';
import { LanguageContext } from '../App';

interface Props {
  onResult: (url: string) => void;
  onBack: () => void;
}

const QRScannerScreen: React.FC<Props> = ({ onResult, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const { t } = useContext(LanguageContext);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const parseCandidateUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const stopScanner = useCallback(() => {
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  }, []);

  const runDetectionLoop = useCallback(() => {
    const scan = async () => {
      if (!videoRef.current || !detectorRef.current) {
        return;
      }

      try {
        if (videoRef.current.readyState >= 2) {
          const codes = await detectorRef.current.detect(videoRef.current);
          const rawValue = codes?.[0]?.rawValue;
          const decodedUrl = parseCandidateUrl(typeof rawValue === 'string' ? rawValue : '');

          if (decodedUrl) {
            stopScanner();
            onResult(decodedUrl);
            return;
          }
        }
      } catch {
        setError('Scanner_Error: Unable to decode QR frame.');
      }

      scanFrameRef.current = requestAnimationFrame(scan);
    };

    scanFrameRef.current = requestAnimationFrame(scan);
  }, [onResult, stopScanner]);

  useEffect(() => {
    let isMounted = true;

    const setupCamera = async () => {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          setError('Scanner unsupported in this browser. Paste the QR URL manually below.');
          return;
        }

        detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        setIsScanning(true);
        runDetectionLoop();
      } catch {
        setError('Camera access denied or unavailable.');
      }
    };

    setupCamera();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [runDetectionLoop, stopScanner]);

  const submitManualValue = () => {
    const parsed = parseCandidateUrl(manualValue);
    if (!parsed) {
      setError('Input_Error: Enter a valid http(s) URL.');
      return;
    }

    stopScanner();
    onResult(parsed);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 py-6 font-mono">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale brightness-75"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-4 rounded border border-[#39ff14]/30 bg-black/70 p-4">
        <div className="relative h-64 w-64 border-2 border-[#39ff14]">
          <div className="absolute inset-0 bg-gradient-to-b from-[#39ff14]/20 to-transparent h-1 animate-[scanline_2s_infinite]" />
          <div className="absolute left-0 top-0 -ml-1 -mt-1 h-4 w-4 border-l-4 border-t-4 border-[#39ff14]" />
          <div className="absolute right-0 top-0 -mr-1 -mt-1 h-4 w-4 border-r-4 border-t-4 border-[#39ff14]" />
          <div className="absolute bottom-0 left-0 -mb-1 -ml-1 h-4 w-4 border-b-4 border-l-4 border-[#39ff14]" />
          <div className="absolute bottom-0 right-0 -mb-1 -mr-1 h-4 w-4 border-b-4 border-r-4 border-[#39ff14]" />
        </div>

        <p className="text-center text-[11px] uppercase tracking-[0.18em]">
          {isScanning ? t.scan_desc : 'Scanner standby. Use manual mode if detection is unavailable.'}
        </p>

        <div className="w-full space-y-2">
          <input
            type="text"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="https://exam.school.edu/session..."
            className="w-full border border-[#39ff14]/30 bg-black px-3 py-2 text-xs text-[#39ff14] placeholder:text-[#39ff14]/30 focus:border-[#39ff14] focus:outline-none"
          />
          <button
            onClick={submitManualValue}
            className="w-full border border-[#39ff14] bg-[#39ff14]/15 py-2 text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-[#39ff14]/25"
          >
            Confirm Manual QR Payload
          </button>
        </div>

        {error && (
          <div className="w-full border border-red-500/50 bg-red-500/10 px-3 py-2 text-center text-[10px] uppercase text-red-400">
            {error}
          </div>
        )}
      </div>

      <div className="absolute bottom-10 z-20">
        <TerminalButton
          onClick={() => {
            stopScanner();
            onBack();
          }}
          variant="outline"
          className="text-xs"
        >
          {t.cancel_scan}
        </TerminalButton>
      </div>
    </div>
  );
};

export default QRScannerScreen;
