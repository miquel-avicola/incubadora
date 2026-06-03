# Pla de millores: pendents, rendiment, flux i reestructuració

> Document de diagnòstic i decisions per a l'Enric.
> Inici: 3 de juny de 2026 (diagnòstic). Actualitzat: 3 de juny de 2026 (sessió 2, decisions tancades).
> Les sessions de diagnòstic **no toquen codi**. La implementació es farà en sessions a part.

---

## 0. Veredicte en una frase

L'app està madura i segura. El que perceps com "que vagi millor" **no és velocitat de
màquina sinó flux de navegació**: avui tot penja de "Càrregues → vista general →
apartat", i això són massa salts. A més, has decidit **simplificar l'app traient dos
subsistemes que no fas servir** (optimització per calor i suggeriment automàtic
d'assignacions), cosa que la farà més clara i més fàcil de mantenir.

---

## 1. Decisions tancades en aquesta sessió

Aquestes quatre decisions són fermes i guien tota la resta del pla:

1. **Treure tota la capa d'optimització tèrmica.** S'elimina la pàgina
   "optimització per calor" **i** l'ordre automàtic de zones dins les màquines (a
   instal·lacions i assignacions). L'app passa a **reflectir el que tu decideixes
   físicament**, no a proposar-te res. A instal·lacions vols veure de cop d'ull les
   **setmanes de vida** de les reproductores de cada carro.

2. **Treure del tot el suggeriment automàtic d'assignacions.** El motor proposava
   coses equivocades (la lògica programada no coincidia amb el que faries de debò).
   L'assignació passa a ser **100% manual** (arrossegar carros), però la farem
   **ràpida i claríssima**.

3. **Diferenciar bé els carros COBB dels Ross a assignacions.** Avui l'estirp només
   surt al tooltip i t'equivoques sovint. Hi posarem un distintiu visual clar
   (color + lletra R/C, per exemple). Això es fa sí o sí.

4. **Nova navegació amb dos mons separats** (detall a §3). El dia a dia deixa de
   passar obligatòriament per la vista general de càrregues.

---

## 2. Estat real dels pendents (diagnòstic verificat)

### 2.1. Seguretat ja resolta

L'auditoria (`AUDITORIA_SEGURETAT.md`) està essencialment tancada: C-1 a C-3,
I-1 a I-5 i N-1 a N-17. Verificat contra els advisors actuals de Supabase:

- **M-1 (funcions amb `search_path` mutable):** ja no apareix als advisors. Resolt.
- **M-2 (força bruta) i M-3 (logs d'auditoria):** implementats funcionalment
  (`login_attempts` i `audit_log`). Convé marcar-los com a ✅ a l'auditoria per
  coherència; el títol encara no ho reflecteix.
- **`previsio_corba` sense RLS:** era un ERROR obert (`rls_disabled_in_public`).
  **Ja l'has tancat tu** en aquesta tanda. Fet.

### 2.2. Soroll benigne als advisors (NO tocar)

Les ~27 taules amb "RLS enabled, no policy" (INFO) són el comportament **desitjat**:
RLS actiu sense policy = deny-all per a l'anon, i el backend entra per service_role.
No s'ha de fer res; queda documentat perquè no t'alarmis quan ho vegis.

### 2.3. Rendiment de BD — neteja barata (aprovada)

- **Índexs duplicats (WARN):** `audit_log` i `login_attempts` tenen cada un dos
  índexs idèntics (segurament creats dos cops a N-6). S'esborren els duplicats:
  trivial, redueix soroll i pes d'escriptura.
- **Claus foranes sense índex (INFO):** ~20 FK sense índex de cobertura. **Honest:**
  amb el volum actual l'impacte és gairebé nul; és preventiu per quan creixin les
  taules. No és urgent.

---

## 3. Nova navegació (decisió 4, desplegada)

### 3.1. El problema d'avui

Per arribar on treballes de debò fas tres navegacions completes: Inici → Càrregues
(amb spinner "Carregant...") → detall (vista general) → apartat. I el dia a dia
(estoc, recepció, expedicions) també penja d'aquesta estructura.

### 3.2. L'estructura nova: dos mons

**Món A — el diari (seccions de primer nivell, sense passar per càrrega):**
estoc, recepció de carros, expedicions i estadístiques passen a ser apartats
propis al menú principal. Hi entres directament.

**Món B — la càrrega concreta (espai amb apartats d'accés directe):**
assignació, transferència, naixement, repartiment de pollets del dia, impressions
i estadístiques de la càrrega. Hi entres **sense passar per la vista general**.

### 3.3. Com es tria la càrrega (decisió presa)

Quan entris a un apartat de càrrega (assignació, naixement…), **sempre veuràs una
llista curta de càrregues actives i en triaràs una**. Un clic de més, però mai et
porta a la càrrega equivocada. (Descartem "anar directe a la més pròxima" i "obrir
l'última en marxa" justament per evitar que l'app endevini malament.)

> Pendent menor de definir a la implementació: el criteri tècnic exacte de "càrrega
> activa" per omplir aquesta llista (p. ex. càrregues entre l'assignació i el dia del
> naixement, no finalitzades). Ho concretem quan toqui codi.

### 3.4. Millores de flux que acompanyen la navegació

- **`/carrega` (llista) passa a Server Component**, com ja vau fer al detall (N-8):
  s'elimina el spinner "Carregant...", la llista arriba ja dibuixada. La part
  interactiva (finalitzar, mostrar/amagar finalitzats) es mou a un petit Client
  Component. *Impacte percebut alt, risc baix, patró conegut.* **(aprovat)**
- **Eliminar el fetch redundant del títol al `AppLayout`:** ara el menú torna a
  demanar `/api/carrega/[id]` a cada pàgina només pel número de càrrega; es passa com
  a dada del servidor. *Petit però transversal.* **(aprovat)**
- **No tocar el prefetch de Next.js:** ja prefetcha els `<Link>` en producció. El
  coll d'ampolla és el treball de cada pàgina al servidor, no la transició.

---

## 4. Assignacions: manual, ràpida i clara (decisions 2 i 3)

### 4.1. Treure el motor de suggeriment

`lib/assignacions.ts` (~380 línies: regla sexat→Ross, qualitats A/B/C per client,
els dos fluxos de dijous SS/MS, anticipació d'estoc) era el motor de pre-suggerit.
Es retira de la interfície d'assignació. L'assignació manual (arrossegar carros) ja
funciona de manera independent, així que la base hi és.

> A decidir a la implementació: si esborrem el codi del motor del tot o el deixem
> "apagat" (sense punt d'entrada des de la UI) per si algun dia es vol recuperar.
> Recomanació: deixar-lo fora de la UI però conservar el fitxer mentre no facin nosa,
> per no perdre la feina feta. Ho confirmem al moment.

### 4.2. Distinció COBB vs Ross

A la graella d'assignació no hi ha cap senyal visual de l'estirp (només al tooltip).
S'hi afegeix un distintiu clar i constant (color de fons + lletra R/C, o equivalent)
a cada carro, perquè no t'hi puguis equivocar d'un cop d'ull.

### 4.3. Neteja de rendiment a la pàgina d'assignacions

El càlcul de previsió de cada carro (`calcularPrevisioFinal`) torna a llegir la taula
`parametres` **una vegada per carro**. Es llegeixen els paràmetres **un sol cop** i
es passen al càlcul. (La corba ja es cacheja bé en memòria; el problema és només
`parametres`.) *Impacte mesurable a la pàgina més pesada, risc baix.* **(aprovat)**

> Correcció honesta del diagnòstic inicial: la primera sospita era que el bucle de
> previsió feia moltes consultes pesades per carro. En llegir el codi, la corba està
> ben cachejada; l'única consulta repetida és la de `parametres`. L'impacte és menor
> del que pensava, però existeix i s'elimina fàcil.

---

## 5. Treure la capa tèrmica (decisió 1)

A retirar, verificat a la sessió 1:

- Pàgina/secció **"optimització per calor"** sencera.
- A **instal·lacions**: barres de "calor metabòlica", gradient de colors, "calor
  total", botó **"Rotar zones"** i el seu endpoint, i l'**ordre automàtic de
  posicions** per calor (zona central/paret/pulsator).
- A **assignacions**: qualsevol ordenació o suggeriment de posició basat en calor.

A afegir en lloc seu:

- A **instal·lacions**, mostrar les **setmanes de vida del lot** (`setmanes_lot`)
  **al chip del carro**, no només al tooltip, perquè es vegin d'un cop d'ull.

> Implicació que assumeixes i confirmes: l'app deixa de proposar zones; les posicions
> dins les màquines les decideixes tu i l'app només les reflecteix.

---

## 6. Priorització recomanada

Ordre proposat abans de començar les features noves (qualitat i producció de
reproductores/recries):

1. **Reestructuració de navegació** (§3): seccions diàries de primer nivell + accés
   directe als apartats de càrrega via llista d'actives. És el que més et canviarà el
   dia a dia. Inclou passar `/carrega` a Server Component i treure el fetch del títol.
2. **Assignacions** (§4): treure el suggeriment, afegir distinció COBB/Ross, netejar
   la lectura de `parametres`.
3. **Treure la capa tèrmica** (§5) i mostrar setmanes de vida al chip d'instal·lacions.
4. **Neteja de BD barata** (§2.3): índexs duplicats.
5. **Opcional/preventiu:** índexs de FK, quan el volum creixi.

Manteniment recurrent (viu, fora d'aquesta sessió): export manual mensual del backup
(N-15) i marcar M-1/M-2/M-3 com a ✅ a l'auditoria.

> Nota sobre l'ordre: tota la feina d'aquí són canvis de **baix risc i patró conegut**.
> Es poden fer en sessions curtes i independents. La part nova (qualitat, producció)
> queda per després, com volies.

---

## 7. Sobre el model

Aquesta fase de diagnòstic i decisió és pròpia d'Opus (model actiu). La implementació
posterior és en bona part mecànica (Server Components, distintius visuals, esborrar
codi mort), i l'auditoria recomanava Sonnet per a aquest tipus de canvi. T'ho recordaré
en obrir cada sessió d'implementació.
