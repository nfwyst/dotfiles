import { z } from 'zod';
import { EventChannels } from './types';
import type { TradingEvent } from './types';

// Build a Zod enum from the EventChannels constant values,
// preserving the literal types for proper EventChannel inference.
const channelValues = Object.values(EventChannels) as [
  typeof EventChannels[keyof typeof EventChannels],
  ...typeof EventChannels[keyof typeof EventChannels][],
];

export const TradingEventSchema = z.object({
  id: z.string(),
  channel: z.enum(channelValues),
  timestamp: z.number(),
  source: z.enum(['DataLayer', 'StrategyLayer', 'ExecutionLayer', 'System']),
  correlationId: z.string(),
  payload: z.unknown(),
});

export type ValidatedTradingEvent = z.infer<typeof TradingEventSchema>;

/**
 * Parse and validate a JSON string into a TradingEvent.
 *
 * The Zod schema validates all required BaseEvent fields including
 * channel membership against EventChannels values, so the validated
 * result is structurally compatible with TradingEvent (BaseEvent<unknown>).
 *
 * Returns null on parse failure.
 */
export function parseTradingEvent(json: string): TradingEvent | null {
  try {
    const raw: unknown = JSON.parse(json);
    const result = TradingEventSchema.safeParse(raw);
    if (result.success) {
      // The validated data satisfies BaseEvent<unknown> which is the
      // structural supertype of all TradingEvent union members.
      return result.data as TradingEvent;
    }
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
    const raw: unknown = JSON.parse(json);
    const result = DLQMessageSchema.safeParse(raw);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}
