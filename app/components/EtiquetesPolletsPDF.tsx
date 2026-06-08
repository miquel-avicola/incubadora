// app/components/EtiquetesPolletsPDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const MM = 2.8346456692913385

export interface LabelPollet {
  client: string           // Detall (baix-esquerra): nom del client
  poblacio: string | null  // Principal (dalt): població de la granja
  nom_granja: string       // Principal (dalt): nom de la granja
  nau: string | null       // Detall (baix-centre): nau (si existeix)
  sexe: string | null      // Detall (baix-dreta): 'M', 'F', o null
  esPico: boolean
}

const styles = StyleSheet.create({
  page: {
    width: 90 * MM,
    height: 70 * MM,
    paddingLeft: 2 * MM,
    paddingRight: 2 * MM,
    paddingTop: 2 * MM,
    paddingBottom: 2 * MM,
    backgroundColor: '#ffffff',
    flexDirection: 'column',
    fontFamily: 'Helvetica',
  },
  // Marc visible del contingut (dins de la zona imprimible)
  frame: {
    flex: 1,
    border: '1pt solid #000000',
    flexDirection: 'column',
  },
  // Secció principal (dalt): Granja + població ben grans
  seccioPrincipal: {
    flex: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1pt solid #000000',
    paddingHorizontal: 2 * MM,
    paddingVertical: 2 * MM,
    position: 'relative',
  },
  textGranja: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#000000',
    lineHeight: 1.1,
  },
  textPoblacio: {
    fontSize: 16,
    textAlign: 'center',
    color: '#000000',
    marginTop: 2 * MM,
  },
  picoIndicador: {
    position: 'absolute',
    top: 1.5 * MM,
    right: 1.5 * MM,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    border: '1pt solid #000000',
    paddingHorizontal: 1.5 * MM,
    paddingVertical: 0.3 * MM,
  },
  // Secció detalls (baix): Client · Nau · Sexe (esquerra → dreta)
  seccioDetalls: {
    flex: 1,
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1 * MM,
  },
  colClient: {
    flex: 1.4,
  },
  colBorder: {
    borderRight: '1pt solid #000000',
  },
  colLabel: {
    fontSize: 8,
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1 * MM,
  },
  colValor: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    color: '#000000',
  },
})

function LabelPage({ label }: { label: LabelPollet }) {
  const sexeText = label.sexe === 'M' ? 'MASCLES' : label.sexe === 'F' ? 'FEMELLES' : '—'

  return (
    <Page size={[90 * MM, 70 * MM]} style={styles.page}>
      <View style={styles.frame}>
        {/* Secció principal: Granja + població (grans) */}
        <View style={styles.seccioPrincipal}>
          {label.esPico && <Text style={styles.picoIndicador}>PICO</Text>}
          <Text style={styles.textGranja}>{label.nom_granja}</Text>
          {label.poblacio && (
            <Text style={styles.textPoblacio}>{label.poblacio}</Text>
          )}
        </View>

        {/* Secció detalls: Client · Nau · Sexe (esquerra → dreta) */}
        <View style={styles.seccioDetalls}>
          <View style={[styles.col, styles.colClient, styles.colBorder]}>
            <Text style={styles.colLabel}>Client</Text>
            <Text style={styles.colValor}>{label.client || '—'}</Text>
          </View>
          <View style={[styles.col, styles.colBorder]}>
            <Text style={styles.colLabel}>Nau</Text>
            <Text style={styles.colValor}>{label.nau || '—'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Sexe</Text>
            <Text style={styles.colValor}>{sexeText}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}

export default function EtiquetesPolletsPDF({ labels }: { labels: LabelPollet[] }) {
  return (
    <Document>
      {labels.map((label, i) => (
        <LabelPage key={i} label={label} />
      ))}
    </Document>
  )
}
