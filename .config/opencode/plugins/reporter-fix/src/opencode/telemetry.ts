import {
  createTelemetryRecordBuilder,
  type AcceptedChange,
  type BuildTelemetryRecordsWithSourceInput,
} from '../shared/telemetry.ts';
import type { TelemetryRecord } from '../shared/reporter.ts';

export const TELEMETRY_SOURCE: string = 'opencode';

export type BuildTelemetryRecordsInput = BuildTelemetryRecordsWithSourceInput;

export const buildTelemetryRecords: (input: BuildTelemetryRecordsInput) => TelemetryRecord[] =
  createTelemetryRecordBuilder({
    source: TELEMETRY_SOURCE,
  });

export type { AcceptedChange, TelemetryRecord };
