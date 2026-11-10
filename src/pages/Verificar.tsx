import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function Verificar() {
  const { codigoQr } = useParams();
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/certificados/${codigoQr}`)
      .then((res) => setResultado(res.data))
      .catch(() => setError('Documento no encontrado'));
  }, [codigoQr]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded-lg p-6 text-center">
        <span className="font-display text-xl text-ink block mb-6">SIGIFAC</span>

        {error && <p className="text-red-600">{error}</p>}

        {resultado && (
          <>
            <div
              className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-paper text-2xl ${
                resultado.valido ? 'bg-emerald' : 'bg-red-600'
              }`}
            >
              {resultado.valido ? '✓' : '!'}
            </div>
            <h1 className="font-display text-xl text-ink mb-2">
              {resultado.valido ? 'Documento auténtico' : 'Alerta de manipulación'}
            </h1>
            <p className="text-slate text-sm mb-4">{resultado.mensaje}</p>
            <p className="text-xs text-slate">{resultado.sello}</p>
          </>
        )}
      </div>
    </div>
  );
}