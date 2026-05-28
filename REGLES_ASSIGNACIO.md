# Regles d'assignació de carros a incubadores

**Estat:** esborrany viu. Cada regla porta etiqueta de fiabilitat:

- ✅ **Confirmada** — l'Enric ha articulat la regla i tenim 1+ exemple real que la suporta.
- 🟡 **Articulada, pendent de validar** — l'Enric l'ha articulat però no s'ha provat contra cap full real o el full disponible la contradiu.
- 🔍 **Hipòtesi** — el sistema o les dades suggereixen quelcom; encara no confirmat per l'Enric.
- ❓ **Pregunta oberta** — sabem que cal una regla aquí però no la tenim.

L'objectiu d'aquest document és arribar a un conjunt de regles prou complet com perquè el botó "Pre-suggerit" de la pantalla d'assignacions produeixi una col·locació que una persona no experta pugui acceptar amb intervenció mínima.

---

## 1. Concepte fonamental: la zona NO és una decisió

🟡 **El camp `zona` (paret / central / pulsator) NO es decideix per l'usuari.** Representa l'estat físic actual del carro dins la incubadora MS, derivat de la rotació mecànica/operativa: els carros entren a `central`, després passen a `paret`, després a `pulsator`.

Implicacions per a l'algorisme:
- El Pre-suggerit no ha de triar zona.
- El que sí decideix l'usuari (i per tant l'algorisme) és **incubadora** i **posició dins la incubadora**.

**Evidència:** als fulls amb zona desada, totes les MSG d'un mateix full tenen la mateixa zona. Aquesta zona varia en funció de l'antiguitat del full respecte a la data actual (fulls més antics → pulsator; recents → central). Patró compatible amb una rotació de ~10 dies per zona.

**Pendent:** confirmar amb l'Enric (a) la durada exacta de cada fase, (b) si la rotació és automàtica/física o algú la registra manualment, (c) què passa si un carro entra "tard" en un cicle ja començat.

---

## 2. Mapeig num_carro_full → incubadora segons dia patró

🟡 **Dilluns:** ordre seqüencial d'incubadores **3 → 4 → 5 → 6 → 9 → 10 → 8**.

| Números | Incubadora | Tipus | Capacitat usada |
|---|---|---|---|
| 1–8   | Inc 3  | MSG | 8 |
| 9–16  | Inc 4  | MSG | 8 |
| 17–24 | Inc 5  | MSG | 8 |
| 25–32 | Inc 6  | MSG | 8 |
| 33–36 | Inc 9  | MSP | 4 (màx) |
| 37–40 | Inc 10 | MSP | 4 (màx) |
| 41–44 | Inc 8  | MSP | 4 (màx) |

🟡 **Dijous:** una SS amb números 1–24, després **Inc 1 → Inc 2 → Inc 8**.

| Números | Incubadora | Tipus | Capacitat usada |
|---|---|---|---|
| 1–24  | SS (1 màquina) | SS  | 24 |
| 25–32 | Inc 1          | MSG | 8 |
| 33–40 | Inc 2          | MSG | 8 |
| 41–44 | Inc 8          | MSP | 4 (màx) |

❓ **Què passa si un dilluns una incubadora del recorregut ja està ocupada per un full anterior?** El full 2956 sembla suggerir que es salta o es reorganitza (Inc 9 amb 1 carro, Inc 10 amb 7). Pendent de confirmar a la sessió de demà.

❓ **Per què aquest ordre concret d'incubadores?** (proximitat física, conveniència operativa, ordre de càrrega del personal). Saber-ho ajuda a generalitzar quan canviï l'inventari d'incubadores.

---

## 3. Posició dins la incubadora

✅ **MSG — regla esq/dre estricta per posició:** posicions 1–4 = costat esquerra, posicions 5–8 = costat dret. Sempre. La posició concreta dins un costat no importa.

✅ **MSP — regla esq/dre:** posicions 1–2 = esquerra, posicions 3–4 = dreta.

✅ **SS (només dijous):** la posició concreta sí és important. Pendent d'articular el criteri exacte (preguntar demà).

---

## 4. Restricció lot-junt (i la seva relació amb la regla esq/dre)

✅ **Els carros del mateix lot reproductor han d'anar consecutius físicament.** No es pot alternar (no posar Botarell, després Palau, després Botarell un altre cop).

✅ **Un lot SÍ pot creuar el límit esq/dre.** Exemple articulat per l'Enric: si Inc 4 té 5 carros Botarell + 3 Palau (assignats com a #9–16):
- #9, 10, 11, 12 → Botarell, pos 1–4 (esq sencera)
- #13 → Botarell, pos 5 (el cinquè Botarell, primer del costat dre)
- #14, 15, 16 → Palau, pos 6, 7, 8 (resta del costat dre)

La regla esq/dre (per posició) i la regla lot-junt (per ordre) **conviuen**: els lots es col·loquen en ordre, sense alternar, i si un creua el límit esq/dre simplement continua a l'altre costat.

❓ **Pendent:** què passa si un lot té més de 8 carros (no cap a una sola MSG). Es parteix entre incubadores? Quin criteri de partició?

---

## 5. Equilibri de costats a MSP

🟡 **MSP no es solen omplir totalment.** Quan no es té els 4 carros, l'objectiu és **equilibrar costats**: no 3-0 sinó 2-1; no 2-0 sinó 1-1.

Quan el full té diverses MSP i no es pot equilibrar dins d'una, l'Enric tendeix a equilibrar globalment (l'altra MSP compensa).

✅ **MSG no aplica** perquè quasi sempre estan plenes (8 carros).

❓ **Pendent:** quan no hi ha cap manera d'equilibrar (per exemple 1 carro sol a una MSP), a quin costat va? Hi ha preferència esq vs dre?

---

## 5. Quins carros entren al full

🔍 La selecció de quins carros van a quin full sembla guiada per: (a) edat de l'estoc (posta més antiga primer), (b) edat del lot reproductor (matèria de prioritat), (c) compatibilitat amb la comanda del client. No està articulat.

❓ Hi ha alguna restricció client→lot? (per exemple, alguns clients només volen Ross, no Cobb)

❓ Què passa amb la maquila? L'Enric no l'ha mencionada en la primera sessió.

---

## 6. Preguntes obertes per a la sessió de demà (29/maig/2026)

1. Confirmar el model de rotació de zones (central → paret → pulsator, ~10 dies cadascuna).
2. Què passa si una incubadora del recorregut està ocupada per un full anterior (cas Inc 9 al full 2956: tenia 1 carro en lloc dels 4 esperats, i Inc 10 en tenia 7-8).
3. Lots amb >8 carros (no caben en una sola MSG): com es parteixen entre incubadores?
4. MSP amb 1 carro sol: hi ha preferència esq vs dre?
5. Quin és el criteri exacte de **quins lots entren al full** (no només on van).
6. Posició a SS: criteri exacte.
7. Maquila: tracte diferent?
8. L'ordre d'incubadores per dia patró (dilluns 3-4-5-6-9-10-8, dijous 1-2-8) està lligat a la disposició física de la nau o és un costum que es podria revisar.

---

## Annex A — Cas analitzat: Full 2952 (20/abr/2026, dilluns, no representatiu)

No utilitzable per a regles de zona/posició perquè les assignacions tenen aquests camps a `null` (les dades anteriors al 30/abr no desaven zones).

## Annex B — Cas analitzat: Full 2956 (4/mai/2026, dilluns)

40 assignacions: 32 MSG + 8 MSP. Tots els carros MSG estan a zona `pulsator` (compatible amb rotació de ~28 dies). Distribució:

- Inc 3 (#1–8): 8 carros Botarell Ross, posta 26-27/abr (lot 59 setm). Costat esq (pos 1–4) i dre (pos 5–8). ✅ Coherent amb regla 2 i 3.
- Inc 4 (#9–16): 8 carros Botarell Ross, posta 28-29/abr (lot 59 setm). ✅
- Inc 5 (#17–24): 5 Botarell Ross + 3 Maxim Cobb. Els 5 Botarell ocupen pos 1–5 (esq sencera + primer del costat dre); els 3 Maxim Cobb ocupen pos 6–8. ✅ **Confirma la regla esq/dre estricta i la regla lot-creua-límit** (vegeu §3 i §4). El meu pre-judici inicial que "trencava la regla" era erroni.
- Inc 6 (#25–32): 8 carros Maxim Ross (lot 51 setm). ✅
- Inc 9 (#37): 1 carro Botarell Ross. ⚠ Esperat 4, només 1.
- Inc 10 (#33–36, #38–40): 7 carros Maxim Ross + 1 Botarell Ross. ⚠ Esperat 4, n'hi ha 7-8.

L'observació d'Inc 5 i de Inc 9/10 mostra que les regles tenen excepcions importants que cal articular.
