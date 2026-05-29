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

**Detall operatiu:** els carros físics poden no haver arribat encara quan es planifica el full. Es reserva l'espai a la incubadora i s'omplen quan arribin. _(Pendent confirmar workflow exacte.)_

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

❓ Pendent: definir mètrica i llindar exacte per a la "rebaixa empírica" (per exemple: si % d'eclosió mitjana dels darrers 2-3 fulls està >5 punts per sota de la previsió, llavors el lot baixa una categoria).

### 2.5 Qualitat-client (SOFT, modulable) ✅

✅ **Hi ha una preferència de quins lots reben quins clients, però NO és una regla estricta.**

| Categoria | Clients (dilluns) | Clients (dijous) | Qualitat lot preferent |
|---|---|---|---|
| Premium | Avinatur | — | Bons |
| Matiners | Pinsos del Segre, Aves Gil, Florida, GUCO | Pondex (SS) | Dolents (o el que toqui per antiguitat) |
| Maquila | Nutrex | Nutrex, Sanco | Indiferent / el que sobri |

✅ **Excepció per anticipació d'estoc:** quan a l'estoc hi ha massa carros que s'acumulen i podrien arribar al límit de 14 dies a la propera càrrega, **s'evacua una part al client premium** per evitar problemes futurs. L'estratègia mira la càrrega actual + la càrrega següent, no només la d'ara.

**Exemple real (càrrega 2964):** Avinatur reb ~15.000 pollets de Botarell (4 carros) tot i ser un client premium. Decisió presa perquè el dijous 04/06 hi haurà massa carros Botarell vells si no se n'entren ara.

❓ Pendent: confirmar classificació de Sanco al dijous (sembla repartit entre lots disponibles).

### 2.6 Càlcul de quantitat — "places" i previsió d'eclosió ✅

✅ **1 carro = 1 plaça** a la incubadora, independentment de si el carro va mig ple o sencer. Un carro mig (≈2.400 ous) ocupa el mateix que un sencer (4.800 ous).

✅ **La quantitat de carros per cobrir una comanda de pollets depèn de la previsió d'eclosió esperada per als lots assignats.** No és aritmètica fixa.

🟡 **Marge de seguretat:** si els lots assignats tenen indicis empírics de qualitat baixa (vegeu §2.4), s'afegeix **+1 carro** per cobrir possibles sorpreses (no arribar al volum compromès).

### 2.7 Lots a treure preferent (saturació d'estoc) ✅

✅ **Dins els lots "dolents", es prioritza posar els carros més vells** per buidar estoc i evitar arribar al límit dels 14 dies en futures càrregues.

✅ **Si un lot dolent es pot reduir més enllà del estrictament necessari per evitar problemes futurs, es redueix** (regla d'anticipació, vegeu §2.5).

🟡 **Selecció dins un grup de mateixa antiguitat:** quan dins un mateix lot dolent hi ha carros amb la mateixa data de posta i no calen tots, l'elecció entre ells és arbitrària. L'algorisme pot triar per ordre de carro_id o el primer disponible.

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

---

## 5. Posició dins la incubadora SS

### 5.1 La posició està determinada per CALOR, no pel client ✅

✅ A la **Singlestage** la posició física dins la incubadora es decideix per la **calor metabòlica que produeix cada lot** durant la incubació, **no** per quin client la rebrà.

- **Pulsator i paret** (pos extremes, 1-8 i 17-24): lots que produeixen **més calor** (joves, vigorosos, bons).
- **Central** (pos del mig, 9-16): lots que produeixen **menys calor** (vells, menys vigorosos, dolents).

### 5.2 El carro 2 = ovoscan ✅

✅ **El carro a pos 2 conté el sensor (ovoscan) que regula la temperatura de tota la incubadora.**

Sempre s'hi posa **el lot que produeix més calor**, perquè així el sensor detecta temperatura alta → el sistema no escalfa → la incubadora es manté el més freda possible, evitant sobreescalfar els lots calorosos d'altres posicions.

### 5.3 Assignació a naixedora — desconnectada de la posició física ✅

✅ A la SS, **els carros es distribueixen a les naixedores per LOT**, no per posició física. Tots els carros d'un mateix lot van junts a les seves naixedores corresponents, encara que físicament a la SS estiguin dispersos.

❓ Pendent: detallar com es classifiquen els lots per calor (criteri exacte; suposem joves=calorosos, vells=freds, però pot tenir matisos).

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

1. ❓ Sanco al dijous: criteri de qualitat de lot. Sembla que ocupa la cua del full.
2. ❓ Workflow de maquila quan els carros físics no han arribat encara.
3. ❓ Capa empírica: mètrica i llindar concret per a la rebaixa.
4. ❓ Lot >8 carros: criteri exacte de com es parteix entre incubadores (en quina ordre i per quin costat es comença).
5. ❓ Mapeig exacte incubadora MS → naixedores amb capacitats variables.
6. ❓ Criteri exacte de classificació "calorós/fred" per a la SS.
7. ❓ Pondex al dijous (SS): com es decideix qualitat dels lots si l'únic client és Pondex.
8. ❓ Si tots els lots disponibles són >55 setm (escenari pic), com es prioritza.
9. ❓ Algorisme de pre-càlcul d'estoc-anticipat (regla d'anticipació §2.5): com saber automàticament quan toca evacuar dolents al premium per evitar saturació futura.

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
