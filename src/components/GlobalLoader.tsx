import { useUiStore } from '../store/ui.store';

export default function GlobalLoader() {
  const peticionesActivas = useUiStore(
    (state) => state.peticionesActivas,
  );

  if (peticionesActivas <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/15 backdrop-blur-[1px]"
      aria-live="polite"
      aria-label="Cargando"
    >
      <div className="flex min-w-[180px] flex-col items-center rounded-2xl border border-slate-200 bg-white px-7 py-6 shadow-2xl">
        <div className="sigifac-spinner" />
        <p className="mt-4 text-sm font-semibold text-[#10274d]">
          Procesando
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Sertiva está actualizando la información
        </p>
      </div>
    </div>
  );
}
