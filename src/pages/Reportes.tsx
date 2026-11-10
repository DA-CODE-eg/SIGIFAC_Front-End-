import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

type Formato = 'XLSX' | 'CSV' | 'PDF';

interface Reporte {
  tipo: string;
  nombre: string;
  grupo: string;
}

export default function Reportes() {
  const [buscar, setBuscar] = useState('');
  const [formato, setFormato] =
    useState<Formato>('XLSX');
  const [descargando, setDescargando] =
    useState<string | null>(null);

  const { data: catalogo = [] } = useQuery<Reporte[]>({
    queryKey: ['reportes-catalogo'],
    queryFn: async () =>
      (await api.get('/reportes/catalogo')).data,
  });

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return catalogo;

    return catalogo.filter((r) =>
      `${r.nombre} ${r.grupo} ${r.tipo}`
        .toLowerCase()
        .includes(q),
    );
  }, [catalogo, buscar]);

  const grupos = useMemo(
    () =>
      Array.from(
        new Set(filtrados.map((r) => r.grupo)),
      ),
    [filtrados],
  );

  const descargar = async (reporte: Reporte) => {
    try {
      setDescargando(reporte.tipo);

      const { data, headers } = await api.get(
        '/reportes/exportar',
        {
          params: {
            tipo: reporte.tipo,
            formato,
          },
          responseType: 'blob',
        },
      );

      const contentDisposition =
        headers['content-disposition'] ?? '';
      const match = /filename="?([^"]+)"?/i.exec(
        contentDisposition,
      );

      const extension = formato.toLowerCase();
      const filename =
        match?.[1] ??
        `sigifac_${reporte.tipo.toLowerCase()}.${extension}`;

      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = filename;
      a.click();

      URL.revokeObjectURL(url);

      await feedback.exito(
        'Reporte generado',
        `${reporte.nombre} se descargó correctamente.`,
      );
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Información · exportación · control
          </p>
          <h1 className="text-3xl font-semibold text-[#253043]">
            Reportes
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Descarga información operativa y comercial del sistema en Excel, CSV o PDF.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex gap-1">
            {(['XLSX', 'CSV', 'PDF'] as Formato[]).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormato(item)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    formato === item
                      ? 'bg-[#1f4f82] text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item === 'XLSX'
                    ? 'Excel'
                    : item}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar reporte..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#1f4f82]"
        />
      </div>

      {grupos.map((grupo) => (
        <section key={grupo}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#253043]">
              {grupo}
            </h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados
              .filter((r) => r.grupo === grupo)
              .map((reporte) => (
                <div
                  key={reporte.tipo}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        {reporte.grupo}
                      </p>
                      <h3 className="mt-1 font-semibold text-[#253043]">
                        {reporte.nombre}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {descripcion(reporte.tipo)}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#edf4ff] px-2.5 py-1 text-xs font-semibold text-[#1f4f82]">
                      {formato === 'XLSX'
                        ? 'Excel'
                        : formato}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => descargar(reporte)}
                    disabled={
                      descargando === reporte.tipo
                    }
                    className="mt-5 w-full rounded-xl bg-[#1f4f82] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {descargando === reporte.tipo
                      ? 'Generando...'
                      : 'Descargar reporte'}
                  </button>
                </div>
              ))}
          </div>
        </section>
      ))}

      {filtrados.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No encontramos reportes con ese criterio.
        </div>
      )}
    </div>
  );
}

function descripcion(tipo: string) {
  const descripciones: Record<string, string> = {
    INVENTARIO:
      'Existencias, inventario, categorías, proveedores y estado de los productos.',
    PRODUCTOS:
      'Catálogo operativo de productos activos con stock y precio.',
    MOVIMIENTOS:
      'Entradas, salidas, ventas, ajustes y devoluciones con trazabilidad.',
    VENCIMIENTOS:
      'Productos con fecha de vencimiento, días restantes y semaforización.',
    CLIENTES:
      'Directorio de clientes con estado y datos de contacto.',
    PROVEEDORES:
      'Directorio de proveedores y datos comerciales.',
    FACTURAS:
      'Facturas emitidas, estado, totales, saldos y pagos.',
    CARTERA:
      'Facturas pendientes, parciales o vencidas y saldo pendiente.',
    CERTIFICACIONES:
      'Solicitudes, certificados, códigos QR y hashes de integridad.',
    NOTIFICACIONES:
      'Historial de alertas y notificaciones del sistema.',
    AUDITORIA:
      'Acciones de usuarios, módulos, resultados y cambios registrados.',
  };

  return (
    descripciones[tipo] ??
    'Información exportable de SIGIFAC.'
  );
}
