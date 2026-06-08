import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const MM = 2.835
const s = StyleSheet.create({
  page: {
    width: 90 * MM, height: 70 * MM,
    paddingTop: 2 * MM,
    paddingBottom: 2 * MM,
    paddingLeft: 2 * MM,
    paddingRight: 2 * MM,
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
  },
  fila1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#ccc',
    paddingBottom: 3 * MM,
    marginBottom: 3 * MM,
  },
  numCarrega: { fontSize: 32, fontFamily: 'Helvetica-Bold' },
  numCarro: { fontSize: 23, fontFamily: 'Helvetica-Bold' },
  fila2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#ccc',
    paddingBottom: 3 * MM,
    marginBottom: 3 * MM,
  },
  granja: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  posta: { fontSize: 13 },
  fila3: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  data: { fontSize: 15, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
})

function formatData(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}/${y}`
}

function calcularNaixement(carrega: string) {
  const d = new Date(carrega)
  d.setDate(d.getDate() + 21)
  return d.toISOString().split('T')[0]
}

interface Assignacio {
  num_carro_full: number
  carros_estoc: {
    posta: string
    lots_reproductores: {
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
}

interface Full {
  num_carrega: number
  carrega: string
  transferencia: string | null
  assignacions: Assignacio[]
}

export function EtiquetesCàrregaPDF({ full }: { full: Full }) {
  const naixement = calcularNaixement(full.carrega)
  const assignacionsOrdenades = [...full.assignacions].sort((a, b) => a.num_carro_full - b.num_carro_full)

  return (
    <Document>
      {assignacionsOrdenades.map((a) => {
        const lot = a.carros_estoc.lots_reproductores
        const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
        const estirp = lot.estirp ? ` ${lot.estirp}` : ''
        return (
          <Page key={a.num_carro_full} size={[90 * MM, 70 * MM]} style={s.page}>
            <View style={s.fila1}>
              <Text style={s.numCarrega}>{full.num_carrega}</Text>
              <Text style={s.numCarro}>{a.num_carro_full}</Text>
            </View>
            <View style={s.fila2}>
              <Text style={s.granja}>{granja}{estirp}</Text>
              <Text style={s.posta}>{formatData(a.carros_estoc.posta)}</Text>
            </View>
            <View style={s.fila3}>
              <Text style={s.data}>{formatData(full.carrega)}</Text>
              <Text style={s.data}>{full.transferencia ? formatData(full.transferencia) : '—'}</Text>
              <Text style={s.data}>{formatData(naixement)}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}