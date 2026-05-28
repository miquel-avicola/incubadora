# Regles d'assignació de carros a incubadores

**Estat:** esborrany viu. Cada regla porta etiqueta de fiabilitat:

- ✅ **Confirmada** — l'Enric ha articulat la regla i tenim 1+ exemple real que la suporta.
- 🟡 **Articulada, pendent de validar** — l'Enric l'ha articulat però no s'ha provat contra cap full real o el full disponible la contradiu.
- 🔍 **Hipòtesi** — el sistema o les dades suggereixen quelcom; encara no confirmat per l'Enric.
- ❓ **Pregunta oberta** — sabem que cal una regla aquí però no la tenim.

L'objectiu d'aquest document és arribar a un conjunt de regles prou complet com perquè el botó "Pre-suggerit" de la pantalla d'assignacions produeixi una col·locació que una persona no experta pugui acceptar amb intervenció mínima.

---

## 1. Marc general

El procés d'assignació té TRES decisions encadenades, i només DUES són pròpiament humanes:

1. **Selecció:** quins carros (de l'estoc) entren al full. (humà)
2. **Mapeig a incubadora:** a quina incubadora va cada carro. (humà, derivable d'ordre temporal de naixement)
3. **Posició dins la incubadora:** a quina posició concreta dins la incubadora va el carro. (humà a MSG/MSP, regla específica a SS)
4. **Zona:** NO és una decisió, és estat post-rotació (vegeu §6).

El Pre-suggerit ha de cobrir les passes 1, 2 i 3.

---

## 2. Selecció: quins carros entren al full

### 2.1 Maquila ✅

🟡 La maquila (Nutrex i altres) **entra automàticament al full** quan hi ha comanda d'ous maquila. No se'n discuteix qualitat de lot. La quantitat de carros maquila es deriva directament dels ous a maquilar (vegeu §2.6).

**Detall operatiu:** els carros físics de maquila poden no haver arribat encara quan es planifica el full. Es reserva l'espai a la incubadora i s'omplen quan arribin. _(Pendent confirmar workflow exacte.)_

### 2.2 Antiguitat d'estoc — límit dur 14 dies ✅

🟡 **Un carro no pot superar 14 dies entre posta i entrada a incubadora.** Aquest és un límit dur per qualitat de l'ou.

**Operativament:** com que la pròxima càrrega habitualment és **3 o 4 dies més tard**, en el moment de planificar un full, **tots els carros amb posta de 10-11 dies o més han d'entrar obligatòriament** (perquè si esperen a la propera càrrega arribarien o passarien dels 14 dies).

**Aplicació al full 2964 (01/06/2026, pròxima càrrega prevista +3/+4):**

| Posta | Dies al 01/06 | Carros obligats d'entrar |
|---|---|---|
| 20/05 | 12 | 667 (La Justa) |
| 21/05 | 11 | 692, 699 (Font Navata) |
| 22/05 | 10 | 688 (Botarell), 673, 676 (Maxim Cobb), 669 (La Justa) |

### 2.3 Qualitat del lot — capa estructural per edat ✅

✅ **Edat òptima del lot reproductor: 30-55 setmanes.**

- **<30 setm:** pollets molt petits i de mala qualitat.
- **30-55 setm:** zona òptima.
- **>55 setm:** generalment problemes sanitaris.

**Aplicació al full 2964:**

| Lot | Granja (informal) | Setm. | Categoria a priori |
|---|---|---|---|
| 8 | Barberà | 55 | **Bo** (al límit superior, encara dins l'òptim) |
| 9 | Maxim Ross | 53-54 | **Bo** |
| 10 | Font Navata | 53-54 | **Bo** |
| 2 | Botarell | 62-63 | Dolent (passa de 55) |
| 3 | Maxim Cobb | 59 | Dolent (passa de 55) |
| 4 | La Justa | 59-60 | Dolent (passa de 55) |

### 2.4 Qualitat del lot — capa empírica observada 🟡

🟡 La classificació estructural per edat es **reajusta a posteriori** segons els resultats observats:

- Si veig que els **pollets que neixen avui d'un lot són dolents**, baixa la categoria del lot.
- Si un lot està generant **molts ous explosius**, baixa la categoria.
- Si un lot dins el rang d'edat òptima té igualment mals resultats, també baixa.

**Implicació tècnica:** podríem automatitzar aquesta capa amb mètriques calculables des de la BD:

- `% ous explosius` = `transferencies.ous_explosius` / total ous transferits
- `% eclosió` = `resultats_naix.pollets_nascuts` / ous fèrtils vacunats
- `% pollets descartats` per qualitat

❓ Pendent: definir mètrica i llindar exacte per a la "rebaixa empírica" (ex.: si el % d'eclosió mitjana dels darrers 2-3 fulls està >X punts per sota de la previsió, llavors el lot baixa una categoria).

### 2.5 Qualitat-client ✅

✅ **Els clients premium reben lots bons; els clients matiners reben lots dolents; la maquila és independent.**

| Categoria | Clients (dilluns) | Clients (dijous) | Qualitat lot |
|---|---|---|---|
| Premium | Avinatur | — | Bons |
| Matiners | Pinsos del Segre, Aves Gil, Florida, GUCO | Pondex (SS) | Dolents (o el que toqui per antiguitat) |
| Maquila | Nutrex | Nutrex, Sanco | Indiferent / el que sobri |

❓ Pendent: confirmar la classificació de Sanco al dijous (sembla repartit entre lots disponibles).

### 2.6 Càlcul de quantitat — "places" i previsió d'eclosió ✅

✅ **1 carro = 1 plaça** a la incubadora, independentment de si el carro va mig ple o sencer. Un carro mig (≈2.400 ous) ocupa el mateix que un sencer (4.800 ous).

🟡 **La quantitat de carros per cobrir una comanda de pollets depèn de la previsió d'eclosió esperada per als lots assignats.** No és aritmètica fixa.

Exemple full 2964 — Avinatur 92.000 pollets amb lots bons (Maxim Ross, Font Navata, Barberà):

- A 85% eclosió efectiva → 4.080 pollets útils/carro → 22,5 → **23 carros**
- A 90% → 4.320 pollets/carro → 21,3 → **22 carros**

L'Enric va decidir 23 carros "depenent de la previsió". 🔍 Probablement consulta mentalment el rendiment històric d'aquests lots a `previsio_referencia`.

### 2.7 Lots a treure preferent (saturació d'estoc) ✅

✅ **Dins els lots "dolents", es prioritza posar els carros més vells** per buidar estoc i evitar arribar al límit dels 14 dies en futures càrregues.

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

🔍 La capacitat de cada naixedora varia (Xstreamer 8 = 8 carros, Xstreamer 4 / Vision 4 = 4 carros), de manera que el mapeig real és:

- 1-8 (Inc 3) → N1 (capacitat 8)
- 9-12 (Inc 4 parcial) → N2 (capacitat 4)
- 13-16 (Inc 4 parcial) → N3 (capacitat 4)
- ... etc.

❓ Pendent: confirmar mapeig exacte incubadora MS → naixedores i validar contra `transferencies` històriques.

### 3.6 Camions compartits ✅

✅ **Una mateixa expedició (camió, viatge) pot agrupar comandes de clients diferents.** Exemple full 2964: Aves Gil i Pinsos del Segre comparteixen camió, per tant l'ordre intern dins Inc 3 entre aquestes dues comandes és **irrellevant**.

La unitat operativa no és "client" sinó "camió/viatge". Caldria veure si el motor d'expedicions ja contempla això (`expedicions.num_viatge`?).

---

## 4. Posició dins la incubadora MS

### 4.1 Esq/dre estricta per posició ✅

✅ **MSG** — pos 1-4 = costat **esquerra**, pos 5-8 = costat **dreta**. Sempre. La posició concreta dins un costat és indiferent.

✅ **MSP** — pos 1-2 = esquerra, pos 3-4 = dreta.

### 4.2 Lot-junt + creuament de límit ✅

✅ **Els carros del mateix lot reproductor han d'anar consecutius físicament dins la incubadora.** No es pot alternar (no Botarell, Palau, Botarell).

✅ **Un lot SÍ pot creuar el límit esq/dre** sense problema. Exemple: 5 carros Botarell + 3 Palau a Inc 5 → Botarell pos 1-5 (esq sencera + primer dre), Palau pos 6-8.

❓ Pendent: què passa si un lot té més de 8 carros (no cap a una sola MSG). Exemple del propi 2964: Maxim Ross té 11 carros disponibles → se'n posen 8 a Inc 4 + 3 a Inc 5. Es parteix per ordre temporal d'incubadora; els 3 restants van junts al següent contenidor.

### 4.3 Equilibri de costats a MSP ✅

✅ **MSP no s'omple sempre del tot.** Quan no es té els 4 carros, l'objectiu és **equilibrar costats**: no 3-0, sinó 2-1; no 2-0, sinó 1-1.

✅ **Per N<4 carros, 2-1 i 1-2 són indiferents** (sense preferència esq/dre).

### 4.4 Client-junt ✅

✅ **Una comanda d'un mateix client no s'esquitlla entre incubadores si es pot evitar.** És preferible deixar alguna posició buida per mantenir el client agrupat.

Exemple full 2964: en lloc de posar 1 carro Nutrex a pos 32 (Inc 6) + 3 a Inc 9, es deixa pos 32 buida i s'agrupen els 4 Nutrex sencers a Inc 9 (2-2).

---

## 5. Posició dins la incubadora SS

### 5.1 La posició està determinada per CALOR, no pel client ✅

✅ A la **Singlestage** la posició física dins la incubadora es decideix per la **calor metabòlica que produeix cada lot** durant la incubació, **no** per quin client la rebrà.

- **Pulsator i paret** (posicions extremes, pos 1-8 i 17-24): lots que produeixen **més calor** (joves, vigorosos, bons).
- **Central** (posicions del mig, pos 9-16): lots que produeixen **menys calor** (vells, menys vigorosos, dolents).

### 5.2 El carro 2 = ovoscan ✅

✅ **El carro a pos 2 conté el sensor (ovoscan) que regula la temperatura de tota la incubadora.**

Sempre s'hi posa **el lot que produeix més calor**, perquè així el sensor detecta temperatura alta → el sistema no escalfa → la incubadora es manté el més freda possible, evitant sobreescalfar els lots calorosos d'altres posicions.

🔍 _Hipòtesi tècnica:_ si el carro 2 fos un lot fred, el sensor donaria temperatura baixa, el sistema escalfaria, i els lots calorosos d'altres posicions es sobreescalfarien.

### 5.3 Assignació a naixedora — desconnectada de la posició física ✅

✅ A la SS, **els carros es distribueixen a les naixedores per LOT**, no per posició física. Tots els carros d'un mateix lot van junts a les seves naixedores corresponents, encara que físicament a la SS estiguin dispersos.

**Exemple articulat per l'Enric:** SS amb 12 carros lot bo (pos 1-8 i 17-24) + 8 carros lot dolent (pos 9-16):

- Naixedores N1 (carros 1-8) + N2 (carros 17-20) + N3 (carros 21-24) → 12 carros del lot bo.
- Nutrex (maquila) entremig.
- N4 (carros 9-12) + N5 (carros 13-16) → 8 carros del lot dolent.

Ordre temporal de naixement: lot bo primer, maquila al mig, lot dolent al final. **Cada lot agrupat a la sortida.**

❓ Pendent: detallar com es classifiquen els lots per calor (criteri exacte; suposem joves=calorosos, vells=freds, però pot tenir matisos).

---

## 6. Zona (post-rotació, no és decisió)

🟡 **El camp `zona` (paret / central / pulsator) NO es decideix per l'usuari** a MS. Representa l'estat físic actual del carro dins la incubadora MS, derivat de la rotació mecànica/operativa: els carros entren a `central`, després passen a `paret`, després a `pulsator`.

Implicacions per a l'algorisme:

- El Pre-suggerit **no ha de triar zona**.
- El que sí decideix l'usuari (i per tant l'algorisme) és **incubadora** i **posició dins la incubadora**.

**Evidència:** als fulls amb zona desada, totes les MSG d'un mateix full tenen la mateixa zona; varia amb l'antiguitat del full (recents → central; antics → pulsator). Compatible amb rotació d'unes ~10 dies per zona.

❓ Pendent: confirmar (a) durada exacta de cada fase, (b) si la rotació és automàtica/física o algú la registra manualment, (c) què passa si un carro entra "tard" en un cicle ja començat.

---

## 7. Preguntes obertes

1. ❓ Sanco al dijous: criteri de qualitat de lot (premium, matiner o "el que queda"?). Sembla que ocupa la cua del full (després de Pondex i Nutrex).
2. ❓ Workflow de maquila quan els carros físics no han arribat encara: com es reserva l'espai operativament? Com es liguen els carros físics al full quan arriben?
3. ❓ Capa empírica de qualitat: definir mètrica concreta i llindar (% eclosió desviada de previsió, % explosius).
4. ❓ Lot >8 carros: com es decideix per quina incubadora es comença i en quina ordre es parteix.
5. ❓ Mapeig exacte incubadora MS → naixedores (capacitats variables N1=8, N2-N5=4...).
6. ❓ Criteri exacte de classificació "calorós/fred" per a la SS. La sospita actual és edat (joves=calorosos), però pot haver-hi més factors.
7. ❓ Pondex al dijous (SS): com es decideix la qualitat dels lots que ocupen la SS si l'únic client és Pondex (no hi ha "premium vs matiner" intern).
8. ❓ Si tots els lots disponibles són >55 setm (escenari de pic), com es prioritza per als clients premium? Es donen els "menys dolents"?

---

## Annex A — Cas analitzat: Full 2952 (20/abr/2026, dilluns, no representatiu)

No utilitzable per a regles de zona/posició perquè les assignacions tenen aquests camps a `null` (les dades anteriors al 30/abr no desaven zones).

## Annex B — Cas analitzat: Full 2956 (4/mai/2026, dilluns)

40 assignacions: 32 MSG + 8 MSP. Tots els carros MSG estan a zona `pulsator` (compatible amb rotació de ~28 dies). Distribució:

- Inc 3 (#1–8): 8 carros Botarell Ross, posta 26-27/abr (lot 59 setm). Costat esq (pos 1–4) i dre (pos 5–8). ✅ Coherent amb regla 4.1.
- Inc 4 (#9–16): 8 carros Botarell Ross, posta 28-29/abr (lot 59 setm). ✅
- Inc 5 (#17–24): 5 Botarell Ross + 3 Maxim Cobb. Els 5 Botarell ocupen pos 1–5 (esq sencera + primer del costat dre); els 3 Maxim Cobb ocupen pos 6–8. ✅ Confirma la regla esq/dre estricta i la regla lot-creua-límit (§4.1 i §4.2).
- Inc 6 (#25–32): 8 carros Maxim Ross (lot 51 setm). ✅
- Inc 9 (#37): 1 carro Botarell Ross. ⚠ Esperat 4, només 1. Coherent amb regla 3.4 (ompliment consecutiu).
- Inc 10 (#33–36, #38–40): 7 carros Maxim Ross + 1 Botarell Ross. ⚠ Esperat 4, n'hi ha 7-8.

## Annex C — Cas prospectiu: Full 2964 (01/06/2026, dilluns)

Sessió articulada amb l'Enric el 2026-05-28. Col·locació proposada:

| Pos | Inc | Client | Lot | Carros |
|---|---|---|---|---|
| 1-2 | 3 | Aves Gil + Pinsos del Segre (camió compartit) | Maxim Cobb | 673, 676 (postes 22/05, obligats) |
| 3-4 | 3 | Aves Gil + Pinsos | La Justa | 667 (posta 20/05, obligat), 669 (22/05, obligat) |
| 5-7 | 3 | Aves Gil + Pinsos | Botarell | 688 (22/05, obligat), 684, 683 (23/05) |
| 8 | 3 | Aves Gil + Pinsos | Botarell | 685 (23/05) |
| 9-16 | 4 | Avinatur | Maxim Ross (lot 9) | 8 carros, prioritzant postes velles |
| 17-19 | 5 | Avinatur | Maxim Ross | 3 més (lot 9 → 11 carros en total) |
| 20-24 | 5 | Avinatur | Font Navata (lot 10) | 5 carros (inclou 692, 699 obligats) |
| 25-27 | 6 | Avinatur | Font Navata | 3 més (lot 10 → 8 carros en total) |
| 28-31 | 6 | Avinatur | Barberà (lot 8) | 4 sencers |
| 32 | 6 | — | — | **buida** (preserva client-junt Nutrex) |
| 33-34 | 9 | Nutrex (maquila) | (lot per definir quan arribi) | 2 esq |
| 35-36 | 9 | Nutrex | | 2 dre |
| 37-44 | 10, 8 | — | — | totes buides |

Total: **34 carros** (7 matiners + 23 Avinatur + 4 maquila).

**Carros disponibles a estoc que NO entren aquest full:** 2 Maxim Cobb del 23-24/05 (674, 675), 1 La Justa del 24/05 (668), 2 La Justa del 25-26/05 (671, 670), 6 Botarell del 24-26/05 (687, 686, 690, 691, 689), 3 Maxim Ross del 24-25/05 (682, 681, alguns del 26-27/05 si en sobren), alguns Font Navata del 24-26/05. Es revisaran a la propera càrrega.
