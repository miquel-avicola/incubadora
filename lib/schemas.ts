/**
 * lib/schemas.ts
 *
 * Schemas zod per a la validació de totes les rutes API.
 * Referència: troballa I-3 del DOCUMENTACIO.md
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Helper ────────────────────────────────────────────────────────────────

type ParseOk<T> = { ok: true; data: T }
type ParseFail = { ok: false; response: NextResponse }
export type ParseResult<T> = ParseOk<T> | ParseFail

/**
 * Valida `raw` contra `schema`. Retorna `{ ok: true, data }` si passa,
 * o `{ ok: false, response }` amb un 400 llest per retornar si falla.
 */
export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.errors[0]
    const path = first.path.length ? `${first.path.join('.')}: ` : ''
    return {
      ok: false,
      response: NextResponse.json({ error: `${path}${first.message}` }, { status: 400 }),
    }
  }
  return { ok: true, data: result.data }
}

// ── Primitius reutilitzables ──────────────────────────────────────────────

const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de data invàlid (YYYY-MM-DD)')

const zId = z
  .number({ invalid_type_error: 'Ha de ser un nombre enter positiu' })
  .int()
  .positive()

const zIdCoerce = z.coerce.number().int().positive()

// ── Auth ──────────────────────────────────────────────────────────────────

export const AuthLoginBody = z.object({
  username: z.string().min(1, 'Usuari obligatori').max(100),
  password: z.string().min(1, 'Contrasenya obligatòria').max(200),
})

// ── Comandes ──────────────────────────────────────────────────────────────

export const ComandaGetQuery = z.object({
  pendents: z.enum(['true', 'false']).optional(),
  data: zDate.optional(),
})

export const ComandaPostBody = z.object({
  full_carrega_id: zId.nullable().optional(),
  client_id: zId,
  tipus: z.enum(['Pollets', 'Maquila'], {
    errorMap: () => ({ message: "tipus ha de ser 'Pollets' o 'Maquila'" }),
  }),
  quantitat_pollets: z.number().int().min(0).nullable().optional(),
  quantitat_ous_maquila: z.number().int().min(0).nullable().optional(),
  sexat: z.boolean().optional(),
  data_prevista_naixement: zDate.nullable().optional(),
})

export const ComandaPatchBody = z.object({
  full_carrega_id: zId.nullable().optional(),
  data_prevista_naixement: zDate.nullable().optional(),
  quantitat_pollets: z.number().int().min(0).nullable().optional(),
  quantitat_ous_maquila: z.number().int().min(0).nullable().optional(),
  sexat: z.boolean().optional(),
})

// ── Destinacions ─────────────────────────────────────────────────────────

export const DestinacionsGetQuery = z.object({
  client_id: z.coerce.number().int().positive().optional(),
})

export const DestinacioPostBody = z.object({
  nom_granja: z.string().min(1, 'nom_granja és obligatori').max(200),
  nau: z.string().max(100).nullable().optional(),
  poblacio: z.string().max(200).nullable().optional(),
  codi_rega: z.string().max(50).nullable().optional(),
  client_id: zId.nullable().optional(),
})

// ── Càrregues ─────────────────────────────────────────────────────────────

export const CarregaPostBody = z.object({
  carrega: zDate,
  transferencia: zDate.nullable().optional(),
})

export const CarregaPatchBody = z.object({
  estat: z.enum(['Planificat', 'Finalitzat']).optional(),
  observacions: z.string().max(1000).nullable().optional(),
  transferencia: zDate.nullable().optional(),
})

// ── Lots ──────────────────────────────────────────────────────────────────

export const LotPostBody = z.object({
  granja_reproductora_id: zId,
  data_naixement: zDate,
  estirp: z.string().max(50).nullable().optional(),
})

// ── Carros ────────────────────────────────────────────────────────────────

export const CarroPostBody = z.object({
  lot_id: zIdCoerce,
  posta: zDate,
  quantitat_ous: z.coerce.number().int().min(1).max(10000).optional(),
  nombre_carros: z.coerce.number().int().min(1, 'Mínim 1 carro').max(20, 'Màxim 20 carros'),
})

export const CarroDeleteBody = z.object({
  lot_id: zIdCoerce,
  posta: zDate,
  quantitat_ous: z.coerce.number().int().min(0),
})

// ── Granges reproductores ─────────────────────────────────────────────────

export const GranjaPostBody = z.object({
  granja: z.string().min(1, 'El nom de la granja és obligatori').max(200),
  nom_informal: z.string().max(200).nullable().optional(),
  marca_oficial: z.string().max(100).nullable().optional(),
  codi_rega: z.string().max(50).nullable().optional(),
  poblacio: z.string().max(200).nullable().optional(),
  titular: z.string().max(200).nullable().optional(),
})

// ── Expedicions [id] ──────────────────────────────────────────────────────

export const ExpedicioIdPatchBody = z.object({
  pollets_comanda: z.number().int().min(0).nullable().optional(),
  pollets_servits: z.number().int().min(0).nullable().optional(),
  transportista_id: zId.nullable().optional(),
  matricula: z.string().max(20).nullable().optional(),
  hora_prevista_naixement: z.string().max(20).nullable().optional(),
  hora_sortida_camio: z.string().max(20).nullable().optional(),
  hora_arribada_camio: z.string().max(20).nullable().optional(),
  ordre: z.number().int().positive().nullable().optional(),
  observacions: z.string().max(500).nullable().optional(),
  num_viatge: z.number().int().positive().nullable().optional(),
})

// ── Expedició lots ────────────────────────────────────────────────────────

export const ExpedicioLotsPostBody = z.object({
  lot_id: zId,
  pollets: z.number().int().min(0),
})

export const ExpedicioLotsDeleteBody = z.object({
  expedicio_lot_id: zId,
})

// ── Expedició vacunes ─────────────────────────────────────────────────────

export const ExpedicioVacunaBody = z.object({
  vacuna_id: zId,
})

// ── Expedicions de càrrega ────────────────────────────────────────────────

export const CarregaExpedicioPostBody = z.object({
  comanda_id: zId,
  destinacio_id: zId,
  transportista_id: zId.nullable().optional(),
  matricula: z.string().max(20).nullable().optional(),
  hora_prevista_naixement: z.string().max(20).nullable().optional(),
  pollets_comanda: z.number().int().min(0).nullable().optional(),
  observacions: z.string().max(500).nullable().optional(),
  sexe: z.enum(['M', 'F']).nullable().optional(),
  sexat: z.boolean().optional(),
  polletsM: z.number().int().min(0).nullable().optional(),
  polletsF: z.number().int().min(0).nullable().optional(),
})

export const CarregaExpedicioDeleteBody = z.object({
  expedicio_id: zId,
})

// ── Assignacions de càrrega ───────────────────────────────────────────────

export const CarregaAssignacionsPostBody = z.object({
  carro_ids: z.array(zId).min(1, 'Cal almenys un carro'),
  incubadora_id: zId,
  hora_entrada: z.string().max(20).nullable().optional(),
  previsio_naixement: z.number().min(0).max(1).nullable().optional(),
  posicions: z.array(z.number().int().positive()).optional(),
  zona: z.enum(['central', 'paret', 'pulsator']).optional(),
})

export const CarregaAssignacionsDeleteBody = z.object({
  assignacio_id: zId,
  carro_id: zId,
})

// ── Vacunes de càrrega ────────────────────────────────────────────────────

export const CarregaVacunesPostBody = z.object({
  assignacio_id: zId,
  vacuna_id: zId,
  dosi: z.string().min(1).max(100),
})

export const CarregaVacunesDeleteBody = z.object({
  assignacio_ids: z.array(zId).min(1).optional(),
  assignacio_vacuna_id: zId.optional(),
}).refine(
  d => d.assignacio_ids !== undefined || d.assignacio_vacuna_id !== undefined,
  { message: 'Cal assignacio_ids o assignacio_vacuna_id' }
)

// ── Transferència ─────────────────────────────────────────────────────────

export const TransferenciaPostBody = z.object({
  assignacio_id: zId,
  naixedora_id: zId,
  ous_explosius: z.number().int().min(0),
  ous_fertils_vacunats: z.number().int().min(1).max(4800),
})

export const TransferenciaDeleteBody = z.object({
  transferencia_id: zId,
  carro_id: zId,
})

// ── Naixement ─────────────────────────────────────────────────────────────

export const NaixementPostBody = z.object({
  carros: z
    .array(
      z.object({
        assignacio_id: zId,
        transferencia_id: zId,
        ous_fertils_vacunats: z.number().int().min(0),
      })
    )
    .min(1),
  total_pollets: z.number().int().min(0),
  sexat: z.boolean().optional(),
})

export const NaixementDeleteBody = z.object({
  transferencia_ids: z.array(zId).min(1),
})
