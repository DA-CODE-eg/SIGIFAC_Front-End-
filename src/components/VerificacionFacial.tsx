import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../api/client';

type Reto = { id: string; direccion: 'IZQUIERDA' | 'DERECHA' };

function jpeg(origen: CanvasImageSource, ancho: number, alto: number) {
  const escala = Math.min(1, 640 / ancho, 640 / alto);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  canvas.getContext('2d')!.drawImage(origen, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export default function VerificacionFacial({ token, sesionCorreo, capturaSinReferencia, onSuccess }: {
  token: string;
  sesionCorreo?: string;
  capturaSinReferencia: boolean;
  onSuccess: (sesion: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const flujo = useRef<MediaStream | null>(null);
  const montado = useRef(true);
  const capturas = useRef<string[]>([]);
  const [reto, setReto] = useState<Reto | null>(null);
  const [autoriza, setAutoriza] = useState(false);
  const [autorizaFoto, setAutorizaFoto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState('');

  const cerrarCamara = () => {
    flujo.current?.getTracks().forEach(track => track.stop());
    flujo.current = null;
  };

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cerrarCamara();
      capturas.current = [];
    };
  }, []);

  const iniciar = async () => {
    setError('');
    setOcupado(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere una conexión HTTPS.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (!montado.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      flujo.current = stream;
      const { data } = await api.post<Reto>(`/certificacion/firma/publica/${token}/facial/iniciar`, { autorizaBiometria: autoriza, autorizaFotoCertificado: autoriza && autorizaFoto, firmaSession: sesionCorreo });
      if (!montado.current) return;
      if (video.current) video.current.srcObject = stream;
      setPaso(0);
      setReto(data);
    } catch (e) {
      cerrarCamara();
      setError(isAxiosError(e) ? e.response?.data?.message ?? 'La verificación facial no está disponible.' : 'No se pudo abrir la cámara. Comprueba los permisos y usa una conexión HTTPS.');
    } finally {
      if (montado.current) setOcupado(false);
    }
  };

  const capturar = async () => {
    if (!reto || !video.current?.videoWidth || video.current.readyState < 2) return;
    capturas.current.push(jpeg(video.current, video.current.videoWidth, video.current.videoHeight));
    if (capturas.current.length < 3) {
      setPaso(capturas.current.length);
      return;
    }
    setOcupado(true);
    cerrarCamara();
    try {
      const { data } = await api.post(`/certificacion/firma/publica/${token}/facial/validar`, { id: reto.id, capturas: capturas.current });
      if (montado.current) onSuccess(data.firmaSession);
    } catch (e) {
      if (montado.current) setError(isAxiosError(e) ? e.response?.data?.message ?? 'Intenta nuevamente con buena iluminación.' : 'No se pudo validar el rostro.');
    } finally {
      capturas.current = [];
      if (montado.current) {
        setReto(null);
        setOcupado(false);
      }
    }
  };

  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-ink">Verificación facial</h2>
      {!reto && <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" checked={autoriza} onChange={e => setAutoriza(e.target.checked)} />
        <span>{capturaSinReferencia ? 'Autorizo la comprobación de rostro y prueba de vida con mi cámara frontal.' : 'Autorizo comparar mis capturas con la referencia autorizada para esta solicitud.'}</span>
      </label>}
      {!reto && <label className="flex gap-3 text-sm text-slate-700">
        <input type="checkbox" disabled={!autoriza} checked={autoriza && autorizaFoto} onChange={e => setAutorizaFoto(e.target.checked)} />
        <span>Autorizo conservar la primera captura frontal e incluirla en la copia interna del certificado, accesible a los administradores de la empresa remitente. {capturaSinReferencia ? '' : 'Esta opción es voluntaria.'}</span>
      </label>}
      <video ref={video} autoPlay muted playsInline hidden={!reto}
        className="aspect-video w-full rounded-xl bg-slate-900 object-contain" aria-label="Vista de la cámara" />
      {reto && <p role="status" className="text-sm font-semibold text-ink">
        {paso === 1 ? `Gira la cabeza hacia tu ${reto.direccion.toLowerCase()}` : 'Mira de frente a la cámara'}. Captura {paso + 1} de 3.
      </p>}
      <button type="button" disabled={ocupado || (!reto && (!autoriza || (capturaSinReferencia && !autorizaFoto)))}
        className="rounded-xl bg-[#254a7e] px-4 py-2 font-semibold text-white disabled:opacity-50"
        onClick={() => { void (reto ? capturar() : iniciar()); }}>
        {ocupado ? 'Procesando…' : reto ? 'Tomar foto' : 'Activar cámara'}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
