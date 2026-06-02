// app/components/EtiquetesPolletsPDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const MM = 2.8346456692913385

export interface LabelPollet {
  client: string           // Secció 1 (top): nom del client + població
  poblacio: string | null  // Secció 1 (top): població de la granja
  nom_granja: string       // Secció 2 (mig): nom de la granja
  nau: string | null       // Secció 2 (mig): nau (si existeix)
  sexe: string | null      // Secció 3 (baix): 'M', 'F', o null
  esPico: boolean
}

const styles = StyleSheet.create({
  page: {
    width: 50 * MM,
    height: 50 * MM,
    padding: 0,
    backgroundColor: '#ffffff',
    border: '1pt solid #000000',
  },
  seccioClient: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1pt solid #000000',
    paddingHorizontal: 3 * MM,
  },
  seccioGranja: {
    flex: 1.7,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1pt solid #000000',
    paddingHorizontal: 3 * MM,
  },
  seccioSexe: {
    flex: 1.3,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3 * MM,
  },
  textClient: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
  },
  textPoblacio: {
    fontSize: 9,
    textAlign: 'center',
    color: '#000000',
    marginTop: 2,
  },
  textGranja: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    lineHeight: 1.3,
  },
  textNau: {
    fontSize: 9,
    textAlign: 'center',
    color: '#000000',
    marginTop: 2,
  },
  textSexe: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    textTransform: 'uppercase',
  },
  picoIndicador: {
    position: 'absolute',
    bottom: 2,
    right: 3 * MM,
    fontSize: 7,
    color: '#666666',
    fontStyle: 'italic',
  },
})

function LabelPage({ label }: { label: LabelPollet }) {
  const sexeText = label.sexe === 'M' ? 'MASCLES' : label.sexe === 'F' ? 'FEMELLES' : ''

  return (
    <Page size={[50 * MM, 50 * MM]} style={styles.page}>
      {/* Secció 1: Client + població */}
      <View style={styles.seccioClient}>
        <Text style={styles.textClient}>{label.client}</Text>
        {label.poblacio && (
          <Text style={styles.textPoblacio}>{label.poblacio}</Text>
        )}
      </View>

      {/* Secció 2: Granja + nau */}
      <View style={styles.seccioGranja}>
        <Text style={styles.textGranja}>{label.nom_granja}</Text>
        {label.nau && (
          <Text style={styles.textNau}>Nau {label.nau}</Text>
        )}
      </View>

      {/* Secció 3: Sexe */}
      <View style={styles.seccioSexe}>
        <Text style={styles.textSexe}>{sexeText}</Text>
        {label.esPico && (
          <Text style={styles.picoIndicador}>PICO</Text>
        )}
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
