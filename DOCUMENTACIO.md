# Documentació de l'aplicació Miquel Avícola Incubadora

> Document escrit per a l'Enric (veterinari, no informàtic).
> Última actualització: 31 de maig de 2026.
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
8. [Seguretat: estat i historial](#8-seguretat-estat-i-historial)

> L'historial complet de les auditories de seguretat viu a `AUDITORIA_SEGURETAT.md`.

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
- `eclosio.ts` — Càlcul de l'**eclosió** (= pollets nascuts / ous fèrtils vacunats; mètrica de diagnòstic). Cascada de 5 nivells: dades post-tall, dades exactes per setmanes de vida, finestra mòbil, etc.
- `termico.ts` — Càlcul de la calor embrionària per carro, per suggerir on col·locar-los dins les màquines multistage.
- `previsio.ts` — Càlcul del **naixement** (= pollets nascuts / ous totals del carro; aquesta és la xifra que mana per a l'assignació). ⚠️ **Redisseny acordat 2026-05-31 (vegeu `REGLES_ASSIGNACIO.md` §8), pendent d'implementar:** la previsió ha d'anar només per estirp + edat + tipus de màquina (sense l'ajust/`delta` per lot, que les dades no avalen) i donar la sortida en pollets/carro. Mentre no s'implementi, el codi actual manté la cascada + el `delta` desactivat.
- `dates.ts` — Utilitats per a treballar amb dates.

**`/middleware.ts`** — El "guardia a l'entrada". S'executa abans de cada petició i fa el control d'accés.

**`/next.config.js`** — Configuració del motor Next.js (ara mateix buit).

**`/package.json`** — Llista de llibreries que fa servir l'app.

**`/.env.example`** — Exemple de quines variables d'entorn (claus secretes) calen perquè l'app funcioni. Les reals viuen a Vercel (no al repositori).

---

## 5. La base de dades

La base de dades és el cor de l'app: tota la informació viu aquí. Està a Supabase, project ID `uhslwgcjdiwycknvaplr`, regió `eu-west-1`. Per dins és PostgreSQL.

Les **taules principals** (amb una explicació planera del que guarden):

**`carros_estoc`** — Cada fila és un carro físic que ha arribat de granja. Camps clau: `lot_id` (de quina posta i granja ve), `posta` (número de posta), `quantitat_ous` (normalment 4800 o 2400), `estat` (a estoc, dins màquina...), `recepcio` (data d'arribada), `entrada_incubadora` (quan ha entrat a màquina), `client_maquila_id` (NULL = carro de pollets; si té valor, és maquila d'aquell client — afegit 2026-05-29, vegeu REGLES_ASSIGNACIO.md §2.1).

**`lots_reproductores`** — Cada fila és un "lot" de reproductores: una posta concreta d'una granja concreta amb una edat concreta. Camps: `estirp` (Ross, Cobb, etc.), `data_naixement` de les reproductores.

**`granges_reproductores`** — Llistat de granges que ens venen ous. Camps: `granja`, `nom_informal`.

**`incubadores`** — Les màquines incubadores. Camps: `numero`, `model`, `tipus` (Singlestage o Multistage), `capacitat_carros`.

**`naixedores`** — Les màquines on els ous acaben d'eclosionar (els últims 3 dies).

**`fulls_carrega`** — Cada fila és una "càrrega": l'acte d'omplir incubadores amb un grup de carros en una data concreta. Camps: `num_carrega`, `carrega` (data), `transferencia` (data de transferència a naixedora), `estat`.

**`assignacions`** — La taula més important per al dia a dia. Cada fila diu: aquest carro va a aquesta màquina, en aquesta posició, en aquesta càrrega. Camps: `full_carrega_id`, `carro_id`, `incubadora_id`, `num_carro_full` (numeració dins la càrrega), `posicio` (per a Singlestage), `zona` (central / paret / pulsator, per a Multistage), `previsio_naixement` (taxa esperada de 0 a 1), `previsio_manual` (booleà: si la previsió s'ha entrat a mà o s'ha calculat), `hora_entrada`.

**`transferencies`** — Cada fila és la transferència d'un carro a una naixedora, amb el nombre d'ous fèrtils vacunats i d'ous explosius detectats.

**`resultats_naix`** — Quants polls van nèixer realment per cada transferència, i quants es van descartar.

**`comandes`** — Encàrrecs dels clients. Camps: `client_id`, `tipus`, `quantitat_pollets`, `quantitat_ous_maquila`, `sexat` (booleà), `data_prevista_naixement`. Una comanda pot estar enganxada a una càrrega o no (`full_carrega_id` pot ser null = comanda anticipada sense càrrega assignada).

**`clients`** — Els clients comercials. Camp `ordre_carrega` (smallint NULL, afegit 2026-05-29): ordre de càrrega del camió (més baix = carrega abans = primeres incubadores); s'usa per al repartiment automàtic per client. Vegeu REGLES_ASSIGNACIO.md §2.9.

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

**`previsio_corba`** — Corba de previsió de naixement per `estirp` + `tipus_incubadora` + `setmanes` (24-66): `naixement_pct` (forma de l'Excel suavitzada) i `font` (excel/extrapolat/+bonusSS). Pilar de la previsió nova (2026-05-31, vegeu REGLES_ASSIGNACIO.md §8). El nivell s'ajusta amb el paràmetre `previsio_offset_nivell` i la planificació conservadora amb `previsio_marge_seguretat`.

**`login_attempts`** *(afegida 2026-05-25)* — Registre d'intents de login per IP per a la protecció contra força bruta. Camps: `id`, `ip`, `attempted_at`, `success`. RLS deny-all (accedida via service_role). Neteja automàtica amortitzada d'entrades de més de 24 hores.

**`audit_log`** *(afegida 2026-05-25)* — Registre d'accions mutatives de cada usuari. Camps: `id` (uuid), `ts`, `user_id` (FK → users, set null si s'esborra l'usuari), `username` (desnormalitzat), `role`, `ip`, `method`, `path`, `payload` (jsonb redactat i truncat a 5KB), `status_code`. RLS deny-all. Consultable a `/admin/auditoria`.

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

Si el parell usuari/contrasenya quadra, el servidor genera un "token de sessió". Aquest token és una cadena de text amb dues parts separades per un punt: la primera és un JSON codificat en base64 que conté `userId`, `username`, `role` i el moment de creació (`iat`), i la segona és una signatura HMAC-SHA256 que prova que el servidor ha generat aquell token (i que ningú l'ha modificat). La clau secreta per signar és la variable d'entorn `AUTH_SECRET`. *(Actualitzat 2026-05-25: el payload inclou `userId` i `username` per al registre d'auditoria. Tokens antics (sense aquests camps) queden automàticament invalidats.)*

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

## 8. Seguretat: estat i historial

L'app ha passat dues auditories de seguretat (23 i 27 de maig de 2026). **Totes les troballes crítiques i importants estan resoltes**: contrasenyes a la BD amb bcrypt, RLS a totes les taules, expiració de sessió, validació d'inputs amb Zod, headers de seguretat amb CSP per nonce, rate-limit anti força bruta, logs d'auditoria i índexs. L'única acció periòdica pendent és l'export manual mensual del backup de Supabase (vegeu N-15 a l'arxiu).

El detall complet de cada troballa (què era, per què importava, com es va resoldre i amb quin model) viu a **`AUDITORIA_SEGURETAT.md`**, per no inflar aquest document. Quan es resol o apareix una troballa nova, s'actualitza allà.
