# Context del projecte — Miquel Avícola Incubadora
# SESSIÓ 10 — llegir això al principi de cada nova conversa

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
- **`comandes`**: `full_carrega_id` (nullable), `client_id`, `tipus`, `quantitat_pollets`, `quantitat_ous_maquila`, `sexat`, `data_prevista_naixement`
- **`expedicions`**: `comanda_id`, `destinacio_id`, `transportista_id`, `pollets_comanda`, `pollets_servits`, `num_viatge`, `sexe` ('M' o 'F'), `grup_sexat_id UUID` (nullable, vincula parelles M+F d'expedicions sexades)
- **`destinacions`**: `nom_granja`, `nau`, `poblacio`, `client_id`, `sexe` ('M' o 'F')
- **`clients`**, **`vacunes`**, **`expedicio_lots`**, **`expedicio_vacunes`**

---

## Resum de funcionalitats implementades (sessions 1–9)

- Recepció i estoc de carros
- Planificació de càrregues amb drag-and-drop (SS i MS)
- Mode edició per lots a `/instal·lacions` (confirm/descartar)
- Transferència a naixedora, resultats de naixement
- Expedicions (normals i sexades M+F agrupades)
- Etiquetes de càrrega (90×90mm) i etiquetes de pollets (50×50mm)
- Estadístiques per càrrega (PDF)
- Historial de lots de reproductores (gràfics SVG + taula)
- Comandes anticipades sense càrrega assignada
- Rotació automàtica de zones MS a la transferència
- **Capa tèrmica completa** (`lib/termico.ts`): corba metabòlica embrionària corregida, visualització heat-map per carro a `/instal·lacions`, botó "⚡ Optimitzar zones (calor)" a `/assignacions`

---

## Canvis fets a la sessió 9 (última sessió)

### 1. Mode edició per lots a `/instal·lacions` (Funcionalitat K)
- Acumula els canvis de drag-and-drop localment (`pendingMoves`)
- Botó "Confirmar canvis" fa un batch de PATCH en paral·lel i refesca l'estat
- Botó "Descartar" reverteix al estat original sense tocar la BD
- `ContextEdicio` ampliada amb `pendingCount`

### 2. Capa tèrmica visual a `/instal·lacions` (Funcionalitat L)
- Cada carro individual: gradient blau→vermell (`heatColor`) basat en la seva calor actual
- Capçalera de cada incubadora: calor total + barra de comparació entre màquines
- Escala global (`maxCalorGlobal`) per comparar valors absoluts entre incubadores
- Component `BarresCalorZones` per MS: barres per zona (central/paret/pulsator) amb badge ⚖

### 3. Optimització tèrmica de zones a `/assignacions`
- Botó "⚡ Optimitzar zones (calor)" (verd, visible si hi ha carros MS col·locats)
- Algoritme greedy: ordena carros per calor de pic (dia 18) DESC, per a cada un crida `suggerirZonaMS()` respectant capacitat de zona
- Exclou carros d'altres fulls de la lògica d'optimització (no els mou, però els té en compte com a "calor fixa")

### 4. `lib/termico.ts` — corba metabòlica corregida (deep research)
**Canvis respecte versió anterior:**
- `CORBA_METAB` completament reescrita: valors dia 1-10 reduïts (l'anterior sobreestimava fins a ×8), spike dia 19 = **1.286** (transició pulmonar, +28.6% sobre el plateau)
- Nova funció `pesOuEstimat(setmanes)`: polinomi Ross 308, retorna grams d'ou (rang 40–80 g)
- Nova funció `factorCorreccioPes(pesOu)`: `S_pes = 1 + 1.2*(W0-62)/140`; base = ou de 62 g
- `indexCalorCarro` ara multiplica també per `S_pes` — ous de reproductores joves/velles produeixen ~15% menys calor

**Valors de referència (ou 62 g, Ross 308, pic):**
dia 18 = 142.04 mW/ou (base = 1.000) | dia 19 = 182.62 mW/ou (1.286)

### 5. Bugfix crítica (sessió 9)
- El bash de Cowork corre en sandbox Linux i **NO escriu al filesystem Windows**
- Tots els fitxers del projecte s'han d'editar amb les eines Edit/Write, mai amb bash
- El fitxer `lib/termico.ts` havia quedat amb `ies.` i funcions duplicades pel bash; corregit amb Write

---

## Tasques pendents

### Pendent de verificar
- [ ] **Confirmar que el deploy de Vercel ha passat** després del darrer push (fix `lib/termico.ts`)
- [ ] **Validar rotació automàtica de zones** en producció (pròxima transferència real de l'Inc 1-6)
- [ ] **Inc 9 i 10 MS petites barrejades** — ajust manual per Enric des de `/instal·lacions`

### Urgent (pendent de sessions anteriors)
- [ ] Afegir `export const dynamic = 'force-dynamic'` a les rutes API que falten (incubadores, naixedores, vacunes, clients-list)
- [ ] Verificar que el middleware permet accés a `/lots` i `/lots/[id]` per a tots els rols autenticats

### Futur
- [ ] Fase 2 estadístiques lots: evolució temporal amb gràfics comparatius entre lots
- [ ] Pàgina global `/estadistiques` (admin only)
- [ ] Integració Bartender Print API (nova impressora en camí) — mida etiquetes 90×70mm, HTTP local
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
| `CORBA_METAB` dia 19 = 1.286 (> 1.0) | Spike de transició pulmonar real, no error |
| `pesOuEstimat` polinomi Ross 308 | Correcció proporcional de calor per pes d'ou real |
| Edit/Write per a tots els fitxers, mai bash | El bash de Cowork és un sandbox Linux separat, no escriu al filesystem Windows |

---

## Notes importants

- **No fer `npm install` via VPN** — és extremadament lent. Fer-ho sempre amb la carpeta local.
- **Vercel desplega automàticament** cada vegada que fas `git push` a la branca `main`.
- **Supabase project ID**: `uhslwgcjdiwycknvaplr` (regió eu-west-1)
- **Error TypeScript Set/Map iteration**: sempre usar `Array.from()` en lloc de spread o `for...of` directe sobre Set/Map
- **Error Supabase nested select amb múltiples FK**: separar en queries independents
- **El middleware d'autenticació** pot bloquejar rutes noves — cal verificar que les noves pàgines siguin accessibles pels rols correctes
- **CRÍTIC: bash NO escriu al filesystem Windows** — usar sempre Edit/Write per modificar fitxers del projecte
