import { redirect } from 'next/navigation'
import { FormularioCaso } from '@/components/siniestros/FormularioCaso'
import { reglasVigentes, sesionSiniestros } from '@/lib/siniestros/servidor'

export const dynamic = 'force-dynamic'

export default async function NuevoCaso() {
  const sesion = await sesionSiniestros()
  if (!sesion) redirect('/auth/login?redirect=/siniestros/nuevo')
  const { supabase, usuario } = sesion
  const [{ data: productos }, { data: liquidadores }] = await Promise.all([
    supabase.from('productos_seguro').select('id, nombre').eq('activo', true).order('id'),
    supabase.from('usuarios').select('id, nombre').eq('rol', 'liquidador').eq('activo', true).order('nombre'),
  ])
  const reglas = await Promise.all((productos ?? [{ id: 'SOAP', nombre: 'SOAP' }]).map(p => reglasVigentes(supabase, p.id)))

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white md:text-3xl">Nuevo denuncio</h1>
        <p className="mt-1 text-sm text-gray-500">
          Registra el siniestro. El régimen de topes se determina por la <strong className="text-gray-300">fecha de contratación de la póliza</strong> y el checklist se genera desde las reglas del producto.
        </p>
      </div>
      <FormularioCaso reglas={reglas} liquidadores={liquidadores ?? []} rol={usuario.rol} />
    </div>
  )
}
