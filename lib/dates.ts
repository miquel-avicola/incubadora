// Calcula la data de naixement (+21 dies des de càrrega)
export function calcularNaixement(dataCarrega: string): string {
  if (!dataCarrega) return ''
  const d = new Date(dataCarrega + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + 21)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Calcula la data de transferència proposada
// Naixement dilluns (1) → transferència divendres anterior (càrrega +18)
// Naixement dijous (4) → transferència dimarts anterior (càrrega +19)
export function calcularTransferencia(dataCarrega: string): string {
  if (!dataCarrega) return ''
  const naixementStr = calcularNaixement(dataCarrega)
  if (!naixementStr) return ''
  const naix = new Date(naixementStr + 'T00:00:00')
  const diaNaix = naix.getDay()
  const carrega = new Date(dataCarrega + 'T00:00:00')
  const trans = new Date(carrega)

  if (diaNaix === 1) {
    trans.setDate(trans.getDate() + 18)
  } else if (diaNaix === 4) {
    trans.setDate(trans.getDate() + 19)
  } else {
    trans.setDate(trans.getDate() + 18)
  }
  return trans.toISOString().split('T')[0]
}

// Formatar data per mostrar
export function formatData(data: string): string {
  if (!data) return '—'
  const d = new Date(data + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Nom del dia de la setmana
export function diaSemana(data: string): string {
  if (!data) return ''
  const dies = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte']
  const d = new Date(data + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return dies[d.getDay()]
}
