import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { feedback } from '../lib/feedback';

interface Proveedor {
  id: number;
  tipo: 'PROVEEDOR' | 'AMBOS';
  tipoIdentificacion?: string | null;
  numeroIdentificacion: string;
  nombreRazonSocial: string;
  nombreContacto?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  pais?: string | null;
  responsabilidadFiscal?: string | null;
  notas?: string | null;
  activo: boolean;
}

const formularioInicial = {
  tipo: 'PROVEEDOR',
  tipoIdentificacion: 'NIT',
  numeroIdentificacion: '',
  nombreRazonSocial: '',
  nombreContacto: '',
  correo: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  departamento: '',
  pais: 'Colombia',
  responsabilidadFiscal: '',
  notas: '',
};

export default function Proveedores() {
  const queryClient = useQueryClient();
  const [buscar, setBuscar] = useState('');
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [form, setForm] = useState<any>(formularioInicial);
  const [proveedorEditando, setProveedorEditando] = useState<any | null>(null);
  const [formEditar, setFormEditar] = useState<any>(formularioInicial);

  const { data: proveedores = [], isLoading } = useQuery<Proveedor[]>({
    queryKey: ['proveedores', buscar],
    queryFn: async () =>
      (
        await api.get('/contactos', {
          params: {
            tipo: 'PROVEEDOR',
            ...(buscar.trim() ? { buscar: buscar.trim() } : {}),
          },
        })
      ).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      api.post('/contactos', {
        ...form,
        tipo: 'PROVEEDOR',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      await queryClient.invalidateQueries({ queryKey: ['contactos'] });
      setMostrarNuevo(false);
      setForm(formularioInicial);
      await feedback.exito('Proveedor creado', 'El registro quedó disponible en SIGIFAC.');
    },
  });

  const editar = useMutation({
    mutationFn: async () =>
      api.patch(`/contactos/${proveedorEditando.id}`, formEditar),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      await queryClient.invalidateQueries({ queryKey: ['contactos'] });
      setProveedorEditando(null);
      await feedback.exito('Proveedor actualizado', 'Los cambios se guardaron correctamente.');
    },
  });

  const cambiarActivo = useMutation({
    mutationFn: async (item: any) =>
      api.patch(`/contactos/${item.id}`, {
        activo: !item.activo,
      }),
    onSuccess: async (_data, item) => {
      await queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      await queryClient.invalidateQueries({ queryKey: ['contactos'] });
      await feedback.exito(
        item.activo ? 'Proveedor desactivado' : 'Proveedor activado',
        item.activo
          ? 'El registro se conserva, pero queda fuera de nuevas operaciones.'
          : 'El registro vuelve a estar disponible para la operación.',
      );
    },
  });

  const confirmarCambioActivo = async (item: any) => {
    const activar = !item.activo;

    const respuesta = await feedback.confirmar(
      activar ? '¿Activar proveedor?' : '¿Desactivar proveedor?',
      activar
        ? `${item.nombreRazonSocial} volverá a estar disponible en el sistema.`
        : `${item.nombreRazonSocial} se conservará en el historial, pero quedará inactivo.`,
      activar ? 'Activar' : 'Desactivar',
    );

    if (!respuesta.isConfirmed) return;

    cambiarActivo.mutate(item);
  };

  const activos = useMemo(() => proveedores.filter((x) => x.activo).length, [proveedores]);
  const conCorreo = useMemo(() => proveedores.filter((x) => Boolean(x.correo)).length, [proveedores]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          
          <h1 className="text-3xl font-semibold text-[#253043]">Proveedores</h1>
        </div>

        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-xl bg-[#1f4f82] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#183f69]"
        >
          + Nuevo proveedor
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Kpi etiqueta="Proveedores" valor={proveedores.length} />
        <Kpi etiqueta="Activos" valor={activos} />
        <Kpi etiqueta="Con correo" valor={conCorreo} />
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar proveedor por nombre, identificación, correo o teléfono..."
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#1f4f82]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-[#253043]">Directorio de proveedores</h2>
          <p className="mt-1 text-xs text-slate-500">{proveedores.length} proveedor(s)</p>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-slate-500">Cargando proveedores...</p>
        ) : proveedores.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-[#253043]">Todavía no hay proveedores</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Nombre / Razón social</th>
                  <th className="px-4 py-3">Identificación</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((proveedor) => (
                  <tr key={proveedor.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#253043]">{proveedor.nombreRazonSocial}</p>
                      {proveedor.nombreContacto && (
                        <p className="text-xs text-slate-500">{proveedor.nombreContacto}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p>{proveedor.numeroIdentificacion}</p>
                      <p className="text-xs text-slate-400">{proveedor.tipoIdentificacion || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{proveedor.correo || '—'}</p>
                      <p className="text-xs text-slate-500">{proveedor.telefono || ''}</p>
                    </td>
                    <td className="px-4 py-3">{proveedor.ciudad || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        proveedor.activo
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {proveedor.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setProveedorEditando(proveedor);
                            setFormEditar({ ...proveedor });
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarCambioActivo(proveedor)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          {proveedor.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarNuevo && (
        <Modal titulo="Nuevo proveedor" onClose={() => setMostrarNuevo(false)}>
          <FormularioContacto
            form={form}
            setForm={setForm}
            tipo="PROVEEDOR"
            textoBoton={crear.isPending ? 'Guardando...' : 'Guardar proveedor'}
            onSubmit={() => crear.mutate()}
            disabled={crear.isPending}
            error={crear.isError}
          />
        </Modal>
      )}

      {proveedorEditando && (
        <Modal titulo="Editar proveedor" onClose={() => setProveedorEditando(null)}>
          <FormularioContacto
            form={formEditar}
            setForm={setFormEditar}
            tipo="PROVEEDOR"
            textoBoton={editar.isPending ? 'Guardando...' : 'Guardar cambios'}
            onSubmit={() => editar.mutate()}
            disabled={editar.isPending}
            error={editar.isError}
          />
        </Modal>
      )}
    </div>
  );
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-2 text-2xl font-semibold text-[#253043]">{valor}</p>
    </div>
  );
}

function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h3 className="text-xl font-semibold text-[#253043]">{titulo}</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-lg text-xl text-slate-400 hover:bg-slate-100">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>

    </div>
  );
}

function FormularioContacto({
  form,
  setForm,
  tipo,
  textoBoton,
  onSubmit,
  disabled,
  error,
}: {
  form: any;
  setForm: (value: any) => void;
  tipo: 'CLIENTE' | 'PROVEEDOR';
  textoBoton: string;
  onSubmit: () => void;
  disabled: boolean;
  error: boolean;
}) {
  const campo = (key: string) => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Tipo de identificación</label>
          <select {...campo('tipoIdentificacion')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
            <option value="NIT">NIT</option>
            <option value="CC">Cédula de ciudadanía</option>
            <option value="CE">Cédula de extranjería</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Número de identificación</label>
          <input {...campo('numeroIdentificacion')} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Nombre / Razón social</label>
          <input {...campo('nombreRazonSocial')} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Persona de contacto</label>
          <input {...campo('nombreContacto')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Correo</label>
          <input {...campo('correo')} type="email" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Teléfono</label>
          <input {...campo('telefono')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Ciudad</label>
          <input {...campo('ciudad')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Departamento</label>
          <input {...campo('departamento')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">País</label>
          <input {...campo('pais')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Dirección</label>
          <input {...campo('direccion')} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Responsabilidad fiscal</label>
          <input {...campo('responsabilidadFiscal')} placeholder="Opcional" className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-[#253043]">Notas</label>
          <textarea {...campo('notas')} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">No se pudo guardar el {tipo === 'CLIENTE' ? 'proveedor' : 'proveedor'}.</p>}

      <div className="mt-6 flex justify-end">
        <button
          disabled={disabled}
          className="rounded-xl bg-[#1f4f82] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {textoBoton}
        </button>
      </div>
    </form>
  );
}
