import { useRef, useState, type PointerEvent } from 'react';

export default function FirmaGrafica({ value, onChange }: {
  value: string;
  onChange: (imagen: string) => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const activo = useRef<number | null>(null);
  const [modo, setModo] = useState<'dibujo' | 'imagen'>('dibujo');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const dibujar = (evento: PointerEvent<HTMLCanvasElement>, inicio: boolean) => {
    const canvas = evento.currentTarget;
    if (inicio) {
      if (activo.current !== null || evento.button !== 0) return;
      canvas.setPointerCapture(evento.pointerId);
      activo.current = evento.pointerId;
    }
    if (activo.current !== evento.pointerId) return;
    const area = canvas.getBoundingClientRect();
    const x = (evento.clientX - area.left) * canvas.width / area.width;
    const y = (evento.clientY - area.top) * canvas.height / area.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#10274d';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (inicio) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const cargar = async (archivo?: File) => {
    onChange('');
    setError('');
    if (!archivo) return;
    if (!['image/png', 'image/jpeg'].includes(archivo.type) || archivo.size > 2_000_000) {
      setError('Elige una imagen PNG o JPEG de hasta 2 MB.');
      return;
    }
    setCargando(true);
    try {
      const imagen = await createImageBitmap(archivo);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 240;
        const escala = Math.min(600 / imagen.width, 240 / imagen.height);
        const ancho = imagen.width * escala;
        const alto = imagen.height * escala;
        canvas.getContext('2d')!.drawImage(imagen, (600 - ancho) / 2, (240 - alto) / 2, ancho, alto);
        onChange(canvas.toDataURL('image/png'));
      } finally {
        imagen.close();
      }
    } catch {
      setError('No se pudo abrir la imagen.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <fieldset className="mt-5 space-y-3">
      <legend className="text-sm font-semibold text-ink">Representación gráfica de la firma</legend>
      <p className="text-sm text-slate-600">Tu firma gráfica aparecerá en el PDF disponible mediante el enlace de verificación.</p>
      <div className="flex flex-wrap gap-2">
        {(['dibujo', 'imagen'] as const).map(opcion => (
          <button key={opcion} type="button" disabled={cargando} aria-pressed={modo === opcion}
            className={`rounded-lg border px-3 py-2 text-sm ${modo === opcion ? 'border-[#254a7e] bg-[#edf3fa] font-semibold text-[#254a7e]' : 'border-slate-200 text-slate-600'}`}
            onClick={() => {
              if (modo === opcion) return;
              onChange('');
              setError('');
              setModo(opcion);
            }}>
            {opcion === 'dibujo' ? 'Dibujar firma' : 'Subir imagen'}
          </button>
        ))}
      </div>
      {modo === 'dibujo' ? <>
        <canvas ref={lienzo} width={600} height={240} aria-label="Lienzo para dibujar la firma"
          className="aspect-[5/2] w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white"
          onPointerDown={e => dibujar(e, true)} onPointerMove={e => dibujar(e, false)}
          onLostPointerCapture={() => { activo.current = null; }} />
        <button type="button" className="text-sm font-medium text-[#254a7e] underline"
          onClick={() => {
            lienzo.current?.getContext('2d')?.clearRect(0, 0, 600, 240);
            onChange('');
          }}>Borrar dibujo</button>
      </> : <>
        <input type="file" aria-label="Imagen de la firma" accept="image/png,image/jpeg" disabled={cargando}
          className="block w-full text-sm text-slate-600"
          onChange={e => { void cargar(e.target.files?.[0]); }} />
        {value && <img src={value} alt="Vista previa de la firma" className="max-h-32 w-full rounded-lg border border-slate-200 object-contain" />}
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
