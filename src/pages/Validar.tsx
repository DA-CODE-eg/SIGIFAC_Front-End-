import { useState } from 'react';
import { api } from '../api/client';

type Paso = 'identidad' | 'otp' | 'listo';

export default function Validar() {
  const [paso, setPaso] = useState<Paso>('identidad');
  const [identificadorDestinatario, setIdentificadorDestinatario] = useState('');
  const [codigo, setCodigo] = useState('');
  const [solicitudId, setSolicitudId] = useState<number | null>(null);
  const [otp, setOtp] = useState('');
  const [documento, setDocumento] = useState<any>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const validarIdentidad = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const respuesta = await api.post('/solicitudes/validar', { identificadorDestinatario, codigo });
      setSolicitudId(respuesta.data.solicitudId);
      setPaso('otp');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo validar la identidad');
    } finally {
      setCargando(false);
    }
  };

  const confirmarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const url = '/solicitudes/' + solicitudId + '/confirmar-otp';
      const respuesta = await api.post(url, { otp });
      setDocumento(respuesta.data);
      setPaso('listo');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Codigo OTP incorrecto o vencido');
    } finally {
      setCargando(false);
    }
  };

  if (paso === 'identidad') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <span className="font-display text-xl text-ink block mb-8">SIGIFAC</span>
          <form onSubmit={validarIdentidad} className="flex flex-col gap-4">
            <h1 className="font-display text-2xl text-ink mb-1">Validar identidad</h1>
            <p className="text-slate text-sm">Ingresa tu identificacion y el codigo que te enviaron.</p>
            <input
              className="border rounded px-3 py-2"
              placeholder="Identificacion"
              value={identificadorDestinatario}
              onChange={(e) => setIdentificadorDestinatario(e.target.value)}
              required
            />
            <input
              className="border rounded px-3 py-2 font-mono tracking-widest"
              placeholder="Codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              required
            />
            <button
              type="submit"
              disabled={cargando}
              className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60"
            >
              {cargando ? 'Validando...' : 'Continuar'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  if (paso === 'otp') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <span className="font-display text-xl text-ink block mb-8">SIGIFAC</span>
          <form onSubmit={confirmarOtp} className="flex flex-col gap-4">
            <h1 className="font-display text-2xl text-ink mb-1">Confirma el codigo</h1>
            <p className="text-slate text-sm">Ingresa el codigo de un solo uso que recibiste.</p>
            <input
              className="border rounded px-3 py-2 font-mono tracking-widest"
              placeholder="OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={cargando}
              className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60"
            >
              {cargando ? 'Confirmando...' : 'Confirmar'}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  const linkVerificar = '/verificar/' + (documento ? documento.codigoQr : '');

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <span className="font-display text-xl text-ink block mb-8">SIGIFAC</span>
        <div className="border rounded-lg p-5">
          <h1 className="font-display text-2xl text-ink mb-2">Documento certificado</h1>
          <p className="text-slate text-sm mb-4">{documento ? documento.sello : ''}</p>
          <p className="text-xs text-slate mb-1">Codigo QR de verificacion</p>
          <p className="font-mono text-sm text-ink break-all mb-4">{documento ? documento.codigoQr : ''}</p>
          <a className="inline-block text-sm border border-emerald text-emerald rounded px-3 py-1.5 hover:bg-emerald hover:text-paper transition-colors" href={linkVerificar}>Verificar autenticidad</a>
        </div>
      </div>
    </div>
  );
}