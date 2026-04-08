import { z } from 'zod';

export const TradingEventSchema = z.object({
  id: z.string(),
  channel: z.string(),
  timestamp: z.number(),
  source: z.enum(['DataLayer', 'StrategyLayer', 'ExecutionLayer', 'System']),
  correlationId: z.string(),
  payload: z.unknown(),
});

export type ValidatedTradingEvent = z.infer<typeof TradingEventSchema>;

/**
 * 安全解析 JSON 为 TradingEvent，失败返回 null
 */
export function parseTradingEvent(json: string): ValidatedTradingEvent | null {
  try {
    const raw = JSON.parse(json);
    const result = TradingEventSchema.safeParse(raw);
    if (result.success) return result.data;
    console.warn('[EventValidation] Invalid event:', result.error.issues);
    return null;
  } catch {
    return null;
  }
}

// DLQ Message schema
export const DLQMessageSchema = z.object({
  originalEvent: TradingEventSchema.optional(),
  error: z.string().optional(),
  channel: z.string().optional(),
  failedAt: z.number().optional(),
  retryCount: z.number().optional(),
});

export type ValidatedDLQMessage = z.infer<typeof DLQMessageSchema>;

export function parseDLQMessage(json: string): ValidatedDLQMessage | null {
  try {
    const raw = JSON.parse(json);
    const result = DLQMessageSchema.safeParse(raw);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}
