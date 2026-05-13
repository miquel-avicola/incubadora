# Context del projecte — Miquel Avícola Incubadora

## Arquitectura general

| Component | Tecnologia |
|-----------|-----------|
| Frontend + API | Next.js 14 (TypeScript) |
| Base de dades | Supabase (PostgreSQL) |
| Desplegament | Vercel |
| Repositori | GitHub: `enricdltcodi/miquel-avicola` (privat) |
| URL producció | `miquel-avicola-incubadora.vercel.app` |
| Carpeta local codi | `C:\Users\Usuari\Documents\miquel-avicola` |

**Flux de treball:** editar codi al VS Code → commit + push a GitHub → Vercel desplega automàticament.

---

## Rols d'usuari

| Rol | Accés |
|-----|-------|
| `recepcio` | Recepció i estoc de carros |
| `carregues` | Càrregues |
| `admin` | Tot |

---

## Estructura de la base de dades (Supabase)

Taules principals i relacions clau:

- **`carros_estoc`**: carros físics d'ous. Camps: `id`, `lot_id`, `posta`, `quantitat_ous` (4800 o 2400), `estat`, `recepcio`, `entrada_incubadora`
- **`lots_reproductores`**: lots de reproductores. Linked a `granges_reproductores`
- **`granges_reproductores`**: `granja`, `nom_informal`
- **`incubadores`**: `numero`, `model`, `tipus` (Singlestage/Multistage), `capacitat_carros`
- **`naixedores`**: `numero`, `capacitat`
- **`fulls_carrega`**: full de càrrega diari. Camps: `num_carrega`, `carrega` (data), `transferencia`, `estat`
- **`assignacions`**: carro assignat a incubadora dins un full. Camps: `full_carrega_id`, `carro_id`, `incubadora_id`, `num_carro_full`, `previsio_naixement`
- **`transferencies`**: transferència d'incubadora a naixedora. Camps: `carro_id`, `naixedora_id`, `assignacio_id`, `ous_fertils_vacunats`, `ous_explosius`
- **`resultats_naix`**: resultats de naixement. Camps: `transferencia_id`, `pollets_nascuts`, `pollets_descartats`, `naixement`
- **`transportistes`**: `nom`, `empresa`, `max_carros`, `tipus_carro`, `alcada_min`, `alcada_max`, `pollets_caixa_min`, `pollets_caixa_max`
- **`comandes`**: `full_carrega_id` (nullable), `client_id`, `tipus`, `quantitat_pollets`, `quantitat_ous_maquila`, `sexat`, `data_prevista_naixement` (nou)
- **`expedicions`**: `comanda_id`, `destinacio_id`, `transportista_id`, `pollets_comanda`, `pollets_servits`, `num_viatge`, `sexe` (nou: 'M' o 'F')
- **`destinacions`**: `nom_granja`, `nau`, `poblacio`, `client_id`, `sexe` (nou: 'M' o 'F')
- **`clients`**, **`vacunes`**, **`expedicio_lots`**, **`expedicio_vacunes`**

---

## Canvis fets en sessions anteriors (resum acumulat)

### Rutes API estàtiques → dinàmiques
- `export const dynamic = 'force-dynamic'` afegit a les rutes afectades

### Reorganització navegació principal
- "Estoc de carros" com a botó principal; botó "+ Recepció" dins estoc
- "Planificació de càrregues" → "Càrregues"

### Menú desplegable Accions a la pàgina de càrrega
- Opcions: Imprimir, Assignar carros, Pla vacunal, Transferència, Naixement, Expedicions, Estadístiques, Etiquetes càrrega

### Estadístiques per càrrega (PDF)
- `/api/carrega/[id]/estadistiques` + component `EstadistiquesPDF.tsx` + pàgina

### Etiquetes de càrrega (90×90mm)
- Component `EtiquetesCàrregaPDF.tsx` (format: num càrrega + num carro, granja + data posta, 3 dates)
- Pàgina `/carrega/[id]/etiquetes`

---

## Canvis fets en aquesta sessió

### 1. Etiquetes de pollets (50×50mm)

**Migració BD:**
- Camp `sexe text CHECK ('M','F')` afegit a `destinacions`
- Camp `sexe text CHECK ('M','F')` afegit a `expedicions`

**Fitxers nous/modificats:**
- `app/components/EtiquetesPolletsPDF.tsx` — 3 seccions: client (top, gran), MASCLES/FEMELLES (mig), nom_granja + població (baix)
- `app/carrega/[id]/expedicions/etiquetes-pollets/page.tsx` — llegeix distribució de localStorage, genera PDF
- `app/api/carrega/[id]/expedicions/route.ts` — afegit `sexe` al SELECT de destinacions i INSERT d'expedicions
- `app/carrega/[id]/expedicions/page.tsx` — selector de sexe al formulari de nova expedició, botó "🏷 Etiquetes"

**Lògica d'etiquetes:**
- `carros_sencers` etiquetes per als carros plens + 1 etiqueta pel pico (si n'hi ha)
- Exemple: 13 carros + 5 caixes pico = **14 etiquetes**
- El sexe (MASCLES/FEMELLA) s'entra per expedició en crear-la

### 2. Historial de lots de reproductores

**Fitxers nous:**
- `app/api/lots/[id]/route.ts` — queries separades per evitar error FK de Supabase; retorna info lot + resultats per setmana de vida
- `app/lots/[id]/page.tsx` — pàgina amb 5 targetes resum, gràfic SVG de 3 línies (fertilitat/eclosió/naixement) amb tooltip hover, taula detallada, botó "🖨 Imprimir / PDF" (window.print)
- `app/lots/page.tsx` — lots clicables amb `router.push('/lots/${lot.id}')` (usat router en lloc de Link per evitar problema de middleware)

**Notes tècniques:**
- Error `carros_estoc_1.lots_reproductores_id`: Supabase es confon amb les relacions quan fas nested selects complexos. Solució: queries simples separades (no nested)
- Error `Set iteration`: TypeScript estricte no permet `for...of` sobre Set. Solució: `Array.from(set)`
- La ruta `/lots/[id]` requereix que el middleware permeti accés a tots els rols autenticats

### 3. Neteja de dades de proves
- Esborrats `resultats_naix` amb IDs 5,6,7,8,9 (creats per error, date de naixement anterior a entrada incubadora)
- Esborrada la càrrega #2 completa (era de proves): resultats_naix, transferències, assignació_vacunes, assignacions, expedicions, comandes, full_carrega. Els 40 carros resetejats a estat 'Disponible'

### 4. Comandes anticipades (planning)

**Migració BD:**
- Camp `data_prevista_naixement date` afegit a `comandes` (nullable)

**Fitxers nous/modificats:**
- `app/api/comandes/route.ts` — GET amb `?pendents=true` (filtra `full_carrega_id IS NULL`) i `?data=YYYY-MM-DD` (±14 dies); POST admet `full_carrega_id` null
- `app/api/comandes/[id]/route.ts` — PATCH (actualitza `full_carrega_id`, `data_prevista_naixement`, etc.) + DELETE
- `app/carrega/page.tsx` — secció "Comandes pendents sense càrrega" + botó "+ Comanda" per crear-ne sense càrrega
- `app/carrega/nova/page.tsx` — en seleccionar data de càrrega, suggereix comandes pendents properes al naixement previst (±14 dies), totes seleccionades per defecte; permet deseleccionar i afegir-ne de noves

### 5. Ordre de càrregues
- `app/api/carrega/route.ts`: canviat `.order('num_carrega')` per `.order('carrega')` (ordena per data)

---

## Tasques pendents

### Urgent
- [ ] Afegir `export const dynamic = 'force-dynamic'` a les rutes API que falten (incubadores, naixedores, vacunes, clients-list)
- [ ] Verificar que el middleware permet accés a `/lots` i `/lots/[id]` per a tots els rols autenticats

### Proper pas acordat
- [ ] **Fase 2 estadístiques lots**: evolució temporal amb gràfics comparatius entre lots
- [ ] Pàgina global `/estadistiques` (admin only)

### Futur
- [ ] Integració Bartender Print API (nova impressora en camí)
  - App: Next.js + TypeScript, API REST
  - Mida etiquetes: 90×70mm
  - Integració via HTTP local
- [ ] QR per traçabilitat individual dels carros
- [ ] Actualitzar Next.js (vulnerabilitat de seguretat a v14.1.0)
- [ ] Configuració de rols per a estadístiques (ara accessible per tothom, hauria de ser admin only)

---

## Decisions tècniques preses

| Decisió | Raó |
|---------|-----|
| `@react-pdf/renderer` per PDFs | Genera PDFs vectorials reals, gratuït, open source MIT |
| Descàrrega PDF via `onClick` amb `import()` dinàmic | Evita problemes SSR |
| Etiquetes pollets 50×50mm | Mida especificada per l'usuari |
| `window.print()` per historial lots | Conserva el gràfic SVG perfectament |
| `router.push()` en lloc de `Link` per lots | Evita problema de middleware que bloquejava la navegació |
| Queries separades a Supabase (no nested) per lots API | Evita error `lots_reproductores_id` de PostgREST |
| `Array.from(Set)` en lloc de `for...of Set` | Compatibilitat TypeScript estricte del projecte |
| `comandes.full_carrega_id` nullable | Permet crear comandes de planificació sense càrrega assignada |

---

## Notes importants

- **No fer `npm install` via VPN** — és extremadament lent. Fer-ho sempre amb la carpeta local.
- **Vercel desplega automàticament** cada vegada que fas `git push` a la branca `main`.
- **Supabase project ID**: `uhslwgcjdiwycknvaplr` (regió eu-west-1)
- **Error TypeScript Set/Map iteration**: sempre usar `Array.from()` en lloc de spread o `for...of` directe sobre Set/Map
- **Error Supabase nested select amb múltiples FK**: separar en queries independents
- **El middleware d'autenticació** pot bloquejar rutes noves — cal verificar que les noves pàgines siguin accessibles pels rols correctes
