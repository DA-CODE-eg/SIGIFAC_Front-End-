import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type TipoCampo = 'TEXTO' | 'NUMERO' | 'FECHA' | 'BOOLEANO' | 'SELECCION';
type RolContacto = 'NINGUNO' | 'CLIENTES' | 'PROVEEDORES' | 'INVENTARIO';

interface CampoDefinicion {
  id: number;
  nombreCampo: string;
  etiqueta: string;
  tipoDato: TipoCampo;
  esObligatorio: boolean;
}

interface Modulo {
  id: number;
  nombreModulo: string;
  descripcion: string | null;
  rolContacto: RolContacto;
  campoNombreId: number | null;
  campoCorreoId: number | null;
  campoCantidadId: number | null;
  campoPrecioId: number | null;
  campoVencimientoId: number | null;
  campos: CampoDefinicion[];
}

interface Registro {
  id: number;
  datos: Record<string, any>;
  fechaCreacion: string;
}

export default function Modulos() {
  const queryClient = useQueryClient();
  const [moduloSeleccionadoId, setModuloSeleccionadoId] = useState<number | null>(null);
  const [nombreModulo, setNombreModulo] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: modulos, isLoading: cargandoModulos } = useQuery<Modulo[]>({
    queryKey: ['modulos'],
    queryFn: async () => (await api.get('/modulos')).data,
  });

  const crearModulo = useMutation({
    mutationFn: async () => api.post('/modulos', { nombreModulo, descripcion: descripcion || undefined }),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ['modulos'] });
      setNombreModulo('');
      setDescripcion('');
      if (res?.data?.id) setModuloSeleccionadoId(res.data.id);
    },
  });

  if (moduloSeleccionadoId) {
    return <DetalleModulo moduloId={moduloSeleccionadoId} onVolver={() => setModuloSeleccionadoId(null)} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-1 text-ink">Módulos</h1>
        <p className="text-slate">
          Crea tablas a tu medida (Clientes, Proveedores, lo que necesites) con los campos que tú definas.
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-3">Nuevo módulo</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crearModulo.mutate();
          }}
          className="flex flex-col gap-2"
        >
          <input
            className="border rounded px-3 py-2"
            placeholder="Nombre del módulo (ej. Clientes)"
            value={nombreModulo}
            onChange={(e) => setNombreModulo(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <button
            type="submit"
            disabled={crearModulo.isPending}
            className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60 self-start"
          >
            {crearModulo.isPending ? 'Creando...' : 'Crear módulo'}
          </button>
          {crearModulo.isError && <p className="text-red-600 text-sm">Error al crear el módulo</p>}
        </form>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-3">Tus módulos</h2>
        {cargandoModulos && <p className="text-slate text-sm">Cargando...</p>}
        {!cargandoModulos && modulos?.length === 0 && (
          <p className="text-slate text-sm">Todavía no has creado ningún módulo.</p>
        )}
        <div className="flex flex-col divide-y divide-slate-100">
          {modulos?.map((m) => (
            <button
              key={m.id}
              onClick={() => setModuloSeleccionadoId(m.id)}
              className="py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 -mx-4 px-4"
            >
              <div>
                <p className="text-ink text-sm font-medium">{m.nombreModulo}</p>
                <p className="text-slate text-xs">
                  {m.campos.length} campo(s)
                  {m.rolContacto !== 'NINGUNO' && (
                    <span className="ml-2 text-emerald">
                      · marcado como {
                        m.rolContacto === 'CLIENTES'
                          ? 'Clientes'
                          : m.rolContacto === 'PROVEEDORES'
                            ? 'Proveedores'
                            : 'Inventario'
                      }
                    </span>
                  )}
                </p>
              </div>
              <span className="text-emerald text-sm">Abrir →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetalleModulo({ moduloId, onVolver }: { moduloId: number; onVolver: () => void }) {
  const queryClient = useQueryClient();
  const { data: modulo, isLoading } = useQuery<Modulo>({
    queryKey: ['modulo', moduloId],
    queryFn: async () => (await api.get(`/modulos/${moduloId}`)).data,
  });
  const { data: registros, isLoading: cargandoRegistros } = useQuery<Registro[]>({
    queryKey: ['modulo-registros', moduloId],
    queryFn: async () => (await api.get(`/modulos/${moduloId}/registros`)).data,
  });

  const [nombreCampo, setNombreCampo] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [tipoDato, setTipoDato] = useState<TipoCampo>('TEXTO');
  const [esObligatorio, setEsObligatorio] = useState(false);

  const agregarCampo = useMutation({
    mutationFn: async () =>
      api.post(`/modulos/${moduloId}/campos`, { nombreCampo, etiqueta, tipoDato, esObligatorio }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      setNombreCampo('');
      setEtiqueta('');
      setTipoDato('TEXTO');
      setEsObligatorio(false);
    },
  });

  const [datosNuevoRegistro, setDatosNuevoRegistro] = useState<Record<string, string>>({});
  const crearRegistro = useMutation({
    mutationFn: async () => api.post(`/modulos/${moduloId}/registros`, { datos: datosNuevoRegistro }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo-registros', moduloId] });
      setDatosNuevoRegistro({});
    },
  });

  const [rolContacto, setRolContacto] = useState<RolContacto>('NINGUNO');
  const [campoNombreId, setCampoNombreId] = useState('');
  const [campoCorreoId, setCampoCorreoId] = useState('');
  const [campoCantidadId, setCampoCantidadId] = useState('');
  const [campoPrecioId, setCampoPrecioId] = useState('');
  const [campoVencimientoId, setCampoVencimientoId] = useState('');

  useEffect(() => {
    if (!modulo) return;
    setRolContacto(modulo.rolContacto);
    setCampoNombreId(modulo.campoNombreId ? String(modulo.campoNombreId) : '');
    setCampoCorreoId(modulo.campoCorreoId ? String(modulo.campoCorreoId) : '');
    setCampoCantidadId(modulo.campoCantidadId ? String(modulo.campoCantidadId) : '');
    setCampoPrecioId(modulo.campoPrecioId ? String(modulo.campoPrecioId) : '');
    setCampoVencimientoId(modulo.campoVencimientoId ? String(modulo.campoVencimientoId) : '');
  }, [modulo]);

  const esClienteOProveedor = rolContacto === 'CLIENTES' || rolContacto === 'PROVEEDORES';

  const guardarRolContacto = useMutation({
    mutationFn: async () =>
      api.patch(`/modulos/${moduloId}/rol-contacto`, {
        rolContacto,
        campoNombreId: rolContacto === 'NINGUNO' ? undefined : campoNombreId ? Number(campoNombreId) : undefined,
        campoCorreoId: esClienteOProveedor ? Number(campoCorreoId) : undefined,
        campoCantidadId: rolContacto === 'INVENTARIO' && campoCantidadId ? Number(campoCantidadId) : undefined,
        campoPrecioId: rolContacto === 'INVENTARIO' && campoPrecioId ? Number(campoPrecioId) : undefined,
        campoVencimientoId: rolContacto === 'INVENTARIO' && campoVencimientoId ? Number(campoVencimientoId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modulo', moduloId] });
      queryClient.invalidateQueries({ queryKey: ['modulos'] });
      queryClient.invalidateQueries({ queryKey: ['inventario-modulos'] });
    },
  });

  // --- Carga masiva a este módulo ---
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [trabajoId, setTrabajoId] = useState<number | null>(null);

  const subirArchivo = useMutation({
    mutationFn: async (archivo: File) => {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('tipoDestino', 'MODULO');
      formData.append('moduloId', String(moduloId));
      const { data } = await api.post('/carga-masiva', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setTrabajoId(data.id);
      if (inputArchivoRef.current) inputArchivoRef.current.value = '';
    },
  });

  const { data: estadoTrabajo } = useQuery({
    queryKey: ['carga-masiva', trabajoId],
    queryFn: async () => (await api.get(`/carga-masiva/${trabajoId}`)).data,
    enabled: trabajoId !== null,
    refetchInterval: (query) =>
      query.state.data?.estado === 'COMPLETADO' || query.state.data?.estado === 'CON_ERRORES' ? false : 1500,
  });

  if (isLoading || !modulo) {
    return <div className="max-w-2xl mx-auto p-6 text-slate">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <button onClick={onVolver} className="text-sm text-emerald hover:underline mb-2">
          ← Volver a Módulos
        </button>
        <h1 className="text-2xl font-bold mb-1 text-ink">{modulo.nombreModulo}</h1>
        {modulo.descripcion && <p className="text-slate">{modulo.descripcion}</p>}
      </div>

      {/* Marcar rol del módulo */}
      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-1">Rol de este módulo</h2>
        <p className="text-slate text-sm mb-3">
          Si este módulo guarda clientes, proveedores o tu inventario, márcalo aquí para que
          Notificaciones, Facturación y los avisos de vencimiento puedan usarlo.
        </p>
        <div className="flex flex-col gap-2">
          <select
            className="border rounded px-3 py-2"
            value={rolContacto}
            onChange={(e) => setRolContacto(e.target.value as RolContacto)}
          >
            <option value="NINGUNO">Ningún rol especial</option>
            <option value="CLIENTES">Este módulo es mis Clientes</option>
            <option value="PROVEEDORES">Este módulo es mis Proveedores</option>
            <option value="INVENTARIO">Este módulo es un Inventario</option>
          </select>

          {rolContacto !== 'NINGUNO' && modulo.campos.length === 0 && (
            <p className="text-amber text-sm">
              Este módulo todavía no tiene campos. Agrégale al menos uno antes de marcarlo.
            </p>
          )}

          {esClienteOProveedor && modulo.campos.length > 0 && (
            <>
              <select className="border rounded px-3 py-2" value={campoNombreId} onChange={(e) => setCampoNombreId(e.target.value)}>
                <option value="">¿Cuál campo es el nombre?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <select className="border rounded px-3 py-2" value={campoCorreoId} onChange={(e) => setCampoCorreoId(e.target.value)}>
                <option value="">¿Cuál campo es el correo?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </>
          )}

          {rolContacto === 'INVENTARIO' && modulo.campos.length > 0 && (
            <>
              <p className="text-slate text-xs -mb-1">
                Todos estos mapeos son opcionales — sin ellos, el ítem no calcula totales ni avisa vencimientos,
                pero sigue guardándose igual.
              </p>
              <select className="border rounded px-3 py-2" value={campoNombreId} onChange={(e) => setCampoNombreId(e.target.value)}>
                <option value="">(Opcional) ¿Cuál campo es el nombre del ítem?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <select className="border rounded px-3 py-2" value={campoCantidadId} onChange={(e) => setCampoCantidadId(e.target.value)}>
                <option value="">(Opcional) ¿Cuál campo es la cantidad?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <select className="border rounded px-3 py-2" value={campoPrecioId} onChange={(e) => setCampoPrecioId(e.target.value)}>
                <option value="">(Opcional) ¿Cuál campo es el precio unitario?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
              <select className="border rounded px-3 py-2" value={campoVencimientoId} onChange={(e) => setCampoVencimientoId(e.target.value)}>
                <option value="">(Opcional) ¿Cuál campo es la fecha de vencimiento?</option>
                {modulo.campos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </>
          )}

          <button
            onClick={() => guardarRolContacto.mutate()}
            disabled={guardarRolContacto.isPending || (esClienteOProveedor && (!campoNombreId || !campoCorreoId))}
            className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60 self-start"
          >
            {guardarRolContacto.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          {guardarRolContacto.isSuccess && <p className="text-emerald text-sm">Guardado.</p>}
          {guardarRolContacto.isError && (
            <p className="text-red-600 text-sm">
              {(guardarRolContacto.error as any)?.response?.data?.message ?? 'Error al guardar'}
            </p>
          )}
        </div>
      </div>

      {/* Carga masiva a este módulo */}
      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-2">Carga masiva</h2>
        <p className="text-slate text-sm mb-3">
          Sube un CSV o Excel — el encabezado de cada columna debe coincidir con la etiqueta
          (o el nombre técnico) de un campo de este módulo.
        </p>
        <input
          ref={inputArchivoRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) subirArchivo.mutate(archivo);
          }}
          className="text-sm"
        />
        {subirArchivo.isPending && <p className="text-slate text-sm mt-1">Subiendo archivo...</p>}
        {subirArchivo.isError && <p className="text-red-600 text-sm mt-1">Error al subir el archivo.</p>}
        {estadoTrabajo && (
          <div className="text-sm mt-2">
            <p className="text-ink">
              Estado: <strong>{estadoTrabajo.estado}</strong>
              {estadoTrabajo.totalFilas > 0 && ` — ${estadoTrabajo.filasProcesadas}/${estadoTrabajo.totalFilas} filas`}
            </p>
            {estadoTrabajo.filasError > 0 && (
              <details className="mt-1">
                <summary className="text-amber cursor-pointer">{estadoTrabajo.filasError} fila(s) con error</summary>
                <ul className="text-xs text-slate mt-1 list-disc pl-4">
                  {(estadoTrabajo.detalleErrores ?? []).map((e: any, i: number) => (
                    <li key={i}>Fila {e.fila}: {e.error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-3">Campos</h2>
        <div className="flex flex-col divide-y divide-slate-100 mb-4">
          {modulo.campos.map((c) => (
            <div key={c.id} className="py-2 text-sm text-ink">
              {c.etiqueta}{' '}
              <span className="text-slate text-xs">({c.tipoDato.toLowerCase()}{c.esObligatorio ? ', obligatorio' : ''})</span>
            </div>
          ))}
          {modulo.campos.length === 0 && <p className="text-slate text-sm py-2">Sin campos todavía.</p>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            agregarCampo.mutate();
          }}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <input className="border rounded px-3 py-2" placeholder="Nombre técnico del campo (ej. correo)" value={nombreCampo} onChange={(e) => setNombreCampo(e.target.value)} required />
          <input className="border rounded px-3 py-2" placeholder="Etiqueta visible (ej. Correo electrónico)" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} required />
          <select className="border rounded px-3 py-2" value={tipoDato} onChange={(e) => setTipoDato(e.target.value as TipoCampo)}>
            <option value="TEXTO">Texto</option>
            <option value="NUMERO">Número</option>
            <option value="FECHA">Fecha</option>
            <option value="BOOLEANO">Sí/No</option>
            <option value="SELECCION">Selección</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={esObligatorio} onChange={(e) => setEsObligatorio(e.target.checked)} />
            Obligatorio
          </label>
          <button type="submit" disabled={agregarCampo.isPending} className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60 self-start">
            {agregarCampo.isPending ? 'Agregando...' : 'Agregar campo'}
          </button>
        </form>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="font-display text-lg text-ink mb-3">Registros</h2>
        {modulo.campos.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearRegistro.mutate();
            }}
            className="flex flex-col gap-2 mb-4 border-b pb-4"
          >
            {modulo.campos.map((c) => (
              <input
                key={c.id}
                className="border rounded px-3 py-2"
                placeholder={c.etiqueta}
                value={datosNuevoRegistro[c.nombreCampo] ?? ''}
                onChange={(e) => setDatosNuevoRegistro((prev) => ({ ...prev, [c.nombreCampo]: e.target.value }))}
                required={c.esObligatorio}
              />
            ))}
            <button type="submit" disabled={crearRegistro.isPending} className="bg-emerald text-paper rounded px-4 py-2 hover:bg-emerald-light disabled:opacity-60 self-start">
              {crearRegistro.isPending ? 'Guardando...' : 'Agregar registro'}
            </button>
          </form>
        )}

        {cargandoRegistros && <p className="text-slate text-sm">Cargando...</p>}
        <div className="flex flex-col divide-y divide-slate-100">
          {registros?.map((r) => (
            <div key={r.id} className="py-2 text-sm text-ink">
              {modulo.campos.map((c) => r.datos[c.nombreCampo]).filter(Boolean).join(' · ')}
            </div>
          ))}
          {registros?.length === 0 && <p className="text-slate text-sm py-2">Sin registros todavía.</p>}
        </div>
      </div>
    </div>
  );
}
