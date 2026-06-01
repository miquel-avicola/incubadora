# Regles d'assignació de carros a incubadores

**Estat:** esborrany viu. Cada regla porta etiqueta de fiabilitat:

- ✅ **Confirmada** — l'Enric ha articulat la regla i tenim 1+ exemple real que la suporta.
- 🟡 **Articulada, pendent de validar** — l'Enric l'ha articulat però no s'ha provat contra cap full real o el full disponible la contradiu.
- 🔍 **Hipòtesi** — el sistema o les dades suggereixen quelcom; encara no confirmat per l'Enric.
- ❓ **Pregunta oberta** — sabem que cal una regla aquí però no la tenim.

L'objectiu d'aquest document és arribar a un conjunt de regles prou complet com perquè el botó "Pre-suggerit" de la pantalla d'assignacions produeixi una col·locació que una persona no experta pugui acceptar amb intervenció mínima.

---

## 1. Marc general

El procés d'assignació té TRES decisions encadenades humanes:

1. **Selecció:** quins carros (de l'estoc) entren al full.
2. **Mapeig a incubadora:** a quina incubadora va cada carro (derivable d'ordre temporal de naixement).
3. **Posició dins la incubadora:** a quina posició concreta (regla esq/dre a MS; regla de calor a SS).

I una decisió que NO és humana: la **zona** (post-rotació, vegeu §6).

**Important:** l'ordre intern absolut d'una incubadora (qui va a pos 1 vs pos 2 dins el mateix lot) NO és una regla humana — és un artefacte de l'app actual. Per a l'algorisme, n'hi ha prou amb decidir incubadora + costat (esq/dre) + lot, sense fixar posició exacta.

---

## 2. Selecció: quins carros entren al full

### 2.1 Maquila ✅

🟡 La maquila (Nutrex i altres) **entra automàticament al full** quan hi ha comanda d'ous maquila. No se'n discuteix qualitat de lot. La quantitat es deriva directament dels ous a maquilar (vegeu §2.6).

**Detall operatiu (confirmat 2026-05-29, resol §7 #2):** quan es planifica el full, els carros de maquila poden no haver arribat encara. **No es crea cap registre fins que el carro és físicament a la planta** — no hi ha placeholder. El full només els deixa el lloc; es creen i s'assignen a la posició quan arriben.

**Posició (predictible sense dades del lot):**

- **Dilluns:** la maquila va **sempre l'última** (cua del full). És conseqüència natural de l'ompliment consecutiu (§3.4): els pollets omplen del davant i la maquila cau al final.
- **Dijous:** la maquila va **després de la SS**, dins el bloc MS (posicions 25+), **mai dins la SS**. La posició exacta entre 25-44 segueix l'ordre de sortida del camió, intercalada amb Sanco (§3.3).

**Implicació per al Pre-suggerit:** ha de **reservar N places** (N = ous a maquilar / capacitat, §2.6) a la zona corresponent sense necessitar carro_id ni lot; qualitat i calor són indiferents (§2.5).

**Implementació (2026-05-29):** afegit el camp `carros_estoc.client_maquila_id` (bigint NULL, FK `clients`). NULL = pollets; amb valor = maquila d'aquell client. La v2 (`suggerirAssignacioCompleta`) ara separa els carros de maquila del pool de pollets (no compten per a la comanda de pollets) i els col·loca al final del patró (dilluns últim, dijous després de la SS, mai a la SS) via `poolMS = [...pollets, ...maquilaOrd]`. Pendents: (a) pantalla de **recepció** per marcar `client_maquila_id` (ara cal fer-ho per dada); (b) auto-derivar `assignacions.es_maquila` en desar a partir de `client_maquila_id` (ara encara és el pas manual `maquila-grup`).

### 2.2 Antiguitat d'estoc — límit dur 14 dies ✅

✅ **Un carro no pot superar 14 dies entre posta i entrada a incubadora.** Aquest és un límit dur per qualitat de l'ou.

**Operativament:** com que la pròxima càrrega habitualment és **3 o 4 dies més tard**, **tots els carros amb posta de 10-11 dies o més han d'entrar obligatòriament** (perquè si esperen a la propera càrrega arribarien o passarien dels 14 dies).

### 2.3 Qualitat del lot — capa estructural per edat ✅

✅ **Edat òptima del lot reproductor: 30-55 setmanes.**

- **<30 setm:** pollets molt petits i de mala qualitat.
- **30-55 setm:** zona òptima.
- **>55 setm:** generalment problemes sanitaris.

### 2.4 Qualitat del lot — capa empírica observada ✅

✅ La classificació estructural per edat es **reajusta a posteriori** segons els resultats observats:

- Si veig que els **pollets que neixen avui d'un lot són dolents**, baixa la categoria del lot.
- Si un lot està generant **molts ous explosius**, baixa la categoria.
- Si un lot dins el rang d'edat òptima té igualment mals resultats, també baixa.

**Dada observada (2026-05-28):** els últims carros de **Maxim Cobb i Botarell van donar prop d'un 73% d'eclosió** (vs ~85% esperat). Aquesta dada activa la capa empírica i justifica el +1 carro de marge per als pollets d'Avinatur a la càrrega 2964 (vegeu §2.7).

**Implicació tècnica:** podríem automatitzar aquesta capa amb mètriques calculables des de la BD:

- `% ous explosius` = `transferencies.ous_explosius` / total ous transferits
- `% eclosió` = `resultats_naix.pollets_nascuts` / ous fèrtils vacunats
- `% pollets descartats` per qualitat

⚠️ **Els dos senyals empírics NO són equivalents a l'hora d'assignar (vegeu §2.8):** un % alt d'**explosius** indica risc sanitari → el lot va a **Sanco** (no recuperable). Un **baix % de naixement** sense explosius és recuperable → el lot va a la **SS** (XStreamer). Per tant la "rebaixa de categoria" s'ha de desglossar per tipus de senyal, no agregar-se en un sol número.

❓ Pendent: definir mètrica i llindar exacte per a la "rebaixa empírica" (per exemple: si % d'eclosió mitjana dels darrers 2-3 fulls està >5 punts per sota de la previsió, llavors el lot baixa una categoria). Definir per separat el llindar d'explosius (→Sanco) i el de naixement baix (→SS).

**Actualització 2026-05-31 (vegeu §8.2):** la "rebaixa empírica" **NO s'ha d'usar com a predictor del naixement %**. Amb les dades actuals (10 lots) l'historial propi del lot no prediu el naixement un cop saps estirp + edat + màquina. Es reconverteix en: (a) senyal **sanitari/routing** —explosius → Sanco (§2.8)—, i (b) **override manual** de l'Enric. El llindar d'explosius→Sanco segueix obert; el "naixement baix → SS" es manté com a **routing de màquina**, no com a rebaixa del número previst. Reobrir quan hi hagi força més lots d'històric.

### 2.5 Qualitat-client (SOFT, modulable) ✅

✅ **Hi ha una preferència de quins lots reben quins clients, però NO és una regla estricta.**

| Categoria | Clients (dilluns) | Clients (dijous) | Qualitat lot preferent |
|---|---|---|---|
| Premium | Avinatur | — | Bons |
| Matiners | Pinsos del Segre, Aves Gil, Florida, GUCO | Pondex (SS) | Dolents (o el que toqui per antiguitat) |
| Maquila | Nutrex | Nutrex, Sanco | Indiferent / el que sobri |

**Formalització 2026-06-01 (§2.9):** aquesta taula es codifica al camp `clients.categoria` amb un gradient de tres nivells de qualitat **A > B > C** (A = premium/millors lots; C = pitjors) + **M** = maquila. Un client pot ser, alhora, categoria B per als seus pollets i M per als seus ous de maquila. La categoria és **independent** de l'ordre físic de càrrega (`ordre_carrega`).

✅ **Excepció per anticipació d'estoc:** quan a l'estoc hi ha massa carros que s'acumulen i podrien arribar al límit de 14 dies a la propera càrrega, **s'evacua una part al client premium** per evitar problemes futurs. L'estratègia mira la càrrega actual + la càrrega següent, no només la d'ara.

✅ **Algorisme d'anticipació — metrica concreta (resol §7 #9, articulat 2026-05-29):**

- **Horitzó:** només la **propera càrrega** (un pas; la cadència és 3-4 dies, §2.2).
- **Senyal primari (dur):** projectar l'edat de cada carro (estoc que no entra ara + postes previstes) a la **data de la propera càrrega**; si arribaria a >14 dies, **ha d'entrar ja ara** (§2.2).
- **Senyal secundari (tou, anticipació):** comptar quants carros tindran **>11 dies** a la data de la propera càrrega. Si en surten **més de 4 (≥5)**, és massa → **evacuar el sobrant al premium (Avinatur) en aquesta càrrega**. Amb **3-4 no es fa res**.
- 🟡 El llindar **4** és un valor de treball de l'Enric ("p. ex. 5 ja és massa"), a validar amb dades històriques.

**Exemple real (càrrega 2964):** Avinatur reb ~15.000 pollets de Botarell (4 carros) tot i ser un client premium. Decisió presa perquè el dijous 04/06 hi haurà massa carros Botarell vells si no se n'entren ara.

✅ Classificació de Sanco al dijous: rep els lots **explosius** (pitjors per risc sanitari), a la cua del full (§2.8).

### 2.6 Càlcul de quantitat — "places" i previsió d'eclosió ✅

✅ **1 carro = 1 plaça** a la incubadora, independentment de si el carro va mig ple o sencer. Un carro mig (≈2.400 ous) ocupa el mateix que un sencer (4.800 ous).

✅ **La quantitat de carros per cobrir una comanda de pollets depèn de la previsió d'eclosió esperada per als lots assignats.** No és aritmètica fixa.

🟡 **Marge de seguretat:** si els lots assignats tenen indicis empírics de qualitat baixa (vegeu §2.4), s'afegeix **+1 carro** per cobrir possibles sorpreses (no arribar al volum compromès).

**Actualització 2026-05-31 (vegeu §8.4):** el "+1 carro" lligat a indicis d'un lot concret **se substitueix** per un **marge moderat sistemàtic** (planificar amb una previsió lleugerament conservadora, igual per a tots els lots), amb el valor **calibrat amb backtest** i un **override manual** sempre disponible. Ja no depèn de l'ull sobre un lot concret.

### 2.7 Lots a treure preferent (saturació d'estoc) ✅

✅ **Dins els lots "dolents", es prioritza posar els carros més vells** per buidar estoc i evitar arribar al límit dels 14 dies en futures càrregues.

✅ **Si un lot dolent es pot reduir més enllà del estrictament necessari per evitar problemes futurs, es redueix** (regla d'anticipació, vegeu §2.5).

🟡 **Selecció dins un grup de mateixa antiguitat:** quan dins un mateix lot dolent hi ha carros amb la mateixa data de posta i no calen tots, l'elecció entre ells és arbitrària. L'algorisme pot triar per ordre de carro_id o el primer disponible.

✅ **Escenari pic — tots els lots >55 setm (resol §7 #8, confirmat 2026-05-29):** amb tot vell, l'ordre passa a ser **per antiguitat pura** (els més vells primer, per buidar estoc i no petar el límit de 14 dies). La palanca de rendiment és la **SS/XStreamer** (§2.8): s'hi posen els que més recuperen. Les preferències de qualitat-client (§2.5) es **relaxen** perquè no hi ha lots bons per repartir: el premium (Avinatur) rep "el menys dolent" disponible. No hi ha cap regla especial addicional.

### 2.8 Assignació màquina × qualitat de lot (XStreamer/SS) ✅

✅ **Articulada per l'Enric (2026-05-29).** Les màquines **XStreamer (les SS) són molt millors** que les MS. Per maximitzar el naixement total s'assigna la **millor màquina al lot més feble per edat**: a la SS s'hi posen **lots vells a propòsit**, perquè en una màquina millor un lot vell recupera molt rendiment (**~+6% de naixement en lots de ~58 setm**), més guany que el que aportaria posar-hi un lot ja bo.

**Criteri de routing — la qualitat dolenta NO és un sol calaix, es divideix per sub-tipus amb destins oposats:**

- **Edat (vell) → SS.** Recuperació via XStreamer. Aplica dijous (la SS només funciona dijous, §3.3).
- **Naixement dolent però lot sa → SS.** És exactament la baixada de rendiment que la XStreamer pot recuperar; per això va a la màquina bona, no es descarta.
- **Explosius → Sanco.** Risc de contaminació: NO es posen a la màquina bona (embrutarien la XStreamer) i no es "recuperen". Van a Sanco, que carrega l'última hora del dijous → cua del full (Inc 1/2/8 després de la SS, §3.3).

**Resum:** "recuperable" (vell o de baix naixement però sa) → SS; "no recuperable / risc sanitari" (explosius) → Sanco. El filtre Sanco mana **només per als explosius**, no per a tot el que rendeix malament.

### 2.9 Repartiment per client — assignació automàtica ✅ (DISSENY TANCAT 2026-06-01, Opus)

✅ **Disseny complet acordat amb l'Enric el 2026-06-01.** Substitueix el disseny parcial del harness (2026-05-29), que només ordenava el pool per qualitat i deixava que els lots "caiguessin" a les incubadores; ara hi ha repartiment per client de debò. Resol la peça gran del §7 #12 i tanca el §2.9 a nivell de disseny. La previsió (§8) ja existeix i dóna pollets/carro, que és el que el repartiment necessita. **Implementació a la v2 PENDENT** (tasca de Sonnet).

#### 2.9.0 Idees mestres

**Dos eixos independents per client, que NO s'han de barrejar:**

- **Qualitat** (camp nou `clients.categoria`, valors **A / B / C / M**): quina qualitat de lots rep el client. **A** = millors lots; **B** i **C** = progressivament pitjors; **M** = maquila. Substitueix i formalitza la taula Premium/Matiners/Maquila del §2.5.
- **Ordre de sortida** (camp `clients.ordre_carrega`, ja existent; més baix = carrega abans = primeres incubadores): l'ordre físic del camió. Es podrà **sobreescriure per comanda** a la pantalla de planificació.

Coincideixen sovint, però **poden divergir** (rar el dilluns, sempre el dijous). Exemple de divergència: Nutrex carrega l'últim el dilluns però la seva qualitat de pollets és B, no premium. El motor **no pot assumir** que ordre de sortida i qualitat estiguin alineats.

**Dos números per lot, que tampoc no s'han de barrejar** (igual que naixement vs eclosió, §8.1):

- **Previsió de naixement %** (§8) → serveix per **dimensionar**: quants carros calen per cobrir una comanda. Tot es compta **en pollets**, no en carros: la comanda és un nombre de pollets i els carros són les unitats discretes amb què s'omple.
- **Qualitat del lot** → serveix per **repartir** A/B/C. Es defineix com: **edat respecte de la banda òptima 30-55 setm** (corba en U, §2.3) **+** un **marcador manual de "granja dolenta"** a `granges_reproductores` (granges que sistemàticament donen mala qualitat; penalització **forta però no absoluta** — en una càrrega normal no toquen mai un A, però si no hi ha res millor el premium rep "el menys dolent") **+** el senyal sanitari (explosius). **No** es fa servir la previsió % com a mesura de qualitat, ni l'historial de naixement del lot (§8.2: no prediu).

**Maquila (M), sempre a part.** La maquila són ous del client (carros designats a recepció via `client_maquila_id`), no lots nostres: queda **fora** del repartiment de qualitat. Un mateix client pot tenir **alhora** comanda de pollets (amb la seva categoria) i comanda de maquila (M) a la mateixa càrrega — p. ex. Nutrex amb 4 carros de maquila + 12.000 pollets. La categoria A/B/C s'aplica només a la part de **pollets**.

#### 2.9.1 Dimensionament (en pollets, global)

- Es tria el conjunt de carros que entren perquè la **previsió total de pollets** caigui dins la finestra **[demanda − 300, demanda + 3.000]** pollets sobre la **suma de totes les comandes**. Mai es dimensiona comanda a comanda: l'arrodoniment a carros sencers es quadra sobre el total, no sobre cada peça (si no, el sobrant es multiplicaria per nombre de comandes).
- Dins d'una mateixa categoria, els clients es **dimensionen junts** (un sol calaix per categoria); els comptes per categoria són **aproximats** i el quadre fi s'absorbeix al total global.

#### 2.9.2 Sexat — restricció DURA

- Si una comanda és **sexada, només pot ser Ross** (cap altra estirp es pot sexar).
- Es resol **abans** del repartiment de qualitat: l'algorisme calcula els carros Ross necessaris per a les comandes sexades i els **reserva primer**, per davant de tot i **per sobre de la categoria** (un client C amb comanda sexada agafa Ross encara que sigui un Ross bo).
- No hauria de faltar mai Ross per a les sexades. Si en faltés, el sistema **avisa** ("no es poden fer els sexats") — mai converteix una sexada en no-sexada ni l'omple amb una altra estirp en silenci.

#### 2.9.3 Repartiment de qualitat A/B/C

- Reservat el sexat, els lots restants s'ordenen per qualitat i es reparteixen: els **pitjors** als clients **C**, els següents a **B**, els **millors** als **A**, dimensionant cada categoria (en pollets) per la suma de comandes dels seus clients.
- **Anticipació d'estoc (§2.5), per substitució en pollets:** quan quedarien massa carros vells a punt de caducar (llindar de treball: **>4 carros de >11 dies** a la data de la propera càrrega; paràmetre a validar), el premium **es menja lots vells a punt de caducar en lloc de lots bons frescos**. La substitució és **en pollets**, no carro a carro: el **total de pollets del client no canvia** (4 carros dolents de ~3.500 = ~14.000 pollets cobreixen els ~14.000 que haurien posat ~3,4 carros bons), i els **lots bons desplaçats es queden a estoc** per a la propera càrrega (no caduquen, són joves). Exemple real 2964: Avinatur va rebre 4 Botarell vells per aquest motiu.

#### 2.9.4 Dijous — dos fluxos d'ompliment

El dijous hi ha **dos fluxos**, no un, i per això un client pot aparèixer partit en dos llocs:

1. **Flux SS (24 places exactes):** s'omple amb lots aptes per a la XStreamer (recuperables, §2.8). Comercialment, primer **Pondex**; com que Pondex no acaba de quadrar els 24, el **sobrant de la SS (~1 carro) el completen carros sans de Sanco**.
2. **Flux MS (Inc 1, 2, 8):** primer **Nutrex** (maquila), i la **resta de Sanco** (els explosius) tanquen el full a la cua.

L'`ordre_carrega` mana **dins de cada flux**. **Sanco surt partit per salut del lot**: els seus carros **explosius mai entren a la SS** (embrutarien la màquina, §2.8) → cua de la MS; els seus carros **sans poden completar la SS**. Així no cal codificar "Sanco a dos llocs": emergeix sol del routing per salut.

⚠️ Dins la SS cal mantenir l'**equilibri tèrmic** (§5): el rànquing de calor mana la posició física (carro pos 2 = ovoscan vol el més calorós, §5.2), independentment del client.

#### 2.9.5 Jerarquia de regles del motor

**DURES (no es trenquen mai):** límit de 14 dies (§2.2) · sexat → Ross · SS sense explosius i capacitat exacta de 24 · ordre físic = `ordre_carrega`.

**TOVES (millor esforç; el sistema AVISA si no les pot complir):** qualitat-client A/B/C (§2.5) · penalització de granja dolenta · equilibri tèrmic esq/dre (§4.5) · client-junt (§4.4) · **lot-junt** (§4.2 — preferència **forta** però **trencable per qualitat**: el motor manté els lots junts sempre que pot i els parteix només quan cal per no embrutar el premium amb lots dolents, **minimitzant els trencaments** perquè partir un lot té cost operatiu — els pollets surten de dues naixedores, §3.5).

El motor respecta sempre totes les dures, optimitza les toves de la millor manera possible i **avisa** cada cop que no pugui complir una tova (sobretot quan un client rep carros fora de la seva qualitat). Mai trenca una dura per complir-ne una de tova.

**Exemple de trencament de lot-junt acceptat (Enric 2026-06-01):** ordre de sortida Pinsos, GUCO, Avinatur, Nutrex → es poden posar 3 carros de Botarell als 2 primers (C), passar a lots bons per Avinatur (A), i deixar 2 carros de Botarell per Nutrex (B). El Botarell queda partit (3 + 2) per protegir la qualitat del premium.

#### 2.9.6 Dèficit d'estoc

No hauria de passar (el marge del §8.4 hi és per evitar-ho). Si tot i així no hi ha prou carros per cobrir el total demanat, **s'entra tot l'estoc disponible igualment**, sense lògica especial de protecció (el sexat sempre va cobert primer perquè és regla dura).

#### 2.9.7 Canvis de dades necessaris (implementació)

- `clients.categoria` (A/B/C/M) — **nou**.
- Marcador de qualitat a `granges_reproductores` (p. ex. nivell normal/dolenta) — **nou**, manual.
- Override d'ordre de sortida **per comanda** (a `comandes`) — **nou**.
- `clients.ordre_carrega` — ja existeix.

**Validació harness 2964 (disseny anterior, encara vàlida en direcció):** matiners = La Justa + Botarell (pitjors) ✓; Avinatur = Maxim Ross + Font Navata (millors, òptims) + 4 Botarell per anticipació ✓.

🔍 **Interacció amb §2.3:** un lot >55 setm és "dolent" per edat, però la SS **mitiga** aquesta penalització; per tant "vell" no s'ha de descartar a la SS, s'ha de col·locar a la màquina bona.

---

## 3. Ordre temporal i mapeig a incubadora

### 3.1 La posició al full ≈ ordre del camió ✅

✅ **La posició num_carro_full està lligada a l'ordre de naixement / sortida del camió, NO a la qualitat del client.**

Inc 3 (carros 1-8) és la primera a néixer; Inc 8 (carros 41-44) l'última. Els clients que han de carregar el camió més aviat van a les primeres incubadores, encara que rebin lots "dolents".

### 3.2 Patró dilluns — només MS 🟡

🟡 Ordre temporal de naixement: **Inc 3 → 4 → 5 → 6 → 9 → 10 → 8**.

| Numeració | Incubadora | Tipus | Capacitat |
|---|---|---|---|
| 1-8 | Inc 3 | MSG | 8 |
| 9-16 | Inc 4 | MSG | 8 |
| 17-24 | Inc 5 | MSG | 8 |
| 25-32 | Inc 6 | MSG | 8 |
| 33-36 | Inc 9 | MSP | 4 |
| 37-40 | Inc 10 | MSP | 4 |
| 41-44 | Inc 8 | MSP | 4 |

### 3.3 Patró dijous — SS + MS 🟡

🟡 Ordre temporal: **SS (1-24) → Inc 1 → Inc 2 → Inc 8**.

| Numeració | Incubadora | Tipus | Capacitat |
|---|---|---|---|
| 1-24 | SS (Inc 11, 12 o 13, rotatiu) | Singlestage | 24 |
| 25-32 | Inc 1 | MSG | 8 |
| 33-40 | Inc 2 | MSG | 8 |
| 41-44 | Inc 8 | MSP | 4 |

Composició típica (refinada 2026-06-01, §2.9.4): **Pondex omple la major part de la SS**; el **sobrant de la SS (~1 carro) el completen carros sans de Sanco**; després, al bloc MS, **Nutrex** (maquila) i finalment la **resta de Sanco** (els explosius) tanquen el full. Sanco surt partit per salut del lot (sans → SS; explosius → cua MS).

### 3.4 Ompliment consecutiu ✅

✅ **El patró del dia s'omple consecutivament; si el volum és inferior a la capacitat total, les incubadores de la cua queden simplement buides.**

No és obligatori posar maquila a Inc 8 dilluns. Si Avinatur omple fins a Inc 6 i la maquila són 4 carros, la maquila va a Inc 9 (la següent del patró) i Inc 10 i Inc 8 queden buides.

### 3.5 Relació MS↔naixedora ✅

✅ Quan un full és **només MS** (cas dilluns), la relació incubadora ↔ naixedora és **fixa**, en l'ordre temporal del patró: carros 1-8 (Inc 3) → naixedora 1, carros 9-16 (Inc 4) → naixedora 2, etc.

🔍 La capacitat de cada naixedora varia (Xstreamer 8 = 8 carros, Xstreamer 4 / Vision 4 = 4 carros).

❓ Pendent: confirmar mapeig exacte incubadora MS → naixedores i validar contra `transferencies` històriques.

### 3.6 Camions compartits ✅

✅ **Una mateixa expedició (camió, viatge) pot agrupar comandes de clients diferents.** Exemple càrrega 2964: Aves Gil i Pinsos del Segre comparteixen camió.

La unitat operativa real és "camió/viatge", no "client". L'app actual ja contempla això amb `expedicions.num_viatge`.

---

## 4. Posició dins la incubadora MS

### 4.1 Esq/dre estricta per posició ✅

✅ **MSG** — pos 1-4 = costat **esquerra**, pos 5-8 = costat **dreta**. Sempre.

✅ **MSP** — pos 1-2 = esquerra, pos 3-4 = dreta.

**Important:** la posició concreta dins un mateix costat (per exemple, pos 1 vs pos 2 vs pos 3 vs pos 4) **no és una regla humana** — és arbitrària / decidida per l'app.

### 4.2 Lot-junt — preferència forta, trencable per qualitat ✅

🟡 **Revisat 2026-06-01 (§2.9):** el lot-junt **NO és una regla dura** com es deia abans. És una **preferència forta**: els carros del mateix lot reproductor van consecutius físicament **sempre que es pugui**, però el motor els pot **partir quan cal per respectar la qualitat-client** (típicament per no clavar lots dolents a un client premium). Partir un lot té **cost operatiu** (els seus pollets surten de dues naixedores, §3.5), així que el motor **minimitza els trencaments** i només parteix quan és necessari. Vegeu l'exemple del Botarell 3+2 al §2.9.5.

✅ **Els carros del mateix lot reproductor tendeixen a anar consecutius físicament** i no s'alternen amb altres lots dins d'un espai petit.

✅ **El lot pot creuar el límit esq/dre** d'una mateixa incubadora.

✅ **El lot pot creuar entre INCUBADORES consecutives.** Exemple càrrega 2964: el lot 9 Maxim Ross ocupa 4 carros a Inc 5 + 4 carros a Inc 6 (continuat).

✅ **El lot pot creuar entre CLIENTS.** Exemple càrrega 2964: el lot 2 Botarell ocupa pos 6-8 d'Inc 3 (matiners: Pinsos/Aves Gil) + pos 9-12 d'Inc 4 (Avinatur). En aquest cas el lot es manté **sencer i contigu**, repartit entre clients de diferent qualitat-preferent. (Quan els clients no són adjacents, el lot es pot **partir** per protegir la qualitat — vegeu §2.9.5; sempre minimitzant els trencaments.)

✅ **Partició d'un lot que supera la capacitat d'una incubadora (resol §7 #4).** Quan un lot té més carros que les places lliures d'una incubadora, els carros del lot s'**ordenen per dies d'estoc (els més vells primer)**; s'omple la Inc X fins a capacitat amb els més vells i la resta continua a la Inc Y als **números de carro següents** (en passar de la Inc 3 a la Inc 4, els carros de la Inc 4 són el 9 i el 10, etc.). El punt de tall entre incubadores **no és una decisió humana conscient**: surt sol de combinar l'ordre per antiguitat amb l'ompliment seqüencial de posicions (§3.4, §4.1). Coherent amb la prioritat de buidar estoc vell (§2.7).

**Jerarquia de regles d'agrupació (revisada 2026-06-01, vegeu §2.9.5):**

Cap d'aquestes és dura. Les dures de veritat són 14 dies, sexat→Ross, SS sense explosius/cap. 24 i ordre físic (§2.9.5). Entre les toves:

1. **Qualitat-client (§2.5):** és la que mana entre les toves; pot fer **partir un lot** (trencar el lot-junt) per no embrutar un client premium amb lots dolents.
2. **Lot-junt:** preferència **forta** però trencable per qualitat; el motor minimitza els trencaments pel cost operatiu (§3.5).
3. **Client-junt (§4.4):** preferència suau; cedeix davant de la qualitat i del lot-junt.

### 4.3 Equilibri de costats a MSP ✅

✅ **MSP no s'omple sempre del tot.** Quan no es té els 4 carros, l'objectiu és **equilibrar costats**: no 3-0, sinó 2-1; no 2-0, sinó 1-1.

✅ **Per N<4 carros, esq/dre és indiferent** (sense preferència).

### 4.4 Client-junt (preferència suau) ✅

✅ **Una comanda d'un mateix client no s'esquitlla entre incubadores si es pot evitar i no hi entra en conflicte amb lot-junt.**

Aquesta regla és **dèbil** comparada amb lot-junt. Si un lot llarg encaixa entre dos clients, el lot-junt guanya i el client-junt es trenca.

Exemple càrrega 2964: 4 Nutrex tots a Inc 9 (2-2) i Inc 6 pos 32 buida, perquè és una comanda petita que cap sencera en una sola incubadora.

### 4.5 Homogeneïtat tèrmica dins la MS (sensors) ✅

✅ **Articulada i prioritzada per l'Enric (2026-05-29).** El problema a evitar és el **gradient tèrmic dins d'una mateixa MS**: si un costat acumula lots de poca calor (p. ex. molt joves <30 setm, ous petits) i l'altre lots calorosos, es genera molta escalfor a un costat i poca a l'altre, **enganyant el sensor de temperatura de la màquina**, que regula malament tota la incubadora. (Una MS uniformement freda **no** és problema: el sensor la regula bé; el problema és el gradient intern.)

**Estratègia real de l'Enric:** quan hi ha llibertat, **agrupa els lots joves (poca calor) dins una mateixa incubadora** perquè cada MS quedi tèrmicament homogènia, en comptes de barrejar joves i calorosos en una mateixa MS.

**Prioritat (resol §7 #11):**

1. **L'ordre de camió quasi sempre mana** (§3.1) — i el lot-junt mai es trenca (§4.2).
2. L'homogeneïtat tèrmica és una **preferència suau** que actua només en els graus de llibertat que sobren (a quina MS encaixa un lot flexible, agrupació de joves). Excepcionalment l'Enric pot reordenar, però és rar.
3. **El sistema HAURIA D'AVISAR** quan una MS quedi tèrmicament desequilibrada (gradient esq/dre alt) i no es pugui evitar. L'avís és desitjat explícitament; no cal que el Pre-suggerit forci res trencant l'ordre de camió.

**Càlcul de l'avís:** sumar `indexCalorCarro` (§5.4) dels carros pos 1-4 (esq) vs 5-8 (dre); a MS tots entren el mateix dia, així la diferència ve només de la composició de lots. Si la desviació relativa supera un llindar (per definir), avisar.

❓ Sub-pendent menor: llindar concret de desviació esq/dre per disparar l'avís.

---

## 5. Posició dins la incubadora SS

### 5.1 La posició està determinada per CALOR, no pel client ✅

✅ A la **Singlestage** la posició física dins la incubadora es decideix per la **calor metabòlica que produeix cada lot** durant la incubació, **no** per quin client la rebrà.

- **Pulsator i paret** (pos extremes, 1-8 i 17-24): lots que produeixen **més calor**.
- **Central** (pos del mig, 9-16): lots que produeixen **menys calor**.

⚠️ **Correcció (2026-05-29):** "més calor" **NO** vol dir "més joves". Segons la fórmula (§5.4), la calor per ou fa pic a mitja edat (**~40 setm**) i decau cap als dos extrems: els lots **molt joves (<30 setm)** tenen ous petits i produeixen **poca** calor, igual que els molt vells. La font de veritat és `indexCalorCarro`, no l'edat. La caracterització original "joves=calorosos" era imprecisa i només val dins el rang operatiu 30-55, on els de 30-45 escalfen més que els de 50-55.

### 5.2 El carro 2 = ovoscan ✅

✅ **El carro a pos 2 conté el sensor (ovoscan) que regula la temperatura de tota la incubadora.**

Sempre s'hi posa **el lot que produeix més calor**, perquè així el sensor detecta temperatura alta → el sistema no escalfa → la incubadora es manté el més freda possible, evitant sobreescalfar els lots calorosos d'altres posicions.

### 5.3 Assignació a naixedora — desconnectada de la posició física ✅

✅ A la SS, **els carros es distribueixen a les naixedores per LOT**, no per posició física. Tots els carros d'un mateix lot van junts a les seves naixedores corresponents, encara que físicament a la SS estiguin dispersos.

✅ **La calor es calcula amb una fórmula a `lib/termico.ts` (resol §7 #6).** No és funció només de l'edat:

`calor_carro = quantitat_ous × fertilitat(setmanes) × corba_metab(dia_incubació) × factor_pes_ou(setmanes)`

- **quantitat_ous:** factor lineal i dominant (carro sencer ≈ 2× carro mig).
- **fertilitat:** pic 28-35 setm (0.93), baixa a 0.55 a >60 setm.
- **corba_metab:** funció del dia d'incubació, pic al dia 19. A la SS tots els carros entren el mateix dia → aquest factor és comú i **no altera el rànquing relatiu** entre carros del full.
- **factor_pes_ou:** ous grans escalfen més; el pes fa pic ~40-45 setm.

**Conseqüència per al rànquing SS:** com que la corba pel dia és comuna, l'ordre calorós→fred d'un full ve donat per `quantitat_ous × fertilitat × factor_pes_ou`. El "per ou" (fertilitat × pes) fa màxim cap a **~40 setm** i decau cap als lots vells. La regla simplificada de §5.1 (jove=calorós, vell=fred) és **correcta en direcció**, però el nombre d'ous pesa molt: un carro vell sencer pot superar un de jove a mitges. L'algorisme de SS ha d'ordenar per `indexCalorCarro` (o `calorFuturaCarro`), no per edat sola.

✅ **Resolt #10 (confirmat per l'Enric, 2026-05-29):** el suggeriment de calor a MS **no s'usa**. La fórmula de `termico.ts` es manté **només per a SS**. La funció `suggerirZonaMS` (equilibri per zona central/paret/pulsator) **s'ha de treure** —a més, equilibrava per l'eix equivocat (zona), no pel que importa a MS (esq/dre, vegeu §4.5)—. A MS la zona segueix sent rotació mecànica (§6).

---

## 6. Zona (post-rotació, no és decisió)

🟡 **El camp `zona` (paret / central / pulsator) NO es decideix per l'usuari** a MS. Representa l'estat físic actual del carro dins la incubadora MS, derivat de la rotació mecànica/operativa: els carros entren a `central`, després passen a `paret`, després a `pulsator`.

Implicacions per a l'algorisme:

- El Pre-suggerit **no ha de triar zona**.
- El que sí decideix l'usuari (i per tant l'algorisme) és **incubadora** i **costat (esq/dre)** dins la incubadora.

**Evidència:** al full real 2964 acabat d'entrar (01/06), totes les MSG estan a zona `central`. Coherent amb la teoria de rotació: el full més fresc va a central.

❓ Pendent: confirmar (a) durada exacta de cada fase, (b) si la rotació és automàtica/física o algú la registra manualment, (c) què passa si un carro entra "tard" en un cicle ja començat.

---

## 7. Preguntes obertes

1. ✅ ~~Sanco al dijous: criteri de qualitat de lot.~~ **Resolt (§2.8):** els pitjors lots (qualitat empírica) van sempre a Sanco, que carrega l'última hora → cua del full.
2. ✅ ~~Workflow de maquila quan els carros físics no han arribat encara.~~ **Resolt (§2.1):** no es crea registre fins a l'arribada física (sense placeholder); dilluns va l'última, dijous després de la SS al bloc MS.
3. ❓ Capa empírica: mètrica i llindar concret per a la rebaixa.
4. ✅ ~~Lot >8 carros: criteri exacte de com es parteix entre incubadores.~~ **Resolt (§4.2):** ordre per dies d'estoc (vells primer), ompliment seqüencial; el tall cau on s'acaba la capacitat.
5. ❓ Mapeig exacte incubadora MS → naixedores amb capacitats variables.
6. ✅ ~~Criteri exacte de classificació "calorós/fred" per a la SS.~~ **Resolt (§5.4 i `lib/termico.ts`):** fórmula composta `quantitat_ous × fertilitat × corba_metab(dia) × pes_ou`; rànquing SS per `indexCalorCarro`, no per edat sola. *(Obre tensió MS: vegeu nou punt #10.)*
7. ✅ ~~Pondex al dijous (SS): com es decideix qualitat dels lots.~~ **Resolt (§2.8):** la SS rep lots vells a propòsit (recuperació XStreamer); no es "tria qualitat" per al client sinó per a la màquina. Equilibri tèrmic intern §5.
8. ✅ ~~Si tots els lots disponibles són >55 setm (escenari pic), com es prioritza.~~ **Resolt (§2.7):** ordre per antiguitat pura, SS com a palanca de recuperació, qualitat-client relaxada (premium rep el menys dolent).
9. ✅ ~~Algorisme de pre-càlcul d'estoc-anticipat.~~ **Resolt (§2.5):** horitzó = propera càrrega; evacuar al premium si >4 carros quedarien a >11 dies a la propera càrrega; límit dur 14 dies sempre força entrada. Llindar 4 a validar.
12. ✅ **Ordre de col·locació per QUALITAT (pitjor primer), no per dies d'estoc (feedback 2026-05-29, full 2964 manual; confirmat per l'Enric).** La v2 ordenava el pool per posta (dies d'estoc) i posava Font Navata (55 setm, bo) a matiners abans que Botarell (64 setm, dolent). Regla correcta: **el pitjor lot va primer → matiners (Inc 3); els del rang òptim 30-55 setm queden per a Avinatur.** Qualitat **U-shaped** (§2.3): "pitjor" = més lluny de la banda 30-55, tant els vells (>55) com els joves (<30). Dins la mateixa qualitat, per dies d'estoc. **Parcialment implementat 2026-05-29:** el `sort` del pool ja és qualitat-pitjor-primer (dolents fora de 30-55 primer; òptims al final; dins la mateixa qualitat per posta). Validat: Botarell va abans que Font Navata, matiners reben dolents. ✅ **RESOLT a nivell de disseny (2026-06-01, §2.9):** el repartiment per client real ja està dissenyat (categories A/B/C/M, dimensionament global en pollets, anticipació per substitució en pollets, sexat→Ross, dijous en dos fluxos, jerarquia dura/tova amb lot-junt trencable). Queda la **implementació a la v2** (Sonnet). El tiebreak fi vell-vs-jove i la modulació empírica queden integrats a l'eix de qualitat del §2.9.0 (edat U + marcador de granja + senyal sanitari).
14. ✅ **Resolt disseny + vocabulari el 2026-05-31 (vegeu §8); implementació pendent — Previsió de pollets per carro (pilar de l'assignació automàtica).** La previsió actual funciona malament i l'Enric **no la fa servir**. És un pilar: el repartiment per client (§2.9) depèn de quants carros calen per cobrir cada comanda, i això surt de la previsió. **No s'ha de calcular amb corbes de fertilitat genèriques** (com va fer l'IA al harness, que donava ~2.300-3.100 pollets/carro, absurdament baix), sinó amb **històrics ben fets**. Referència de l'Enric (sobre carro sencer ~4.800 ous): **lot bo ≈ 85% de naixement ≈ ≥4.080 pollets**; **lot molt dolent ≈ 70% ≈ 3.360 pollets**; **menys del 70% és extremadament estrany**. ⚠️ Cal **definir bé el vocabulari** (naixement, eclosió, fertilitat, % sobre ous totals vs ous fèrtils…), que ara és font de confusió. → **Es tractarà en una conversa nova dedicada.** ✅ **Fet el 2026-05-31: vocabulari fixat (§8.1) i mètode acordat (§8.3). Conclusió clau: l'historial del lot NO prediu el naixement amb les dades actuals; la previsió va per estirp + edat + màquina. Implementació + backtest pendents.**

13. ✅ **Maquila garantida sota capacitat justa — implementat 2026-05-29.** La v2 ara calcula les places noves de MS del patró i limita el pool de pollets a `maxPolletsMS = totalMSSlots − maquila`, deixant la cua per a la maquila (`poolMS = [...pollets.slice(0,maxPolletsMS), ...maquilaOrd]`). Validat amb 2964.

10. ✅ ~~Tensió MS zona vs calor.~~ **Resolt (§5.4, §6):** el suggeriment de calor a MS no s'usa; `suggerirZonaMS` es treu; la fórmula queda només per a SS.
11. ✅ ~~Prioritat de l'equilibri tèrmic esq/dre a MS.~~ **Resolt (§4.5):** ordre de camió i lot-junt manen; homogeneïtat tèrmica és preferència suau (agrupar joves junts) + avís quan el gradient és inevitable. Queda només definir el llindar de l'avís.

---

## 8. Previsió de pollets per carro i vocabulari (resol §7 #14)

**Sessió dedicada 2026-05-31 (Opus).** Tanca el punt bloquejant §7 #14 a nivell de **disseny i vocabulari**. La implementació (construir la nova previsió + backtest) queda per a una sessió posterior, probablement amb Sonnet.

### 8.1 Vocabulari — que quedi claríssim ✅

Pel camí, l'app apunta quatre números reals (cada un en un moment del cicle):

| Què s'apunta | Quan | Camp |
|---|---|---|
| Ous totals carregats al carro (4.800 sencer / 2.400 mig) | Entrada a màquina | `carros_estoc.quantitat_ous` |
| Ous explosius (podrits) | A la transferència (~dia 18) | `transferencies.ous_explosius` |
| Ous fèrtils que es vacunen | A la transferència | `transferencies.ous_fertils_vacunats` |
| Pollets nascuts (**ja viables**) | Al naixement | `resultats_naix.pollets_nascuts` |
| Pollets descartats | Al naixement | `resultats_naix.pollets_descartats` |

Punts importants per no confondre'ns:

- **`pollets_nascuts` ja són pollets viables.** `pollets_descartats` és un calaix a part i només serveix per calcular el **% de descartats** = descartats / (nascuts + descartats). El total nascuts+descartats **no es mira mai**. Quan diem "pollets nascuts" o "naixement", sempre parlem de pollets viables.
- Els **ous fèrtils vacunats** i els **explosius** es mesuren a la transferència, **després** de planificar la càrrega. Per tant **no són input** de la previsió que fem servir per repartir carros (en el moment de planificar encara no els tenim).

A partir d'aquí l'app calcula **dues ràtios diferents** que cal no barrejar:

- **Naixement** = pollets nascuts / **ous totals del carro**. ✅ **És LA xifra que mana per a l'assignació** (quants pollets dona de veritat un carro). Referència de l'Enric sobre carro sencer (~4.800): lot bo ≈ **85%** (~4.080 pollets), lot molt dolent ≈ **70%** (~3.360); per sota del 70% és raríssim.
- **Eclosió** = pollets nascuts / **ous fèrtils vacunats**. És una mètrica de **diagnòstic** (dels ous bons, quants han eclosionat). **No** governa l'assignació.

(Al codi ja estan ben separades: `naixement` a `lib/previsio.ts`, `eclosió` a `lib/eclosio.ts`.)

### 8.2 Què mou el naixement, segons les dades ✅

Anàlisi del 2026-05-31 sobre **245 naixements reals post-tall** (mitjana 82,5%, rang 62-91%, desviació ~5 punts). El "~2.300-3.100 pollets/carro absurd" que es cita al §7 #14 **era cosa del harness** (corbes de fertilitat genèriques), no de l'app.

- **Edat del lot:** pic cap a **35-44 setmanes** (~88% a MS) i caiguda cap als **55+** (~77% a MS). Unes 11 punts d'oscil·lació.
- **Tipus de màquina:** la **SS (XStreamer) dona ~+5 punts** de naixement sobre la MS a igual edat. Confirma el §2.8 (allà s'estimava ~+6%).
- **L'historial propi del lot NO aporta res** un cop ja saps estirp + edat + màquina. Provat sense trampa (referència leave-one-out): afegir l'ajust per lot deixa l'error igual o pitjor (1,27% → 1,29%) i la correlació entre "com va anar abans aquest lot" i "com va ara" és ~0. Per això el `delta` per lot del codi (desactivat) feia bé d'estar-ho: **el senyal no hi és**.
  - ⚠️ **Caveat honest:** això surt de només **10 lots** d'històric. És "no es detecta", no "és impossible per sempre". **Cal reobrir-ho** quan tinguem força més lots: si llavors es detecta que l'historial del lot sí que prediu, es reincorpora.

### 8.3 Mètode de previsió acordat ✅

- La previsió és **funció només de estirp + edat (setmanes) + tipus de màquina**. Dos lots iguals en aquests tres eixos reben la **mateixa** previsió, encara que un hagi semblat pitjor últimament (decisió Enric 2026-05-31: "si les dades ho avalen, ha de ser així").
- Es construeix com una **corba contínua** del naixement segons l'edat, separada per estirp i per màquina, recolzada en les dades reals i fent servir l'històric d'Excel com a base on les dades reals són primes. Objectiu: que **sempre** apareguin la caiguda per edat i el bonus de la SS, en comptes de desinflar-se al 0,82 pla com fa ara la cascada quan li falten dades exactes d'aquella setmana.
- **Sortida en pollets/carro** = naixement%(estirp, edat, màquina) × ous del carro. És exactament el que necessita el repartiment per client (§2.9) per saber quants carros calen per comanda.
- ✅ **Pendents tècnics resolts (2026-05-31, §8.6):** suavitzat = finestra ±2 setm + decreixement monòton ≥40; **Cobb-Singlestage** = Cobb MS + bonus SS (estimat, materialitzat a la taula); **estirps sense històric** = s'usa la corba de Ross (millor coberta), marcat `corba_estirp_via_ross`.

### 8.4 Marge de seguretat — substitueix el "+1 carro" del §2.6 ✅

- En comptes de la previsió central, es planifica amb una previsió **lleugerament conservadora** (marge **moderat**, opció triada per l'Enric: no li agrada quedar curt amb un client, però dins d'un límit, i ara que la previsió és més precisa s'ho pot permetre).
- El valor exacte del marge **NO es fixa a ull**: serà un **paràmetre calibrat amb el backtest**, mirant sobre l'històric real quantes comandes haurien quedat curtes amb cada valor, fins a tocar el punt "gairebé mai curt, excedent petit". L'Enric el podrà tocar.
- **Motiu pel qual un marge moderat n'hi ha prou:** una comanda es cobreix amb diversos carros (4-8); en promitjar-los, les sorpreses individuals es compensen, així que el risc de quedar curt a nivell de comanda és més petit del que sembla mirant un sol carro.
- Es manté sempre l'**override manual**: l'Enric pot afegir o treure carros quan vegi alguna cosa que el número no veu (p. ex. un senyal sanitari).

### 8.5 Validació (feta 2026-05-31, Opus) ✅

**Backtest leave-one-lot-out** sobre els 7 lots reals post-tall (245 naixements). Predint cada lot com si fos nou (forma Excel + offset calibrat amb els altres 6 lots):

- **MAE a nivell de lot = 3,5 pp**, contra **4,9 pp** del fallback pla 0,82. Millora real però modesta.
- Els lots ben poblats (2, 3, 9, 25) cauen dins ~0,7-2,5 pp. Els errors grossos es concentren en lots impredictibles per disseny: lot 14 (Cobb 39 setm, n=5, va fer 90,7% quan l'Excel diu ~81%) i lot 4 (n=1). Cap mètode els endevinaria amb les dades d'avui (confusió lot/edat).
- **Offset de nivell = −0,39 pp**: l'Excel ja està pràcticament calibrat al present; la correcció amb dades reals quasi no mou res (l'històric és fiable).
- **Bonus SS = +4,75 pp** (overlap Ross 45-55), coherent amb el +5 pp observat dins els lots reals que van córrer a les dues màquines.

**Calibratge del marge (§8.4):** sense marge, 3 lots quedarien sobreestimats ("curts"); per eliminar-los del tot calen ~5 pp (excedent mitjà ~5,8 pp). Triat **marge moderat de 3 pp** (param `previsio_marge_seguretat`), que treu els curts que importen amb excedent ~5 pp. ⚠️ **Reposa en 7 lots: indicatiu, no robust.** Recalibrar quan entrin més lots.

⚠️ **Caveat global honest:** amb 7 lots, estirp i edat estan gairebé confosos amb el lot (~1 ramat per estirp×màquina×banda d'edat). La FORMA de la corba ve de l'Excel (Ross MS: 1.548 reg.; Cobb MS: 126; Ross SS: 201; Cobb SS: 0), no dels reals. El valor principal d'ara és que la previsió **sempre** mostra la caiguda per edat i el bonus SS, en comptes de desinflar-se al 0,82 pla.

### 8.6 Implementació (feta 2026-05-31) ✅

- **Taula `previsio_corba`** (estirp, tipus_incubadora, setmanes 24-66, naixement_pct, font): forma Excel suavitzada (finestra ±2 setm, decreixement monòton ≥40 setm), Singlestage = Multistage + bonus SS, Cobb Singlestage = Cobb MS + bonus (estimat, sense dades directes). 172 files. Inspeccionable i editable.
- **Paràmetres** a `parametres`: `previsio_offset_nivell` (−0.0039), `previsio_marge_seguretat` (0.03).
- **`lib/previsio.ts` reescrit**: eliminades la cascada de fonts i tota la maquinària del delta del lot (§8.2: sense senyal). Ara: lookup a la corba (cau a memòria) + offset → previsió central; `calcularPrevisioFinal` afegeix `previsio_conservadora` = central − marge (per a la planificació de carros per comanda, §2.9). Signatures públiques i camps de l'API preservats. Tsc net.
- **Script del backtest**: `scripts/backtest_previsio.py` (reexecutable per recalibrar quan hi hagi més dades).
- ⏳ **Pendent de DESPLEGAR**: el codi nou no actua a prod fins al push → Vercel. La taula i els paràmetres ja són a prod.

---

## Annex A — Cas analitzat: Full 2952 (20/abr/2026, dilluns, no representatiu)

No utilitzable per a regles de zona/posició perquè les assignacions tenen aquests camps a `null` (les dades anteriors al 30/abr no desaven zones).

## Annex B — Cas analitzat: Full 2956 (4/mai/2026, dilluns)

40 assignacions: 32 MSG + 8 MSP. Tots els carros MSG estan a zona `pulsator`. Inc 5 mostra el cas del lot que creua esq/dre (5 Botarell pos 1-5, 3 Maxim Cobb pos 6-8). Inc 9 i 10 amb ompliment desigual (1 i 7-8 carros) → exemple d'ompliment consecutiu §3.4.

## Annex C — Cas validat: Full 2964 (01/06/2026, dilluns)

**Sessió articulada amb l'Enric el 2026-05-28. Carros entrats reals (sense maquila Nutrex, que arriba després):**

| Pos | Inc | Carro | Lot | Posta | Setm. |
|---|---|---|---|---|---|
| 1 | 3 | 667 | La Justa Ross | 20/05 | 59 |
| 2 | 3 | 669 | La Justa Ross | 22/05 | 59 |
| 3 | 3 | 676 | Maxim Cobb | 22/05 | 59 |
| 4 | 3 | 673 | Maxim Cobb | 22/05 | 59 |
| 5 | 3 | 674 | Maxim Cobb | 23/05 | 59 |
| 6 | 3 | 688 | Botarell Ross | 22/05 | 62 |
| 7 | 3 | 683 | Botarell Ross | 23/05 | 62 |
| 8 | 3 | 686 | Botarell Ross | 24/05 | 62 |
| 9 | 4 | 685 | Botarell Ross | 23/05 | 62 |
| 10 | 4 | 684 | Botarell Ross | 23/05 | 62 |
| 11 | 4 | 687 | Botarell Ross | 24/05 | 62 |
| 12 | 4 | 691 | Botarell Ross | 25/05 | 62 |
| 13 | 4 | 699 | Font Navata | 21/05 | 53 |
| 14 | 4 | 692 | Font Navata | 21/05 | 53 |
| 15 | 4 | 697 | Font Navata | 23/05 | 53 |
| 16 | 4 | 695 | Font Navata | 23/05 | 53 |
| 17 | 5 | 698 | Font Navata | 24/05 | 53 |
| 18 | 5 | 693 | Font Navata | 26/05 | 54 |
| 19 | 5 | 694 | Font Navata | 26/05 | 54 |
| 20 | 5 | 696 | Font Navata | 25/05 | 54 |
| 21 | 5 | 682 | Maxim Ross | 24/05 | 53 |
| 22 | 5 | 681 | Maxim Ross | 25/05 | 54 |
| 23 | 5 | 679 | Maxim Ross | 26/05 | 54 |
| 24 | 5 | 680 | Maxim Ross | 26/05 | 54 |
| 25 | 6 | 678 | Maxim Ross | 26/05 | 54 |
| 26 | 6 | 677 | Maxim Ross | 26/05 | 54 |
| 27 | 6 | 701 | Maxim Ross | 26/05 | 54 |
| 28 | 6 | 700 | Maxim Ross | 26/05 | 54 |
| 29 | 6 | 661 | Barberà | 24/05 | 55 |
| 30 | 6 | 646 | Barberà | 23/05 | 55 |
| 31 | 6 | 663 | Barberà | 23/05 | 55 |
| 32 | 6 | 662 | Barberà | 23/05 | 55 |
| 33-36 | 9 | (pend) | Nutrex maquila (4 places, 2-2) | — | — |

Total: **32 carros pollets + 4 places maquila** = 36 places (vs 30 proposats inicialment per IA, 23 Avinatur + 7 matiners). Recompte real Avinatur: 4 Botarell + 8 Font Navata + 8 Maxim Ross + 4 Barberà = **24 carros**.

**Composició per client (real):**

- **Aves Gil + Pinsos del Segre** (matiners, Inc 3): 2 La Justa + 3 Maxim Cobb + 3 Botarell = 8 carros.
- **Avinatur** (premium, Inc 4-6): **4 Botarell** (regla anticipació §2.5) + 8 Font Navata + 8 Maxim Ross + 4 Barberà = 24 carros.
- **Nutrex** (maquila, Inc 9): 4 carros, pendents d'arribada.

**Validacions de regles capturades:**

- ✅ Antiguitat 14 dies (§2.2): tots els carros obligats han entrat (20/05, 21/05, 22/05).
- ✅ Edat òptima 30-55 setm (§2.3): Maxim Ross / Font Navata / Barberà = bons; Cobb / La Justa / Botarell = dolents.
- ✅ Anticipació d'estoc (§2.5): 4 Botarell van a Avinatur per evitar saturació dijous 04/06.
- ✅ Patró dilluns Inc 3→4→5→6 (§3.2): respectat.
- ✅ Ompliment consecutiu (§3.4): Inc 10 i Inc 8 buides.
- ✅ Esq/dre estricta (§4.1): respectada (no es pot validar 100% sense saber posicions exactes, però l'app ho gestiona).
- ✅ Lot-junt creua incubadores i clients (§4.2): Botarell ocupa pos 6-12 (Inc 3 matiner → Inc 4 Avinatur). Font Navata pos 13-20 (Inc 4 → Inc 5). Maxim Ross pos 21-28 (Inc 5 → Inc 6).
- ✅ Marge de seguretat +1 carro (§2.6): l'Enric afegeix 1 carro extra per cobrir possible eclosió baixa (Cobb/Botarell darrers 73%).

**Carros que NO entren aquest full (queden a estoc per a la propera càrrega):**

- Maxim Cobb del 24/05 (675).
- La Justa del 24-26/05 (668, 671, 670).
- Botarell del 25-26/05 (690, 689).
- Maxim Ross del 27/05 (702, 703, 704).

Total: ~10 carros que pugen a la cua de la propera càrrega (dijous 04/06).
