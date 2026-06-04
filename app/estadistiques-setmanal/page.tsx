import { redirect } from 'next/navigation'

// Aquesta ruta s'ha mogut a /estadistiques/setmanal
export default function EstadistiquesSetmanalRedirect() {
  redirect('/estadistiques/setmanal')
}
