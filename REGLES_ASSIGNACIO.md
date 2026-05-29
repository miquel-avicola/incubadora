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

### 2.5 Qualitat-client (SOFT, modulable) ✅

✅ **Hi ha una preferència de quins lots reben quins clients, però NO és una regla estricta.**

| Categoria | Clients (dilluns) | Clients (dijous) | Qualitat lot preferent |
|---|---|---|---|
| Premium | Avinatur | — | Bons |
| Matiners | Pinsos del Segre, Aves Gil, Florida, GUCO | Pondex (SS) | Dolents (o el que toqui per antiguitat) |
| Maquila | Nutrex | Nutrex, Sanco | Indiferent / el que sobri |

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

⚠️ **Restricció:** dins la SS cal trobar un **equilibri tèrmic** igualment (§5): no es poden amuntegar tots els lots freds sense respectar el rànquing de calor (el carro pos 2 = ovoscan vol el més calorós dels presents, §5.2).

🔍 **Interacció amb §2.3:** un lot >55 setm és "dolent" per edat, però la SS **mitiga** aquesta penalització; per tant "vell" no s'ha de descartar, s'ha de col·locar a la màquina bona.

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

Composició típica: **Pondex omple la SS** (24 carros), **Sanco** comença al carro 25, **Nutrex** s'intercala segons sortida camió, i la resta de Sanco tanca.

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

### 4.2 Lot-junt — pot creuar incubadores i clients ✅

✅ **Els carros del mateix lot reproductor han d'anar consecutius físicament.** No es pot alternar.

✅ **El lot pot creuar el límit esq/dre** d'una mateixa incubadora.

✅ **El lot pot creuar entre INCUBADORES consecutives.** Exemple càrrega 2964: el lot 9 Maxim Ross ocupa 4 carros a Inc 5 + 4 carros a Inc 6 (continuat).

✅ **El lot pot creuar entre CLIENTS.** Exemple càrrega 2964: el lot 2 Botarell ocupa pos 6-8 d'Inc 3 (matiners: Pinsos/Aves Gil) + pos 9-12 d'Inc 4 (Avinatur). El lot mai es trenca, encara que el costo sigui repartir el lot entre clients amb diferent qualitat-preferent.

✅ **Partició d'un lot que supera la capacitat d'una incubadora (resol §7 #4).** Quan un lot té més carros que les places lliures d'una incubadora, els carros del lot s'**ordenen per dies d'estoc (els més vells primer)**; s'omple la Inc X fins a capacitat amb els més vells i la resta continua a la Inc Y als **números de carro següents** (en passar de la Inc 3 a la Inc 4, els carros de la Inc 4 són el 9 i el 10, etc.). El punt de tall entre incubadores **no és una decisió humana conscient**: surt sol de combinar l'ordre per antiguitat amb l'ompliment seqüencial de posicions (§3.4, §4.1). Coherent amb la prioritat de buidar estoc vell (§2.7).

**Jerarquia de regles d'agrupació (de més a menys forta):**

1. **Lot-junt:** estricta. Mai es trenca.
2. **Qualitat-client (§2.5):** preferència, modulable per anticipació d'estoc.
3. **Client-junt (§4.4):** preferència suau, només quan no entra en conflicte amb la lot-junt ni amb ompliment de places sense forats grans.

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
12. ✅ **Ordre de col·locació per QUALITAT (pitjor primer), no per dies d'estoc (feedback 2026-05-29, full 2964 manual; confirmat per l'Enric).** La v2 ordenava el pool per posta (dies d'estoc) i posava Font Navata (55 setm, bo) a matiners abans que Botarell (64 setm, dolent). Regla correcta: **el pitjor lot va primer → matiners (Inc 3); els del rang òptim 30-55 setm queden per a Avinatur.** Qualitat **U-shaped** (§2.3): "pitjor" = més lluny de la banda 30-55, tant els vells (>55) com els joves (<30). Dins la mateixa qualitat, per dies d'estoc. **Parcialment implementat 2026-05-29:** el `sort` del pool ja és qualitat-pitjor-primer (dolents fora de 30-55 primer; òptims al final; dins la mateixa qualitat per posta). Validat: Botarell va abans que Font Navata, matiners reben dolents. **PENDENT (peça gran):** quan els dolents superen la capacitat de matiners, l'excés cau a Avinatur barrejat amb els bons; cal el **repartiment per client real** (assignar bons→premium, excés dolent→premium per anticipació §2.5 o a estoc), no només un ordre. També: tiebreak fi vell-vs-jove i modulació empírica (§2.4).
13. ✅ **Maquila garantida sota capacitat justa — implementat 2026-05-29.** La v2 ara calcula les places noves de MS del patró i limita el pool de pollets a `maxPolletsMS = totalMSSlots − maquila`, deixant la cua per a la maquila (`poolMS = [...pollets.slice(0,maxPolletsMS), ...maquilaOrd]`). Validat amb 2964.

10. ✅ ~~Tensió MS zona vs calor.~~ **Resolt (§5.4, §6):** el suggeriment de calor a MS no s'usa; `suggerirZonaMS` es treu; la fórmula queda només per a SS.
11. ✅ ~~Prioritat de l'equilibri tèrmic esq/dre a MS.~~ **Resolt (§4.5):** ordre de camió i lot-junt manen; homogeneïtat tèrmica és preferència suau (agrupar joves junts) + avís quan el gradient és inevitable. Queda només definir el llindar de l'avís.

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
