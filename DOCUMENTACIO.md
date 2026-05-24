# Documentació de l'aplicació Miquel Avícola Incubadora

> Document escrit per a l'Enric (veterinari, no informàtic).
> Última actualització: 23 de maig de 2026.
> Font de veritat: aquest fitxer viu al repositori del projecte i s'actualitza a mesura que l'app canvia.

---

## Taula de continguts

1. [Què és aquesta aplicació](#1-què-és-aquesta-aplicació)
2. [Stack tècnic explicat planerament](#2-stack-tècnic-explicat-planerament)
3. [Arquitectura general: com encaixen les peces](#3-arquitectura-general-com-encaixen-les-peces)
4. [Estructura del codi](#4-estructura-del-codi)
5. [La base de dades](#5-la-base-de-dades)
6. [Funcionalitats principals](#6-funcionalitats-principals)
7. [Com funciona la seguretat](#7-com-funciona-la-seguretat)
8. [Auditoria de seguretat: troballes (23 maig 2026)](#8-auditoria-de-seguretat-troballes-23-maig-2026)
9. [Pròximes passes](#9-pròximes-passes)

---

## 1. Què és aquesta aplicació

L'aplicació gestiona el dia a dia d'una incubadora de polls per a Miquel Avícola. La feina típica és: arriben caixes (carros) d'ous de granges reproductores, s'incuben en màquines durant uns 18 dies, es transfereixen a "naixedores" on acaben d'eclosionar, i quan han nascut els polls s'expedeixen a granges de recria.

L'app dóna eines per a tot aquest cicle: registrar l'estoc de carros que arriben, planificar quins carros van a quina màquina, anar fent el seguiment de la previsió de naixement, registrar el que s'ha nascut realment, i preparar les expedicions cap als clients.

L'usuari principal ara mateix ets tu, l'Enric. La fan servir tres tipus de persones (rols) amb permisos diferents: recepció (gent que registra carros d'ous), càrregues (gent que planifica) i admin (tu i qui ho controla tot).

L'app viu a Vercel (un servei que la serveix per internet) i la base de dades viu a Supabase (un servei de PostgreSQL gestionat). Quan algú fa canvis al codi i el puja a GitHub, Vercel redesplega automàticament la versió nova en pocs segons. URL pública: `miquel-avicola-incubadora.vercel.app`.

---

## 2. Stack tècnic explicat planerament

Pensa en el "stack" com els ingredients amb què està construïda l'app. Aquí els tens:

**Next.js 14** — És el motor de l'app. Decideix com es generen les pàgines, com es gestiona la navegació, com es protegeix l'accés (a través d'un fitxer especial anomenat *middleware*) i serveix tant les pàgines com les "rutes API" (camins que retornen dades en lloc de pàgines). La versió 14 fa servir el sistema "App Router" — això vol dir que cada carpeta dins de `/app` correspon a una URL del web.

**React 18** — És la llibreria que dibuixa les pantalles dins del navegador. Cada pantalla és un "component" (una peça reutilitzable de codi). Quan l'usuari clica un botó i quelcom canvia, React s'encarrega de redibuixar només la part que ha canviat.

**TypeScript** — És una variant de JavaScript que afegeix "tipus" (números, textos, estructures). Això vol dir que abans que el codi s'executi, una eina comprova que estàs passant les coses correctes. Si esperes un número i passes un text, et salta error abans no es publiqui. Redueix bugs.

**Tailwind CSS** — És una manera d'aplicar estils (colors, mides, espais) escrivint classes directament al codi en lloc de tenir fitxers CSS apart. Cosa de comoditat per al desenvolupador.

**Supabase** — És la base de dades. Per dins és un PostgreSQL (un dels gestors de base de dades més robustos i veterans del món). Supabase hi afegeix una capa que permet llegir i escriure des de l'app sense haver d'escriure SQL directament a les rutes habituals — la pròpia llibreria genera les consultes per nosaltres.

**@supabase/supabase-js** — La llibreria que parla amb Supabase des de l'app.

**@react-pdf/renderer** — Permet generar PDFs (per exemple, les etiquetes de càrrega 90×90 mm i les de pollets 50×50 mm, o els fulls d'estadístiques per càrrega).

**Vercel** — Servei que hostatja l'app i la fa accessible per internet. Cada vegada que es puja codi nou a la branca `main` de GitHub, Vercel ho recull, ho compila i ho publica automàticament.

**GitHub** — Servei on viu el codi font. Funciona com una "memòria històrica": tot canvi queda enregistrat amb un comentari (commit) i sempre es pot tornar enrere.

---

## 3. Arquitectura general: com encaixen les peces

Imagina'l així. Quan obres `miquel-avicola-incubadora.vercel.app` al navegador, passa això:

Primer, Vercel rep la teva petició. Abans de servir res, el **middleware** (un guardia a l'entrada) mira si la teva cookie de sessió és vàlida. Si no ho és, et redirigeix a `/login`. Si ho és, mira també si el teu rol té permís per veure aquesta URL concreta. Si no té permís, et porta a la pàgina d'inici.

Un cop has passat el guardia, Next.js decideix què servir-te. Si demanes una pàgina, mira a la carpeta `/app/...` i genera l'HTML corresponent. Si demanes una "ruta API" (per exemple, "dona'm la llista de comandes"), mira a `/app/api/...`, executa el codi de servidor, parla amb Supabase per anar a buscar les dades, i et retorna JSON.

La pàgina, ja al navegador, s'omple amb el codi React. Si l'usuari interactua (clica, omple un formulari), React pot tornar a parlar amb una ruta API per fer la modificació.

Tota la comunicació amb Supabase passa exclusivament per les rutes API del servidor — el navegador mai parla directament amb la base de dades. Això és important per la seguretat (en parlem més avall).

---

## 4. Estructura del codi

La carpeta del projecte és `C:\Users\Usuari\Documents\miquel-avicola`. Dins hi ha:

**`/app`** — Tot el que veu l'usuari (pàgines) i totes les rutes API (servidor).
- `/app/page.tsx` — La pàgina d'inici.
- `/app/login/` — Pàgina de login.
- `/app/estoc/` — Estoc de carros.
- `/app/carrega/[id]/` — Detall d'una càrrega (les pàgines de planificació, assignacions, expedicions, estadístiques, etc.).
- `/app/instalacions/` — Vista de les màquines.
- `/app/lots/` — Lots de reproductores.
- `/app/previsio-comercial/` — Vista comercial de previsions.
- `/app/api/` — Totes les rutes que el navegador crida per llegir o modificar dades. Hi ha una subcarpeta per cada "recurs" (comandes, destinacions, carros, lots, etc.).
- `/app/components/` — Peces reutilitzables (botons, capçaleres...).

**`/lib`** — Codi compartit per tota l'app. Aquí viu la lògica important:
- `auth.ts` — Validació d'usuaris, signatura i verificació de sessions, regles de permisos per rol.
- `supabase.ts` — Crea la connexió amb la base de dades (només UNA línia: instancia el client de Supabase amb les credencials).
- `eclosio.ts` — Càlcul de previsió d'eclosió (cascada de 5 nivells: dades post-tall, dades exactes per setmanes de vida, finestra mòbil, etc.).
- `termico.ts` — Càlcul de la calor embrionària per carro, per suggerir on col·locar-los dins les màquines multistage.
- `previsio.ts` — Càlculs per a la previsió comercial.
- `dates.ts` — Utilitats per a treballar amb dates.

**`/middleware.ts`** — El "guardia a l'entrada". S'executa abans de cada petició i fa el control d'accés.

**`/next.config.js`** — Configuració del motor Next.js (ara mateix buit).

**`/package.json`** — Llista de llibreries que fa servir l'app.

**`/.env.example`** — Exemple de quines variables d'entorn (claus secretes) calen perquè l'app funcioni. Les reals viuen a Vercel (no al repositori).

---

## 5. La base de dades

La base de dades és el cor de l'app: tota la informació viu aquí. Està a Supabase, project ID `uhslwgcjdiwycknvaplr`, regió `eu-west-1`. Per dins és PostgreSQL.

Les **taules principals** (amb una explicació planera del que guarden):

**`carros_estoc`** — Cada fila és un carro físic que ha arribat de granja. Camps clau: `lot_id` (de quina posta i granja ve), `posta` (número de posta), `quantitat_ous` (normalment 4800 o 2400), `estat` (a estoc, dins màquina...), `recepcio` (data d'arribada), `entrada_incubadora` (quan ha entrat a màquina).

**`lots_reproductores`** — Cada fila és un "lot" de reproductores: una posta concreta d'una granja concreta amb una edat concreta. Camps: `estirp` (Ross, Cobb, etc.), `data_naixement` de les reproductores.

**`granges_reproductores`** — Llistat de granges que ens venen ous. Camps: `granja`, `nom_informal`.

**`incubadores`** — Les màquines incubadores. Camps: `numero`, `model`, `tipus` (Singlestage o Multistage), `capacitat_carros`.

**`naixedores`** — Les màquines on els ous acaben d'eclosionar (els últims 3 dies).

**`fulls_carrega`** — Cada fila és una "càrrega": l'acte d'omplir incubadores amb un grup de carros en una data concreta. Camps: `num_carrega`, `carrega` (data), `transferencia` (data de transferència a naixedora), `estat`.

**`assignacions`** — La taula més important per al dia a dia. Cada fila diu: aquest carro va a aquesta màquina, en aquesta posició, en aquesta càrrega. Camps: `full_carrega_id`, `carro_id`, `incubadora_id`, `num_carro_full` (numeració dins la càrrega), `posicio` (per a Singlestage), `zona` (central / paret / pulsator, per a Multistage), `previsio_naixement` (taxa esperada de 0 a 1), `previsio_manual` (booleà: si la previsió s'ha entrat a mà o s'ha calculat), `hora_entrada`.

**`transferencies`** — Cada fila és la transferència d'un carro a una naixedora, amb el nombre d'ous fèrtils vacunats i d'ous explosius detectats.

**`resultats_naix`** — Quants polls van nèixer realment per cada transferència, i quants es van descartar.

**`comandes`** — Encàrrecs dels clients. Camps: `client_id`, `tipus`, `quantitat_pollets`, `quantitat_ous_maquila`, `sexat` (booleà), `data_prevista_naixement`. Una comanda pot estar enganxada a una càrrega o no (`full_carrega_id` pot ser null = comanda anticipada sense càrrega assignada).

**`clients`** — Els clients comercials.

**`destinacions`** — Granges de destinació (on van els polls). Camps: `nom_granja`, `nau`, `poblacio`, `client_id`, `codi_rega`, `adreca`, `telefon`, `observacions`, `sexe`.

**`expedicions`** — Cada fila és un viatge: quins carros han sortit, cap a quines destinacions, amb quin transportista.

**`expedicio_lots`** — Detall de quins lots de polls van a cada expedició.

**`transportistes`** — Llistat de transportistes.

**`vacunes`** — Catàleg de vacunes.

**`assignacio_vacunes`** i **`expedicio_vacunes`** — Quines vacunes s'apliquen a quina assignació o expedició.

**`granges_recria`** i **`lots_granges_recria`** — Granges de destinació final i lots associats.

**`previsio_referencia`** — Dades de referència per a previsions.

**`previsio_recurrent`** — Previsions periòdiques.

**`parametres`** — Configuració de l'app guardada com a parelles clau/valor (per exemple: `eclosio_fallback`, `data_tall_inovo`, `finestra_mobil_setmanes`, `minim_registres_finestra`).

**`eclosio_historic`** — Històric d'eclosió importat d'Excel: `estirp`, `tipus_incubadora`, `setmanes_vida`, `eclosio`.

Les **funcions** de la base de dades (codi SQL guardat dins de la pròpia base que fa càlculs) inclouen: `avg_naixement_supabase`, `avg_eclosio_supabase`, `rotar_zones_ms_gran`, `fulls_candidats_finalitzar`, `estat_instalacions`, `offset_per_dia`, `guarda_planificacio_full`.

---

## 6. Funcionalitats principals

A grans trets, l'app permet:

**Estoc i recepció** — Registrar l'arribada de carros amb ous, per lot, posta i granja. Veure què hi ha disponible a l'estoc en qualsevol moment.

**Planificació de càrregues** — Crear una càrrega nova, triar quins carros hi van, i a quina màquina i posició. Per a màquines Singlestage hi ha una graella de posicions; per a Multistage es treballa per zones (central / paret / pulsator). Hi ha algorismes de suggeriment automàtic (per agrupar lots consecutius i per optimitzar la calor entre zones).

**Comandes** — Registrar comandes de clients, fins i tot anticipadament sense càrrega assignada. Tipus: pollets vius o ous de maquila. Sexat o no.

**Transferència i naixement** — Quan toca, transferir els carros a naixedora i registrar quants ous fèrtils vacunats hi van i quants n'hi havia d'explosius. Després, registrar quants polls han nascut i quants s'han descartat.

**Previsions** — En tres etapes: previsió inicial (entrada a màquina), previsió post-transferència, i resultat real. Hi ha una vista de "Evolució de la previsió" agrupada per (lot + tipus d'incubadora).

**Expedicions** — Generar les expedicions: triar les destinacions (granges), distribuir els carros entre els viatges, escollir transportista, registrar vacunes aplicades. Permet expedicions sexades (mascles i femelles separats).

**Etiquetes i PDFs** — Generar etiquetes de càrrega (90×90 mm) i de pollets (50×50 mm), i fulls d'estadístiques per càrrega.

**Vista comercial** — Una pantalla amb la previsió comercial per veure el flux esperat de polls per dates.

**Capa tèrmica visual** — A `/instal·lacions` es pot activar una "capa de calor" que mostra quant de mW genera cada carro segons els seus dies d'incubació, per detectar zones que escalfin més.

---

## 7. Com funciona la seguretat

Aquí va una explicació del **com està muntada la seguretat actualment**. La meva valoració crítica de què està bé i què està malament la trobaràs a la secció 8.

### 7.1. Autenticació (qui ets)

Quan algú entra a l'app, ha de passar per `/login`. Allà introdueix usuari i contrasenya. El servidor compara amb una llista d'usuaris **hardcoded al fitxer `lib/auth.ts`** (és a dir, els usuaris i les contrasenyes estan escrits literalment dins del codi).

Si el parell usuari/contrasenya quadra, el servidor genera un "token de sessió". Aquest token és una cadena de text amb dues parts separades per un punt: la primera és un JSON codificat en base64 que conté el rol i el moment de creació, i la segona és una signatura HMAC-SHA256 que prova que el servidor ha generat aquell token (i que ningú l'ha modificat). La clau secreta per signar és la variable d'entorn `AUTH_SECRET`.

El token es guarda al navegador com una cookie anomenada `session`, amb opcions: `httpOnly` (el JavaScript del navegador no la pot llegir — protegeix contra robatori per scripts injectats), `sameSite: 'lax'` (no s'envia en peticions creuades de tercers — protecció bàsica contra CSRF), i `maxAge` de 7 dies.

A cada petició posterior, el middleware:
1. Llegeix la cookie `session`.
2. Si no n'hi ha, redirigeix a `/login`.
3. Si n'hi ha, verifica la signatura HMAC. Si no quadra, esborra la cookie i redirigeix a `/login`.
4. Si quadra, extreu el `role` del payload i continua.

### 7.2. Autorització (què pots fer)

Hi ha tres rols, definits a `lib/auth.ts`:

| Rol | Què pot accedir |
|------|------------------|
| `recepcio` | Pàgina inicial (`/`), `/recepcio`, `/estoc`, i totes les rutes API excepte la d'assignacions |
| `carregues` | Tot excepte: lots, creació de càrrega nova, assignacions, vacunes |
| `admin` | Tot |

La funció `canAccess(role, path)` és la que decideix, basada en expressions regulars que matchen rutes concretes.

### 7.3. Connexió amb la base de dades

A `lib/supabase.ts` es crea el client de Supabase amb la **service_role_key**. Aquesta és la clau de més privilegi de Supabase: **bypassa totes les polítiques de Row Level Security (RLS)** i pot llegir i modificar qualsevol fila de qualsevol taula sense restriccions.

Per tant, tota la seguretat sobre què es pot llegir i modificar **depèn 100% de:**
1. El middleware (que filtra per rol abans d'arribar a la ruta API).
2. La lògica de cada ruta API (que ha de validar inputs i comportar-se bé).

Si algun dels dos falla, no hi ha cap segona línia de defensa: la base de dades obeirà.

### 7.4. Variables d'entorn

Les claus secretes (`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`) viuen a la configuració de Vercel, no al repositori. El fitxer `.env.example` només té els noms i un exemple. El `.gitignore` exclou `.env` i `.env.local` per evitar pujar-les a GitHub per error.

### 7.5. HTTPS i certificats

Vercel serveix tot per HTTPS amb certificat automàtic. No cal configurar res manualment.

---

## 8. Auditoria de seguretat: troballes (23 maig 2026)

Aquesta secció és el resultat del diagnòstic. He inspeccionat el codi d'autenticació, el middleware, una mostra representativa de les rutes API, la configuració de Next.js, i les polítiques RLS i avisos de seguretat directament a Supabase. Els problemes estan ordenats per gravetat. Per a cadascun explico **què és**, **per què importa**, **què caldria fer**, i **amb quin model de Claude convé fer-ho**.

### Convenció de models

Cada troballa porta una etiqueta amb el model recomanat:

- **[Sonnet 4.6]** — Tasca rutinària: edits localitzats, migracions SQL senzilles, canvis de configuració, validacions. Sonnet és més ràpid i barat i la qualitat és pràcticament la mateixa que Opus per a aquestes feines.
- **[Opus 4.7]** — Tasca amb decisions de disseny: trade-offs arquitectònics, canvis difícils de revertir, raonament que requereix veure conseqüències subtils. Val la pena el plus de cost.
- **[Mixt]** — Comença amb Opus per a decidir el plantejament i passa a Sonnet per a la implementació. La majoria de troballes complexes són d'aquest tipus.

Si Claude es desperta en una sessió i veu que estàs en un model que no toca per a la tasca que vols atacar, t'avisarà al principi de la conversa: *"Ep, abans de començar: això s'hauria de fer amb [model X], per què..."*

### 8.1. CRÍTIC

#### C-1. Contrasenyes en text pla dins del codi font ✅ Resolt el 2026-05-24

**Model recomanat: [Mixt]** — Primer Opus per decidir entre Supabase Auth i taula d'usuaris pròpia amb bcrypt (decisió arquitectònica important, té conseqüències a llarg termini). Després Sonnet per a la implementació un cop el camí està clar.

**Resolució:** Taula `users` creada a Supabase amb RLS deny-all. Contrasenyes hashades amb bcrypt cost 12 via `bcryptjs`. `validateUser` ara és async i consulta la BD via service role key. Passphrases de 4 paraules en català assignades als 3 usuaris.

**Què és:** A `lib/auth.ts` (línies 3–7) hi ha tres parelles usuari/contrasenya literalment escrites al codi. Qualsevol que tingui accés al repositori (o a un dump del repositori) veu les contrasenyes.

**Per què importa:** Si en algun moment el repositori es fa públic accidentalment, si un col·laborador surt de l'empresa i conserva el clon local, o si algú accedeix al teu ordinador, té les claus de tots els usuaris. A més, les contrasenyes són curtes i poc resistents (`ous`, `pollet`, `pollet1234`): un atac de força bruta les trobaria en segons.

**Què caldria fer:** Moure els usuaris a una taula de la base de dades amb la contrasenya guardada com a hash (per exemple, bcrypt amb cost 12). La validació compararia el hash, no la cadena. A més, exigir contrasenyes més llargues. Alternativa més robusta: passar a Supabase Auth, que ja ho gestiona tot (signup, reset, MFA) i s'integra natiu amb la BD.

#### C-2. Fallback insegur del secret de signatura de sessions ✅ Resolt el 2026-05-24

**Model recomanat: [Sonnet 4.6]** — Canvi d'una sola línia, sense decisions de disseny. Perfecte per a Sonnet.

**Resolució:** Eliminat el fallback. `AUTH_SECRET` ara és obligatori — si no existeix, l'app fa crash amb missatge clar. Secret de 64 caràcters hex afegit a Vercel (Sensitive) i al `.env.local` local.

**Què és:** A `lib/auth.ts` línia 1: `const SECRET = process.env.AUTH_SECRET || 'miquel-avicola-secret-2024'`. Si la variable `AUTH_SECRET` no està definida a l'entorn, l'app fa servir un valor per defecte que està al codi públic.

**Per què importa:** Si per qualsevol motiu la variable d'entorn de Vercel s'esborra, es perd, o l'app es desplega en un altre lloc (per exemple, vista prèvia d'un branch), el secret cau al fallback. Qui conegui el codi pot llavors generar sessions vàlides amb qualsevol rol (incloent admin) i entrar com si fos administrador, sense necessitat de cap contrasenya.

**Què caldria fer:** Eliminar el fallback. Si `process.env.AUTH_SECRET` és undefined, l'app hauria de fer crash a l'inici amb un missatge clar — és preferible que no arrenqui a què arrenqui amb una clau coneguda.

#### C-3. Tres taules sense Row Level Security i exposades públicament ✅ Resolt el 2026-05-24

**Model recomanat: [Sonnet 4.6]** — Migració SQL curta a Supabase (activar RLS amb `ALTER TABLE`). Operació estàndard.

**Resolució:** RLS activat a `parametres`, `eclosio_historic` i `previsio_recurrent` via migració. Cap codi trencat perquè tot el backend usa service_role key que bypassa RLS.

**Què és:** Les taules `parametres`, `eclosio_historic` i `previsio_recurrent` tenen el RLS desactivat segons l'avisador de Supabase. Com que Supabase exposa totes les taules `public` a través de PostgREST, qualsevol que tingui la URL del projecte (que és pública: `uhslwgcjdiwycknvaplr.supabase.co`) i la `anon_key` (la pot obtenir qualsevol amb accés al dashboard de Supabase) pot llegir o modificar aquestes taules sense passar per la teva app.

**Per què importa:** Tot i que ara mateix l'app no exposa l'`anon_key` al client (només fa servir la `service_role` al servidor), si en algun moment necessites afegir-la (per exemple, per fer query directa des del front), aquestes tres taules quedarien obertes. A més, qualsevol persona amb accés temporal al projecte de Supabase pot manipular aquestes dades.

**Què caldria fer:** Activar RLS a les tres taules i crear una política que NEGUI accés per defecte (no cal cap política d'accés, perquè la teva app fa servir `service_role` que bypassa RLS de tota manera). Així, la doble línia de defensa queda restaurada.

### 8.2. IMPORTANT

#### I-1. Sense expiració efectiva de sessió al servidor ✅ Resolt el 2026-05-24

**Model recomanat: [Sonnet 4.6]** — Afegir el check d'expiració a `verifySession` és directe.

**Resolució:** `verifySession` ara comprova que el token no té més de 7 dies. Si `Date.now() - iat > 7 dies`, retorna null i la sessió queda invalidada. Si decidim afegir taula de revocació, llavors **[Mixt]**: Opus per al disseny de la revocació, Sonnet per a la implementació.

**Què és:** La cookie té `maxAge` de 7 dies, però aquest valor només viu al navegador. La funció `verifySession` a `lib/auth.ts` NO comprova quant temps fa que es va signar el token. Si algú captura el token i el conserva, val per sempre. La data de signatura (`iat`) està al payload però mai es valida.

**Per què importa:** Si un token surt fora del navegador (per logs, per algú que copia la cookie, per una vulnerabilitat futura), pot reutilitzar-se indefinidament. Tampoc hi ha manera d'invalidar sessions actives — el logout només esborra la cookie del navegador, no marca el token com a revocat.

**Què caldria fer:** Afegir a `verifySession` un check del tipus `if (Date.now() - payload.iat > 7 * 24 * 60 * 60 * 1000) return null`. Opcionalment, mantenir una taula de revocacions per als casos d'emergència.

#### I-2. Permís excessivament ampli a les rutes API per al rol `recepcio` ✅ Resolt el 2026-05-24

**Model recomanat: [Mixt]** — Redissenyar `canAccess` com a llista blanca requereix decidir quins endpoints té cada rol (decisió de negoci + de seguretat, fàcil d'errar). Opus per al disseny del mapa rol→endpoints, Sonnet per a la implementació.

**Resolució:** `canAccess` per a `recepcio` convertit a llista blanca explícita. Permet: `/` + `/recepcio/*` + `/estoc/*` + `/api/carros/*` (GET/POST/DELETE) + `/api/previsio-comercial` (GET, sense `/cell`). Tot el que no hi és queda bloquejat per defecte.

**Què és:** A `canAccess`, el rol `recepcio` té accés a `/api/*` excepte la d'assignacions. Això vol dir que un usuari de recepció pot fer POST a `/api/comandes`, `/api/destinacions`, `/api/granges`, `/api/expedicions/*`, `/api/lots`, etc.

**Per què importa:** Si la teva intenció és que recepció només toqui carros i estoc, té permís per fer molt més. Pot crear comandes, modificar destinacions, fer expedicions. Cal confirmar si això és voluntari (potser sí — has de decidir-ho tu).

**Què caldria fer:** Definir explícitament una llista blanca d'endpoints API per a cada rol, en lloc d'una llista negra. Per exemple, recepció només pot accedir a `/api/carros/*` i `/api/estoc/*`, i la resta queda bloquejat per defecte.

#### I-3. Inputs sense validació estricta a les rutes API

**Model recomanat: [Sonnet 4.6]** — Tediós però mecànic: per a cada ruta API, definir un schema `zod` que descrigui què s'espera. Sonnet ho fa bé i ràpid. Si fem revisió final de qualitat, una passada amb Opus pot detectar casos límit que s'hagin escapat.

**Què és:** A les rutes API mirades (per exemple, `app/api/comandes/route.ts` i `app/api/destinacions/route.ts`), els camps del body es passen directament a `.insert()` de Supabase sense validar tipus, longitud, ni format. PostgreSQL acaba fent de filtre de tipus, però abans hi ha temps per generar errors, omplir la base de dades amb dades brutes o explotar comportaments inesperats.

A `app/api/destinacions/route.ts` línia 14 hi ha una construcció particularment delicada: `query.or(\`client_id.eq.${client_id},client_id.is.null\`)` on `client_id` ve directament del query string sense validar. Tot i que la sintaxi de PostgREST limita l'impacte, és un patró arriscat — convindria validar abans que `client_id` és un UUID o un nombre.

**Per què importa:** Combinació de risc d'integritat de dades (camps amb formats inesperats, longituds excessives) i risc menor d'injecció a través de filtres PostgREST. Tampoc hi ha límit de mida del body — un atacant podria intentar saturar la base de dades amb peticions enormes.

**Què caldria fer:** Introduir validació amb una llibreria com `zod` a cada ruta API. Definir el schema esperat del body i refusar amb 400 si no compleix. Per a paràmetres de query, validar tipus (és nombre? és UUID?) abans de passar-los a la consulta.

#### I-4. Cap header de seguretat configurat ✅ Resolt el 2026-05-24

**Model recomanat: [Mixt]** — Decidir la Content Security Policy correcta requereix saber quines fonts externes carrega l'app (fonts tipogràfiques, CDNs, imatges, etc.). Una CSP massa estricta trenca l'app, una massa laxa no protegeix. Opus per a dissenyar la CSP. Sonnet per a la configuració de la resta de headers (HSTS, X-Frame-Options, etc.), que són boilerplate.

**Resolució:** Reescrit `next.config.js` amb `async headers()` aplicats a `source: '/(.*)'`. Headers configurats: HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (càmera, micròfon, geolocalització, pagament i USB denegats), i CSP amb `default-src 'self'`, `'unsafe-inline'` i `'unsafe-eval'` per scripts/styles (necessari per Next 14 HMR i React), `connect-src` amb Supabase HTTPS+WSS, `img-src` amb `data:` i `blob:` per a PDFs, `worker-src blob:` per `@react-pdf/renderer`, i `frame-ancestors 'none'`. Les fonts IBM Plex s'han migrat de Google Fonts a auto-hostatjades via `next/font/google` per complir el `font-src 'self'`.

**Què és:** `next.config.js` estava buit. No hi havia CSP (Content Security Policy), HSTS forçat, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.

**Per què importa:** Aquests headers són la defensa estàndard contra XSS (scripts injectats), clickjacking (incrustar la teva pàgina en un iframe d'una web maliciosa), MIME sniffing, etc. Vercel posa alguns headers per defecte però no tots.

**Què caldria fer:** Configurar headers de seguretat a `next.config.js` mitjançant `async headers()`. Una CSP raonable per a aquesta app seria força restrictiva, ja que tot el JavaScript ve del propi domini.

#### I-5. Cookie de sessió sense `secure: true` ✅ Resolt el 2026-05-24

**Model recomanat: [Sonnet 4.6]** — Canvi d'una línia.

**Resolució:** Afegit `secure: process.env.NODE_ENV === 'production'` a la cookie. En producció (Vercel) sempre s'envia per HTTPS; en local amb `npm run dev` no s'exigeix per no trencar el desenvolupament.

**Què és:** A `app/api/auth/route.ts` línies 12-17, la cookie es crea amb `httpOnly: true, sameSite: 'lax'` però **no** té `secure: true`. Això vol dir que en teoria es podria enviar per HTTP.

**Per què importa:** A Vercel sempre serveix HTTPS, per tant en producció no hi ha exposició real. Però si algun dia provem l'app en local amb HTTP, o algú la desplega en un altre entorn sense TLS, la cookie viatjaria en clar.

**Què caldria fer:** Afegir `secure: process.env.NODE_ENV === 'production'` (o senzillament `secure: true` si confirmem que sempre serveix HTTPS).

### 8.3. MILLORA (no urgent)

#### M-1. Funcions de BD amb `search_path` mutable

**Model recomanat: [Sonnet 4.6]** — Recrear 7 funcions amb el `search_path` fixat. Tasca de manteniment SQL.

**Què és:** L'avisador de Supabase apunta 7 funcions (`avg_naixement_supabase`, `rotar_zones_ms_gran`, `avg_eclosio_supabase`, `fulls_candidats_finalitzar`, `estat_instalacions`, `offset_per_dia`, `guarda_planificacio_full`) que no tenen el `search_path` fixat.

**Per què importa:** En un atac molt específic, algú amb permisos limitats podria crear taules ombrejades en un altre schema i fer que la funció els consulti. Risc baix en aquesta app perquè només service_role té permisos d'execució, però és bona pràctica fixar-lo.

**Què caldria fer:** Recrear cada funció amb `SET search_path = public, pg_temp` o equivalent.

#### M-2. Sense protecció contra força bruta al login

**Model recomanat: [Mixt]** — Decidir l'estratègia (rate limit per IP? per usuari? amb Upstash? amb una taula a Supabase?) té trade-offs. Opus per a la decisió. Sonnet per a la implementació.

**Què és:** L'endpoint `/api/auth` accepta peticions sense límit. Un atacant pot provar milers de contrasenyes per minut.

**Per què importa:** Combinat amb contrasenyes febles (C-1), un atacant podria endevinar-les ràpidament. Risc reduït ara per ara perquè l'app és poc coneguda, però real.

**Què caldria fer:** Afegir rate limiting per IP a la ruta de login (per exemple, amb la integració d'Upstash Redis a Vercel o amb la primitiva `next/server` `unstable_after`). Bloquejar després de N intents fallits.

#### M-3. Sense logs d'auditoria

**Model recomanat: [Mixt]** — Disseny de la taula d'audit_log i del wrapper que la pobli a cada petició: Opus. Aplicar-ho a totes les rutes: Sonnet.

**Què és:** No queda enregistrament de qui fa cada acció. Si algú esborra una comanda o modifica una assignació, no sabem quin usuari ha estat.

**Per què importa:** En una app interna de gestió, saber qui ha fet què és útil tant per a debugging com per a investigar incidents.

**Què caldria fer:** Afegir una taula `audit_log` amb (timestamp, role, path, method, payload_resumit, ip) i un wrapper al servidor que la pobli a cada petició mutativa.

#### M-4. Dependències sense auditoria recent

**Model recomanat: [Sonnet 4.6]** — Tasca operacional: executar `npm audit`, llegir resultats, decidir actualitzacions menors. Si hi ha actualitzacions majors (canvis de versió de Next.js, per exemple) que poden trencar coses, **[Opus 4.7]** per valorar l'impacte.

**Què és:** No s'ha executat `npm audit` recentment. Les versions actuals (`next 14.1.0`, `@supabase/supabase-js 2.39.0`, `@react-pdf/renderer 4.5.1`, `react 18`) tenen uns mesos.

**Per què importa:** Les llibreries acumulen vulnerabilitats descobertes que es corregeixen amb actualitzacions. Estar al dia és una pràctica de manteniment bàsica.

**Què caldria fer:** Executar `npm audit` i `npm outdated` periòdicament des de l'ordinador local (he intentat fer-ho des d'aquí però el sandbox no té accés al registre npm). Si hi ha avisos, valorar quins són explotables a la pràctica i actualitzar les llibreries afectades. Next 14 ha tingut CVEs publicades durant 2024 (per exemple sobre Server Actions); convé confirmar si la 14.1.0 està afectada abans de decidir si urgeix l'actualització.

#### M-5. Anon key de Supabase mai s'ha rotat

**Model recomanat: [Sonnet 4.6]** — Rotar claus al dashboard de Supabase i actualitzar variables d'entorn a Vercel. Operacional.

**Què és:** No tinc constància que s'hagi rotat la `service_role_key` des de la creació del projecte.

**Per què importa:** Si en algun moment la clau ha quedat exposada (per error, en un log, en un screenshot...), continua sent vàlida indefinidament fins que algú la roti.

**Què caldria fer:** Rotar `SUPABASE_SERVICE_ROLE_KEY` i `AUTH_SECRET` periòdicament (per exemple, anualment), i sempre que hi hagi sospita d'exposició.

---

## 9. Pròximes passes

Aquest document és el punt de partida. La idea és:

1. **Decidir quins problemes ataquem primer.** La meva recomanació és fer C-1, C-2 i C-3 com a primer bloc (són els crítics i no són massa feina si abordem un per un).
2. **Per a cada arreglament**, fer una sessió separada: explicar què canviem, fer-ho, provar-ho, i actualitzar aquest document amb el canvi.
3. **Quan acabem la seguretat**, passar al bloc de rendiment, i finalment al visual.

A mesura que canviem coses, aquest document s'ha d'anar actualitzant. Mai ha de quedar desfasat — si una troballa es resol, marquem-la com a "Resolt el AAAA-MM-DD" en lloc d'esborrar-la, per tenir l'historial.
