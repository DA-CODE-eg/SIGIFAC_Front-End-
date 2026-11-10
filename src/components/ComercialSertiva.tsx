import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type Empresa = {
  id: number; nombreEmpresa: string; clienteComercialActivo: boolean;
  ingresoMensualCop: string | null; costoMensualCop: string | null;
};
type Comercial = {
  empresas: Empresa[]; clientesActivos: number; completas: number;
  ingresosRegistrados: string; costosRegistrados: string; resultado: string | null;
};

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2,
});

export default function ComercialSertiva() {
  const comercial = useQuery({
    queryKey: ['admin-comercial'],
    queryFn: async () => (await api.get<Comercial>('/admin/comercial')).data,
  });
  const [empresaId, setEmpresaId] = useState('');
  const datos = comercial.data;
  const empresa = datos?.empresas.find((item) => String(item.id) === empresaId);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="text-xl font-semibold text-ink">Seguimiento comercial</h3>
    <p className="mt-1 text-sm text-slate-600">Registra los ingresos recurrentes y los costos mensuales asociados a cada cliente de Sertiva.</p>
    {comercial.isPending && <p className="mt-3 text-sm">Cargando datos comerciales…</p>}
    {comercial.isError && <p role="alert" className="mt-3 text-sm text-red-700">No se pudo cargar el seguimiento comercial.</p>}
    {datos && <>
      <dl className="my-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt>Clientes activos</dt><dd className="mt-1 font-semibold">{datos.clientesActivos}</dd></div>
        <div><dt>Ingreso mensual registrado</dt><dd className="mt-1 font-semibold">{cop.format(Number(datos.ingresosRegistrados))}</dd></div>
        <div><dt>Costo mensual registrado</dt><dd className="mt-1 font-semibold">{cop.format(Number(datos.costosRegistrados))}</dd></div>
        <div><dt>Resultado mensual registrado</dt><dd className="mt-1 font-semibold">{datos.resultado === null ? 'Datos insuficientes' : cop.format(Number(datos.resultado))}</dd></div>
      </dl>
      <p className="mb-4 text-xs text-slate-500">{datos.completas} de {datos.clientesActivos} clientes activos tienen ingreso y costo registrados.</p>
      <label className="block max-w-md text-sm font-semibold">Empresa
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Selecciona una empresa</option>
          {datos.empresas.map((item) => <option key={item.id} value={item.id}>{item.nombreEmpresa}</option>)}
        </select>
      </label>
      {empresa && <Editor key={empresa.id} empresa={empresa} />}
    </>}
  </section>;
}

function Editor({ empresa }: { empresa: Empresa }) {
  const cache = useQueryClient();
  const [activo, setActivo] = useState(empresa.clienteComercialActivo);
  const [ingreso, setIngreso] = useState(empresa.ingresoMensualCop ?? '');
  const [costo, setCosto] = useState(empresa.costoMensualCop ?? '');
  const guardar = useMutation({
    mutationFn: () => api.patch(`/admin/comercial/${empresa.id}`, { activo, ingreso, costo }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['admin-comercial'] }),
  });
  const campo = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2';
  return <form className="mt-4 flex flex-wrap items-end gap-3 text-sm" onSubmit={(evento) => { evento.preventDefault(); guardar.mutate(); }}>
    <label className="inline-flex items-center gap-2 py-2"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Cliente activo</label>
    <label>Ingreso mensual COP<input className={campo} type="number" min="0" max="999999999999.99" step="0.01" value={ingreso} onChange={(e) => setIngreso(e.target.value)} /></label>
    <label>Costo mensual COP<input className={campo} type="number" min="0" max="999999999999.99" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} /></label>
    <button disabled={guardar.isPending} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Guardar</button>
    {guardar.isError && <span role="alert" className="py-2 text-red-700">No se pudieron guardar los datos.</span>}
    {guardar.isSuccess && <span role="status" className="py-2 text-emerald-700">Datos guardados.</span>}
  </form>;
}
