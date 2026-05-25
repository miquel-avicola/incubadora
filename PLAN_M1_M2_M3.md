# Pla d'implementació M-1, M-2, M-3

**Sessió de disseny:** 2026-05-25 amb Opus 4.7
**Sessió d'implementació:** pendent, amb Sonnet 4.6
**Fitxers de referència:** `DOCUMENTACIO.md` secció 8.3 (M-1, M-2, M-3)

Aquest document és el contracte d'implementació consolidat. Sonnet l'ha de llegir abans de començar i seguir l'ordre indicat. Quan acabi, ha d'actualitzar `DOCUMENTACIO.md` marcant M-1, M-2 i M-3 com a "Resolt el 2026-05-25" (o la data real).

---

## Ordre d'implementació

1. **M-1** — Refer 7 funcions BD amb `search_path` fixat
2. **P0** — Refactor del JWT per incloure `user_id` i `username`
3. **M-2** — Rate limit per IP al login
4. **M-3** — Taula `audit_log` + wrapper `withAudit` + pàgina `/admin/auditoria`
5. Actualitzar `DOCUMENTACIO.md`
6. Bloc git final per commit + push

---

## M-1 — Funcions BD amb `search_path` mutable

**Què cal fer:** recrear les 7 funcions amb `SET search_path = public, pg_temp` (o equivalent que tanqui la vulnerabilitat segons l'avisador de Supabase).

Llista de funcions afectades (DOCUMENTACIO.md secció 8.3 M-1):
- `avg_naixement_supabase`
- `rotar_zones_ms_gran`
- `avg_eclosio_supabase`
- `fulls_candidats_finalitzar`
- `estat_instalacions`
- `offset_per_dia`
- `guarda_planificacio_full`

**Com:** una migració SQL aplicada via `mcp__b39e6161-...__apply_migration` o `execute_sql`. Per a cada funció: `CREATE OR REPLACE FUNCTION ... LANGUAGE ... SET search_path = public, pg_temp AS $$ ... $$`. Mantenir el cos actual de cada funció — només cal afegir el `SET search_path`.

**Verificació:** tornar a executar `mcp__b39e6161-...__get_advisors` i confirmar que les 7 alertes han desaparegut.

---

## P0 — Refactor JWT per identificar usuaris individuals

**Per què:** sense `user_id` a la cookie, l'audit log no pot dir quin admin concret ha fet cada acció (només "un admin"). Cal abans de M-3 perquè M-3 depèn d'aquest camp.

**Fitxers a tocar:**

### `lib/auth.ts`
- `signSession(role)` → `signSession({ userId, username, role })`. El payload del JWT ha d'incloure `{ userId, username, role, iat }`.
- `verifySession(token)` → retorna `{ userId, username, role } | null` (a part de la verificació de signatura i expiració actual).
- `validateUser` ha de retornar també l'`id` i l'`username` (ara només retorna el `role`). Canviar la signatura a `Promise<{ userId: string, username: string, role: string } | null>`.

### `app/api/auth/route.ts`
- Adaptar la crida a `validateUser` i passar el resultat sencer a `signSession`.

### Tots els llocs que criden `verifySession`
- Sonnet ha de fer un grep de `verifySession(` i confirmar que els consumidors són compatibles. La resposta ara és un objecte amb 3 camps en comptes de 2 — qualsevol consumidor que faci `session.role` continua funcionant; qualsevol que necessiti `userId`/`username` ja pot accedir-hi.

### `middleware.ts`
- Si exposa el rol a través d'un header per a les rutes API (mirar el codi), ha d'exposar també `user_id` i `username` perquè el wrapper `withAudit` els pugui llegir sense haver de tornar a verificar la sessió.

**Conseqüència acceptada:** totes les sessions actives queden invalidades (la forma del payload del JWT canvia, els tokens existents no es desxifren com s'espera o no porten els camps nous). Els usuaris hauran de tornar a fer login una vegada. Documentar-ho al missatge de commit.

---

## M-2 — Rate limit per IP al login

### Decisions de disseny (sense alternatives a reobrir):
- **Identificació:** només per IP (no per usuari). Raó: evita DoS dirigit a comptes admin.
- **Llindar:** 20 fallits / 5 min → 15 min bloqueig.
- **Reset:** un login exitós reseteja el comptador de la IP.
- **Resposta al bloqueig:** HTTP 429 amb `Retry-After` (en segons) i missatge `"Massa intents. Torna a provar d'aquí a uns 15 minuts"`. El bloqueig es comprova **abans d'executar bcrypt**.
- **Tecnologia:** Supabase Postgres (no Upstash).

### Migració SQL

```sql
CREATE TABLE login_attempts (
  id            bigserial primary key,
  ip            text not null,
  attempted_at  timestamptz not null default now(),
  success       boolean not null
);
CREATE INDEX login_attempts_ip_ts_idx ON login_attempts (ip, attempted_at DESC);
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- Cap policy: deny-all per defecte. service_role hi accedeix bypassant RLS.
```

### Lògica a `app/api/auth/route.ts`

Pseudocodi del POST:

```
1. Llegir IP: const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
2. Validar body (com ara).
3. Comptar fallits recents:
   SELECT count(*) FROM login_attempts
   WHERE ip = $1
     AND success = false
     AND attempted_at > NOW() - INTERVAL '5 minutes'
     AND attempted_at > COALESCE(
       (SELECT MAX(attempted_at) FROM login_attempts WHERE ip = $1 AND success = true),
       'epoch'::timestamptz
     )
4. Si count >= 20:
   - Calcular Retry-After aproximat (15 * 60 segons, o més precís si volem).
   - Inserir l'intent com a fallit (perquè l'atac quedi registrat):
     INSERT INTO login_attempts (ip, success) VALUES ($1, false)
   - Retornar 429 amb header Retry-After i missatge català.
5. Cridar validateUser (bcrypt). Si OK → role, userId, username.
6. INSERT del resultat (success = true o false segons bcrypt).
7. Si success = true: signSession amb userId+username+role, posar cookie com ara.
8. Si success = false: retornar 401 com ara.
```

### Neteja
- Afegir un `DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours' LIMIT 100` amortitzat (per exemple, executat amb probabilitat 1/50 a cada petició) per evitar que la taula creixi indefinidament.
- Alternativa més neta: una funció + cron job a Supabase (`pg_cron`). Si Sonnet veu que el projecte ja té `pg_cron` instal·lat, usar aquesta via.

### Verificació manual proposada (sense automatitzar)
1. Fer 21 intents fallits seguits des de la mateixa IP → el 21è hauria de retornar 429.
2. Esperar 15 min i provar de nou → ha de tornar a funcionar.
3. Fer 5 fallits + 1 OK → comptador reseteja, següents 19 fallits no bloquegen.

---

## M-3 — Audit log

### Decisions de disseny:
- **Abast:** només mutacions (POST, PATCH, DELETE, PUT). No GET.
- **Camps:** vegeu schema sota.
- **Wrapper:** `withAudit(handler)` aplicat manualment a cada ruta mutativa.
- **Payload:** JSON del body, amb redacció de claus sensibles i truncament a 5 KB.
- **Retenció:** sense límit per ara. Si la taula passa de 100k files, ja decidirem.
- **Visualització:** pàgina `/admin/auditoria` només per a rol `admin`, amb filtres.

### Migració SQL

```sql
CREATE TABLE audit_log (
  id            uuid primary key default gen_random_uuid(),
  ts            timestamptz not null default now(),
  user_id       uuid references users(id) on delete set null,
  username      text,                            -- desnormalitzat: si esborrem l'usuari, mantenim el nom
  role          text not null,
  ip            text,
  method        text not null,                   -- POST / PATCH / DELETE / PUT
  path          text not null,
  payload       jsonb,                            -- body redactat
  status_code   int
);
CREATE INDEX audit_log_user_ts_idx ON audit_log (user_id, ts DESC);
CREATE INDEX audit_log_ts_idx ON audit_log (ts DESC);
CREATE INDEX audit_log_path_ts_idx ON audit_log (path, ts DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Cap policy: service_role hi escriu via bypass.
```

### Wrapper `withAudit`

Crear `lib/audit.ts` amb:

```ts
const REDACT_KEYS = new Set(['password', 'password_hash', 'token', 'secret', 'authorization'])
const MAX_PAYLOAD_BYTES = 5 * 1024 // 5 KB

function redact(obj: unknown): unknown {
  // recorre l'objecte recursivament; substitueix valors de claus de REDACT_KEYS per '[REDACTED]'
}

function truncatePayload(obj: unknown): unknown {
  const json = JSON.stringify(obj)
  if (json.length <= MAX_PAYLOAD_BYTES) return obj
  return { _truncated: true, _bytes: json.length, preview: json.slice(0, MAX_PAYLOAD_BYTES) }
}

export function withAudit(
  handler: (req: Request, ctx: { session: { userId: string, username: string, role: string } }) => Promise<Response>
) {
  return async (req: Request, ctx: any) => {
    const session = await getSessionFromCookie(req) // helper que combina cookie + verifySession
    if (!session) return new NextResponse(... 401 ...)

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
    const method = req.method
    const path = new URL(req.url).pathname

    let bodyClone: unknown = null
    try {
      bodyClone = await req.clone().json()
    } catch { /* body buit o no JSON */ }

    const response = await handler(req, { session })

    // Insertem en segon pla per no bloquejar la resposta
    insertAuditRow({
      user_id: session.userId,
      username: session.username,
      role: session.role,
      ip,
      method,
      path,
      payload: bodyClone ? truncatePayload(redact(bodyClone)) : null,
      status_code: response.status,
    }).catch(err => console.error('audit log insert failed', err))

    return response
  }
}
```

### Aplicació a les rutes API mutatives

Sonnet ha de fer:
1. `grep -rn "export async function (POST|PATCH|DELETE|PUT)" app/api/` per llistar totes les rutes mutatives.
2. A cadascuna, envoltar el handler amb `withAudit(...)`.
3. Excepcions a documentar al codi: `/api/auth` POST (login) NO porta `withAudit` (no hi ha sessió encara — això es registra via `login_attempts`). `/api/auth` DELETE (logout) sí.

### Pàgina `/admin/auditoria`

- Ruta nova `app/admin/auditoria/page.tsx`.
- Renderitza una taula de les últimes N entrades amb filtres:
  - Per usuari (select amb llista d'usuaris actius)
  - Rang de dates
  - Per `path` (input text amb LIKE)
- Reservada a rol `admin` (afegir-la a `canAccess` com a admin-only).
- Paginació simple (per defecte últims 50, botó "carregar més").
- Endpoint nou `app/api/admin/auditoria/route.ts` GET que retorna les entrades. També envoltat amb `withAudit` (sí, l'audit s'audita ell mateix).

---

## Actualitzar `DOCUMENTACIO.md`

Al final, marcar a la secció 8.3:
- **M-1**: afegir `**Resolt el 2026-05-25:** 7 funcions recreades amb \`SET search_path = public, pg_temp\`. Verificat amb get_advisors.`
- **M-2**: afegir `**Resolt el 2026-05-25:** rate limit per IP (20 fallits/5 min → 15 min bloqueig) implementat a /api/auth amb taula login_attempts.`
- **M-3**: afegir `**Resolt el 2026-05-25:** taula audit_log + wrapper withAudit aplicat a totes les rutes mutatives. Pàgina /admin/auditoria per a consulta. Pre-requisit P0 resolt: JWT inclou user_id i username.`

També, a la secció d'arquitectura/BD, afegir les dues taules noves (`login_attempts`, `audit_log`).

També, a la secció d'autenticació (post bloc seguretat), actualitzar la descripció del JWT per reflectir els camps nous (`userId`, `username`, `role`).

---

## Notes per a Sonnet

- Tots els canvis al codi: usar Read abans d'Edit per evitar el desync bash/Windows en TSX grans (vegeu memòria `feedback_bash_windows_desync`).
- Project ID de Supabase: `uhslwgcjdiwycknvaplr` (vegeu memòria `reference_supabase`).
- Al final, escriure el bloc git literal en PowerShell per a l'Enric (vegeu memòria `feedback_git_block`).
- Si trobes algun cas dubtós durant la implementació que requereixi una decisió de disseny no contemplada aquí, **para i pregunta a l'Enric** abans de decidir per compte propi.
