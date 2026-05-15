import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { Fragment } from 'react'

const s = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 26, paddingHorizontal: 22, fontFamily: 'Helvetica', fontSize: 8, color: '#111', backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingBottom: 5, marginBottom: 6 },
  title: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  sub: { fontSize: 7, color: '#888', marginTop: 1 },
  dateCol: { alignItems: 'center', marginLeft: 12 },
  dateLabel: { fontSize: 6, color: '#888', textTransform: 'uppercase' },
  dateVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  secTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 2 },
  cards: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  card: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 3, padding: 4, alignItems: 'center' },
  cardVal: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  cardLbl: { fontSize: 6, color: '#888', marginTop: 1 },
  th: { flexDirection: 'row', backgroundColor: '#222', paddingVertical: 3, paddingHorizontal: 4, borderRadius: 2 },
  thc: { color: 'white', fontSize: 7, fontFamily: 'Helvetica-Bold', flex: 1, textAlign: 'center' },
  thl: { color: 'white', fontSize: 7, fontFamily: 'Helvetica-Bold', flex: 2.5, textAlign: 'left' },
  tr: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tralt: { backgroundColor: '#fafafa' },
  trLot: { flexDirection: 'row', paddingVertical: 1, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', backgroundColor: '#fbfbfb' },
  tc: { flex: 1, textAlign: 'center', fontSize: 7.5 },
  tl: { flex: 2.5, textAlign: 'left', fontSize: 7.5 },
  tcDim: { flex: 1, textAlign: 'center', fontSize: 6.5, color: '#666' },
  tlDim: { flex: 2.5, textAlign: 'left', fontSize: 6.5, color: '#666', paddingLeft: 8 },
  bold: { fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 10, left: 22, right: 22, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6, color: '#aaa', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 3 },
})

function col(v: number | null, tipus: 'f' | 'e' | 'p') {
  if (v === null) return '#888'
  if (tipus === 'p') return v < 5 ? '#16a34a' : v < 12 ? '#d97706' : '#dc2626'
  return v >= 82 ? '#16a34a' : v >= 72 ? '#d97706' : '#dc2626'
}
function fmt(v: number | null) { return v === null ? '—' : `${v}%` }

interface LotEnIncubadora {
  lot_id: number
  nom: string
  carros: number
  ous: number
  fertils: number
  pollets: number
  fertilitat: number | null
  taxa_eclosio: number | null
  naixement: number | null
}

interface LotEnNaixedora {
  lot_id: number
  nom: string
  carros: number
  ous: number
  fertils: number
  pollets: number
  taxa_eclosio: number | null
  naixement: number | null
  perdua: number | null
}

export interface EstadistiquesData {
  resum: { total_ous: number; ous_fertils: number; ous_explosius: number; pollets: number; fertilitat: number | null; taxa_eclosio: number | null; naixement: number | null; perdua: number | null }
  per_lot: { nom: string; carros: number; ous: number; fertils: number; pollets: number; fertilitat: number | null; taxa_eclosio: number | null; naixement: number | null; perdua: number | null }[]
  per_incubadora: { numero: number; model: string; carros: number; ous: number; fertils: number; pollets: number; fertilitat: number | null; taxa_eclosio: number | null; naixement: number | null; lots: LotEnIncubadora[] }[]
  per_naixedora: { numero: number; ous: number; fertils: number; pollets: number; taxa_eclosio: number | null; naixement: number | null; perdua: number | null; lots: LotEnNaixedora[] }[]
}

export function EstadistiquesPDF({ stats, numCarrega, dataCarrega, dataNaixement }: { stats: EstadistiquesData; numCarrega: number; dataCarrega: string; dataNaixement: string }) {
  const r = stats.resum
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Estadístiques Càrrega #{numCarrega}</Text>
            <Text style={s.sub}>Miquel Avícola — Sala d&apos;incubació</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {[['Càrrega', dataCarrega], ['Naixement', dataNaixement]].map(([lbl, val]) => (
              <View key={lbl} style={s.dateCol}>
                <Text style={s.dateLabel}>{lbl}</Text>
                <Text style={s.dateVal}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.secTitle}>Resum global</Text>
        <View style={s.cards}>
          {[
            { lbl: 'Fertilitat', val: r.fertilitat, tipus: 'f' as const },
            { lbl: 'Taxa eclosió', val: r.taxa_eclosio, tipus: 'e' as const },
            { lbl: 'Naixement', val: r.naixement, tipus: 'e' as const },
            { lbl: 'Pèrdua transf.', val: r.perdua, tipus: 'p' as const },
          ].map(({ lbl, val, tipus }) => (
            <View key={lbl} style={s.card}>
              <Text style={[s.cardVal, { color: col(val, tipus) }]}>{fmt(val)}</Text>
              <Text style={s.cardLbl}>{lbl}</Text>
            </View>
          ))}
        </View>
        <View style={s.cards}>
          {[
            { lbl: 'Ous totals', val: r.total_ous.toLocaleString(), color: '#111' },
            { lbl: 'Ous fèrtils', val: r.ous_fertils.toLocaleString(), color: '#111' },
            { lbl: 'Explosius', val: r.ous_explosius.toLocaleString(), color: '#dc2626' },
            { lbl: 'Pollets', val: r.pollets.toLocaleString(), color: '#16a34a' },
          ].map(({ lbl, val, color }) => (
            <View key={lbl} style={s.card}>
              <Text style={[s.cardVal, { fontSize: 11, color }]}>{val}</Text>
              <Text style={s.cardLbl}>{lbl}</Text>
            </View>
          ))}
        </View>

        <Text style={s.secTitle}>Per lot de reproductores</Text>
        <View style={s.th}>
          <Text style={s.thl}>Lot</Text>
          {['Carros', 'Ous', 'Fèrtils', 'Pollets', 'Fertilitat', 'Eclosió', 'Naix.', 'Pèrdua'].map(h => <Text key={h} style={s.thc}>{h}</Text>)}
        </View>
        {stats.per_lot.map((l, i) => (
          <View key={i} style={[s.tr, i % 2 === 1 ? s.tralt : {}]}>
            <Text style={s.tl}>{l.nom}</Text>
            <Text style={s.tc}>{l.carros}</Text>
            <Text style={s.tc}>{l.ous.toLocaleString()}</Text>
            <Text style={s.tc}>{l.fertils.toLocaleString()}</Text>
            <Text style={s.tc}>{l.pollets.toLocaleString()}</Text>
            <Text style={[s.tc, { color: col(l.fertilitat, 'f') }]}>{fmt(l.fertilitat)}</Text>
            <Text style={[s.tc, { color: col(l.taxa_eclosio, 'e') }]}>{fmt(l.taxa_eclosio)}</Text>
            <Text style={[s.tc, { color: col(l.naixement, 'e') }]}>{fmt(l.naixement)}</Text>
            <Text style={[s.tc, { color: col(l.perdua, 'p') }]}>{fmt(l.perdua)}</Text>
          </View>
        ))}

        <Text style={s.secTitle}>Per incubadora</Text>
        <View style={s.th}>
          <Text style={[s.thc, { flex: 0.5 }]}>Inc.</Text>
          <Text style={[s.thc, { flex: 2, textAlign: 'left' }]}>Model / Lot</Text>
          {['Carros', 'Ous', 'Fèrtils', 'Pollets', 'Fertilitat', 'Eclosió', 'Naix.'].map(h => <Text key={h} style={s.thc}>{h}</Text>)}
        </View>
        {stats.per_incubadora.map((inc, i) => (
          <Fragment key={`inc-${inc.numero}`}>
            <View style={[s.tr, i % 2 === 1 ? s.tralt : {}]}>
              <Text style={[s.tc, s.bold, { flex: 0.5 }]}>{inc.numero}</Text>
              <Text style={[s.tc, s.bold, { flex: 2, textAlign: 'left' }]}>{inc.model}</Text>
              <Text style={[s.tc, s.bold]}>{inc.carros}</Text>
              <Text style={[s.tc, s.bold]}>{inc.ous.toLocaleString()}</Text>
              <Text style={[s.tc, s.bold]}>{inc.fertils.toLocaleString()}</Text>
              <Text style={[s.tc, s.bold]}>{inc.pollets.toLocaleString()}</Text>
              <Text style={[s.tc, s.bold, { color: col(inc.fertilitat, 'f') }]}>{fmt(inc.fertilitat)}</Text>
              <Text style={[s.tc, s.bold, { color: col(inc.taxa_eclosio, 'e') }]}>{fmt(inc.taxa_eclosio)}</Text>
              <Text style={[s.tc, s.bold, { color: col(inc.naixement, 'e') }]}>{fmt(inc.naixement)}</Text>
            </View>
            {inc.lots && inc.lots.map((l) => (
              <View key={`inc-${inc.numero}-lot-${l.lot_id}`} style={s.trLot}>
                <Text style={[s.tcDim, { flex: 0.5 }]}></Text>
                <Text style={[s.tlDim, { flex: 2 }]}>└ {l.nom}</Text>
                <Text style={s.tcDim}>{l.carros}</Text>
                <Text style={s.tcDim}>{l.ous.toLocaleString()}</Text>
                <Text style={s.tcDim}>{l.fertils.toLocaleString()}</Text>
                <Text style={s.tcDim}>{l.pollets.toLocaleString()}</Text>
                <Text style={[s.tcDim, { color: col(l.fertilitat, 'f') }]}>{fmt(l.fertilitat)}</Text>
                <Text style={[s.tcDim, { color: col(l.taxa_eclosio, 'e') }]}>{fmt(l.taxa_eclosio)}</Text>
                <Text style={[s.tcDim, { color: col(l.naixement, 'e') }]}>{fmt(l.naixement)}</Text>
              </View>
            ))}
          </Fragment>
        ))}

        {stats.per_naixedora.length > 0 && (
          <>
            <Text style={s.secTitle}>Per naixedora</Text>
            <View style={s.th}>
              <Text style={[s.thc, { flex: 0.6 }]}>N.</Text>
              <Text style={[s.thc, { flex: 2, textAlign: 'left' }]}>Lot</Text>
              {['Ous', 'Fèrtils', 'Pollets', 'Eclosió', 'Naix.', 'Pèrdua'].map(h => <Text key={h} style={s.thc}>{h}</Text>)}
            </View>
            {stats.per_naixedora.map((n, i) => (
              <Fragment key={`nax-${n.numero}`}>
                <View style={[s.tr, i % 2 === 1 ? s.tralt : {}]}>
                  <Text style={[s.tc, s.bold, { flex: 0.6 }]}>N{n.numero}</Text>
                  <Text style={[s.tc, { flex: 2, textAlign: 'left', color: '#888' }]}>—</Text>
                  <Text style={[s.tc, s.bold]}>{n.ous.toLocaleString()}</Text>
                  <Text style={[s.tc, s.bold]}>{n.fertils.toLocaleString()}</Text>
                  <Text style={[s.tc, s.bold]}>{n.pollets.toLocaleString()}</Text>
                  <Text style={[s.tc, s.bold, { color: col(n.taxa_eclosio, 'e') }]}>{fmt(n.taxa_eclosio)}</Text>
                  <Text style={[s.tc, s.bold, { color: col(n.naixement, 'e') }]}>{fmt(n.naixement)}</Text>
                  <Text style={[s.tc, s.bold, { color: col(n.perdua, 'p') }]}>{fmt(n.perdua)}</Text>
                </View>
                {n.lots && n.lots.map((l) => (
                  <View key={`nax-${n.numero}-lot-${l.lot_id}`} style={s.trLot}>
                    <Text style={[s.tcDim, { flex: 0.6 }]}></Text>
                    <Text style={[s.tlDim, { flex: 2 }]}>└ {l.nom}</Text>
                    <Text style={s.tcDim}>{l.ous.toLocaleString()}</Text>
                    <Text style={s.tcDim}>{l.fertils.toLocaleString()}</Text>
                    <Text style={s.tcDim}>{l.pollets.toLocaleString()}</Text>
                    <Text style={[s.tcDim, { color: col(l.taxa_eclosio, 'e') }]}>{fmt(l.taxa_eclosio)}</Text>
                    <Text style={[s.tcDim, { color: col(l.naixement, 'e') }]}>{fmt(l.naixement)}</Text>
                    <Text style={[s.tcDim, { color: col(l.perdua, 'p') }]}>{fmt(l.perdua)}</Text>
                  </View>
                ))}
              </Fragment>
            ))}
          </>
        )}

        <View style={s.footer} fixed>
          <Text>Generat el {new Date().toLocaleDateString('ca-ES')}</Text>
          <Text>Miquel Avícola — Sala d&apos;incubació</Text>
        </View>
      </Page>
    </Document>
  )
}
