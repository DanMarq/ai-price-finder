import { z } from "zod"

export const enrichedGroupSchema = z.object({
  canonicalTitle: z.string().min(1),
  brand: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  matchedOfferIndexes: z.array(z.number().int().nonnegative()),
  rankScore: z.number(),
})

export const enrichmentResultSchema = z.object({
  groups: z.array(enrichedGroupSchema),
})

export type EnrichedGroup = z.infer<typeof enrichedGroupSchema>
export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>

export const groundingOfferSchema = z.object({
  storeName: z.string().min(1),
  title: z.string().min(1),
  price: z.number().positive(),
  productUrl: z.string().url(),
  shippingCost: z.number().nullable().optional(),
  availability: z.enum(["IN_STOCK", "OUT_OF_STOCK", "UNKNOWN"]).optional(),
})

export const groundingResultSchema = z.object({
  offers: z.array(groundingOfferSchema),
})

export type GroundingOffer = z.infer<typeof groundingOfferSchema>

export const searchRefinementSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(5),
})

export type SearchRefinement = z.infer<typeof searchRefinementSchema>

export const productInsightSchema = z.object({
  tip: z.string().min(1),
  priceAssessment: z.enum(["GOOD_DEAL", "TYPICAL", "ABOVE_AVERAGE", "INSUFFICIENT_DATA"]),
  // Null quando não há specs pra comentar (produto sem ficha técnica coletada).
  specHighlight: z.string().min(1).nullable().default(null),
})

export type ProductInsight = z.infer<typeof productInsightSchema>
