import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { accionAuditoria, fechaAuditoria } from '../lib/auditoria';
import { empresaEfectivaId } from '../lib/permisos';
import { useAuthStore } from '../store/auth.store';

interface Evento {
  id: number;
  fecha: string;
  modulo: string | null;
  accion: string;
  resultado: string;
  usuario: { nombreCompleto: string } | null;
}

export default function Auditoria() {
  const empresaId = useAuthStore((estado) => empresaEfectivaId(estado.usuario));
  const eventos = useQuery({
    queryKey: ['auditoria-empresa', empresaId],
    queryFn: async () => (await api.get<Evento[]>('/usuarios/auditoria')).data,
  });

  return (
    <section className="mx-auto max-w-7xl">
      <h2 className="text-3xl font-bold text-ink">Auditoría</h2>
      <p className="mb-5 mt-2 text-sm text-slate-600">Últimos 100 eventos registrados para esta empresa. Hora de Colombia.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {eventos.isPending && <p className="p-5">Cargando eventos…</p>}
        {eventos.isError && <p role="alert" className="p-5 text-red-700">No se pudo cargar la auditoría.</p>}
        {eventos.isSuccess && !eventos.data.length && <p className="p-5">Aún no hay eventos registrados.</p>}
        {!!eventos.data?.length && <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>
            {['Fecha y hora', 'Usuario', 'Módulo', 'Acción', 'Resultado'].map((campo) => <th key={campo} scope="col" className="px-4 py-3">{campo}</th>)}
          </tr></thead>
          <tbody>{eventos.data.map((evento) => <tr key={evento.id} className="border-t border-slate-100">
            <td className="px-4 py-3">{fechaAuditoria(evento.fecha)}</td>
            <td className="px-4 py-3">{evento.usuario?.nombreCompleto ?? 'Sin usuario asociado'}</td>
            <td className="px-4 py-3">{evento.modulo ?? '—'}</td>
            <td className="px-4 py-3">{accionAuditoria(evento.accion)}</td>
            <td className="px-4 py-3">{evento.resultado}</td>
          </tr>)}</tbody>
        </table>}
      </div>
    </section>
  );
}
