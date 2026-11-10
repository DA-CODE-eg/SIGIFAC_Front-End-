import { Link } from 'react-router-dom';

export default function AccesoDenegado() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl">🔒</div>
      <h2 className="mt-4 text-2xl font-semibold text-[#10274d]">Acceso no autorizado</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Tu usuario no tiene permisos para consultar este módulo. Si necesitas acceso, solicita al administrador de tu empresa que ajuste tu rol.
      </p>
      <Link to="/dashboard" className="mt-6 inline-flex rounded-xl bg-[#254a7e] px-5 py-2.5 text-sm font-semibold text-white">
        Volver al dashboard
      </Link>
    </div>
  );
}
