'use client';

import { Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CameraCaptureButtonProps } from './camera.types';

export function CameraCaptureButton({ onCapture }: CameraCaptureButtonProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const startCamera = async () => {
    setError(null);
    setIsOpen(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setStream(mediaStream);
    } catch (err) {
      console.error('Erro ao acessar câmera', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  // aplica o stream assim que o vídeo existir no DOM
  useEffect(() => {
    if (isOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isOpen, stream]);

  // sem isto a webcam continuaria ligada ao desmontar o formulário
  useEffect(() => stopStream, [stopStream]);

  const close = () => {
    stopStream();
    setIsOpen(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext('2d')
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(URL.createObjectURL(blob));
      close();
    }, 'image/jpeg');
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={startCamera}>
        <Camera className="mr-2 h-4 w-4" />
        Usar câmera
      </Button>

      {/* o vídeo vive num diálogo: inline ele esticava a linha de botões e
          ficava apertado dentro do drawer */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => (open ? setIsOpen(true) : close())}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tirar foto</DialogTitle>
            <DialogDescription>
              Enquadre o aluno e clique em capturar.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-destructive-text py-8 text-center text-sm">
              {error}
            </p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="bg-muted aspect-video w-full rounded-md border"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" onClick={takePhoto} disabled={!stream}>
              <Camera className="mr-2 h-4 w-4" />
              Capturar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
