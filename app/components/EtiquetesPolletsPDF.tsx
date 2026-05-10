import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const MM = 2.835
const s = StyleSheet.create({
  page: {
    width: 90 * MM,
    height: 70 * MM,
    padding: 4 * MM,
    fontFamily: 'Helvetica',
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3 * MM,
  },
  title: { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  section: {
    marginBottom: 2 * MM,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1 * MM,
  },
  value: {
    fontSize: 11,
    lineHeight: 1.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  smallText: {
    fontSize: 10,
  },
})

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)}/${parseInt(m)}/${y}`
}

interface ExpedicioLot {
  id: number
  pollets: number
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Expedicio {
  id: number
  ordre: number | null
  pollets_comanda: number | null
  comandes: { id: number; clients: { id: number; nom: string } }
  destinacions: { nom_granja: string; nau: string | null }
  expedicio_lots: ExpedicioLot[]
}

interface Full {
  num_carrega: number
  carrega: string
  expedicions: Expedicio[]
}

export function EtiquetesPolletsPDF({ full }: { full: Full }) {
  return (
    <Document>
      {full.expedicions.map((expedicio) => {
        const destinacio = expedicio.destinacions.nau
          ? `${expedicio.destinacions.nom_granja} ${expedicio.destinacions.nau}`
          : expedicio.destinacions.nom_granja
        const lotsText = expedicio.expedicio_lots
          .map(lot => {
            const granja = lot.lots_reproductores.granges_reproductores.nom_informal || lot.lots_reproductores.granges_reproductores.granja
            const estirp = lot.lots_reproductores.estirp ? ` ${lot.lots_reproductores.estirp}` : ''
            return `${lot.pollets.toLocaleString()} de ${granja}${estirp}`
          })
          .join(' + ')
        return (
          <Page key={expedicio.id} size={[90 * MM, 70 * MM]} style={s.page}>
            <View style={s.header}>
              <Text style={s.title}>#{full.num_carrega}</Text>
              <Text style={s.title}>{expedicio.ordre ?? expedicio.id}</Text>
            </View>
            <View style={s.section}>
              <Text style={s.label}>Client</Text>
              <Text style={s.value}>{expedicio.comandes.clients.nom}</Text>
            </View>
            <View style={s.section}>
              <Text style={s.label}>Destinació</Text>
              <Text style={s.value}>{destinacio}</Text>
            </View>
            <View style={s.section}>
              <Text style={s.label}>Pollets previstos</Text>
              <Text style={s.value}>{expedicio.pollets_comanda?.toLocaleString() ?? '—'}</Text>
            </View>
            <View style={s.section}>
              <Text style={s.label}>Lots</Text>
              <Text style={s.value}>{lotsText || 'Sense lots assignats'}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.smallText}>Càrrega: {formatDate(full.carrega)}</Text>
              <Text style={s.smallText}>{formatDate(full.carrega)}</Text>
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
