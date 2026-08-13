import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@components/Button';
import { Input } from '@components/Input';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result) => {
          if (result && !cancelled) {
            onDetected(result.getText());
          }
        }
      )
      .catch((err: unknown) => {
        if (!cancelled) {
          setCameraError(err instanceof Error ? err.message : 'Could not access the camera.');
        }
      });

    return () => {
      cancelled = true;
      readerRef.current = null;
      // BrowserMultiFormatReader streams tracks onto the <video> element directly;
      // stopping them here releases the camera when the scanner closes/unmounts.
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) onDetected(manualBarcode.trim());
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scan a barcode</h3>
        <button className="text-gray-400 hover:text-gray-600 text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {!cameraError && (
        <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video object-cover" muted playsInline />
      )}
      {cameraError && (
        <p className="text-sm text-warning-600 bg-warning-50 rounded-lg p-3">
          Camera unavailable ({cameraError}). Enter the barcode number manually below instead.
        </p>
      )}

      <form onSubmit={onManualSubmit} className="flex gap-2">
        <Input
          placeholder="Or type the barcode number…"
          value={manualBarcode}
          onChange={(e) => setManualBarcode(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          Look up
        </Button>
      </form>
    </div>
  );
}
