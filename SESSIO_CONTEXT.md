# Context del projecte — Miquel Avícola Incubadora
# SESSIÓ 11 — llegir això al principi de cada nova conversa

## Stack i flux

- **Next.js 14** (TypeScript) + **Supabase** (PostgreSQL) + **Vercel** (auto-deploy des de GitHub `main`)
- Carpeta local: `C:\Users\Usuari\Documents\miquel-avicola`
- URL producció: `miquel-avicola-incubadora.vercel.app`
- **CRÍTIC**: bash de Cowork corre en sandbox Linux → NO escriu al filesystem Windows. Usar sempre eines Edit/Write per modificar fitxers del projecte.
- TypeScript estricte: sempre `Array.from()` en comptes de `for...of` sobre Set/Map

---

## Rols

| Rol | Accés |
|-----|-------|
| `recepcio` | Estoc de carros |
| `carregues` | Càrregues |
| `admin` | Tot |

---

## Taules principals de BD

- **`carros_estoc`**: `id, lot_id, posta, quantitat_ous (4800/2400), estat, recepcio, entrada_incubadora`
- **`lots_reproductores`**: `id, estirp, data_naixement` → linked a `granges_reproductores (granja, nom_informal)`
- **`incubadores`**: `id, numero, model, tipus (Singlestage/Multistage), capacitat_carros`
- **`fulls_carrega`**: `id, num_carrega, carrega (data), transferencia, estat`
- **`assignacions`**: `id, full_carrega_id, carro_id, incubadora_id, num_carro_full, posicio, zona (central/paret/pulsator), previsio_naixement (0..1), previsio_manual (bool), hora_entrada`
- **`transferencies`**: `id, carro_id, naixedora_id, assignacio_id, ous_fertils_vacunats, ous_explosius`
- **`resultats_naix`**: `id, transferencia_id, pollets_nascuts, pollets_descartats`
- **`parametres`**: clau/valor — inclou `eclosio_fallback, data_tall_inovo, finestra_mobil_setmanes, minim_registres_finestra`
- **`eclosio_historic`**: `estirp, tipus_incubadora, setmanes_vida, eclosio` (dades Excel importades)

---

## Funcionalitats implementades (sessions 1–11)

- Recepció i estoc de carros
- Planificació de càrregues: drag-and-drop SS (graella posicions) i MS (zones central/paret/pulsator)
- Botó "⚡ Optimitzar zones (calor)" a `/assignacions` — algoritme greedy basat en `lib/termico.ts`
- Transferència a naixedora + rotació automàtica de zones MS
- Resultats de naixement, estadístiques per càrrega (PDF)
- Expedicions normals i sexades M+F
- Etiquetes de càrrega (90×90mm) i pollets (50×50mm)
- Historial de lots de reproductores (gràfics SVG + taula)
- Comandes anticipades sense càrrega assignada
- Mode edició per lots a `/instal·lacions` (confirm/descartar)
- Capa tèrmica visual a `/instal·lacions` (heat-map per carro, barra comparació màquines)
- **Seccions "Evolució de la previsió"** a `/carrega/[id]/estadistiques`:
  - Etapa 1: `previsio_naixement` guardat a `assignacions` (valor real entrat a l'assignació)
  - Etapa 2: `ous_fertils × eclosio_esperada` (via `lib/eclosio.ts`)
  - Etapa 3: `pollets_nascuts` real
  - Agrupació per (lot_id + tipus_incubadora), no només per lot
  - API: `GET /api/carrega/[id]/previsions-comparativa`

---

## Llibreries de lògica clau

### `lib/eclosio.ts` — previsió d'eclosió
- `obtenirEclosio(estirp, setmanes, tipus, params?)` → cascada 5 nivells (Supabase post-tall, Excel exacte, Supabase finestra, Excel finestra, fallback)
- Cas especial Cobb Singlestage: estimació indirecta via offset Ross
- `llegirParametresEclosio()` → llegeix `parametres` de Supabase (1 query)

### `lib/termico.ts` — calor embrionària
- `indexCalorCarro(setmanes, quantitat_ous, dia_incubacio)` → mW totals del carro en un dia
- `CORBA_METAB`: corba metabòlica dia 1–21, spike dia 19 = 1.286 (transició pulmonar)
- `pesOuEstimat(setmanes)`: polinomi Ross 308 (rang 40–80 g)
- `suggerirZonaMS(carroInfos, zonesOcupades, capacitatZona)` → greedy per calor pic dia 18
- Base: ou 62 g, Ross 308 | dia 18 = 142 mW/ou | dia 19 = 183 mW/ou

---

## TASCA PRÒXIMA (sessió 11): Millorar `/carrega/[id]/assignacions`

**Objectiu:** millora visual + suggeriment intel·ligent de on posar els carros.

**Fitxers principals a treballar:**
- `app/carrega/[id]/assignacions/page.tsx` — UI principal (molt gran, llegir sencer al principi)
- `app/api/carrega/[id]/assignacions/route.ts` — POST per crear assignació, DELETE per esborrar
- `app/api/carrega/[id]/previsio-grup/route.ts` — PATCH per actualitzar `previsio_naixement` per grup
- `lib/termico.ts` — ja implementada, útil per suggeriments de calor
- `lib/eclosio.ts` — per calcular `previsio_naixement` automàtic en el moment d'assignar

**Context de la UI actual d'assignació:**
- Selector de carros disponibles (per lot, amb filtre) a l'esquerra
- Visualització de la incubadora a la dreta
  - SS: graella de posicions numerades → cal triar posició per cada carro
  - MS: zones (central/paret/pulsator) → els carros s'apilen dins cada zona
- El botó d'optimitzar zones tèrmiques ja existeix
- Es pot editar `previsio_naixement` per grup (lot + incubadora)

---

## Decisions tècniques rellevants

| Decisió | Raó |
|---------|-----|
| Queries separades a Supabase (no nested) si hi ha FK múltiples | Evita error PostgREST |
| `export const dynamic = 'force-dynamic'` a les rutes API | Evita caché incorrecte |
| `previsio_naixement` a `assignacions` (0..1) | Emmagatzema la taxa de naixement prevista al moment d'assignar |
| `previsio_manual = true/false` | Distingeix previsions entrades per l'usuari de les calculades |
| Agrupació (lot + tipus_incubadora) a previsions-comparativa | Botarell Ross MS i SS són grups independents |

---

## Notes operatives

- **Vercel desplega automàticament** cada push a `main`
- **Supabase project ID**: `uhslwgcjdiwycknvaplr`
- No fer `npm install` per VPN (molt lent)
- Bloc git habitual al final de sessió:
  ```powershell
  cd C:\Users\Usuari\Documents\miquel-avicola
  if (Test-Path .git/index.lock) { del .git/index.lock }
  git add [fitxers]
  git commit -m "..."
  git push
  ```
