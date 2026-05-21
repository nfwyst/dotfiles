const PREFIX: string = '[opencode-reporter-plugin]';

type ErrorSink = (message: string) => void;

const sinks: Set<ErrorSink> = new Set();

export function logError(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
  for (const sink of sinks) {
    try {
      sink(message);
    } catch {
      // sinks must never throw back into the producer
    }
  }
}

/**
 * Register an additional error sink (e.g. JSONL debug logger). Returns an
 * unregister function. We deliberately keep this in a tiny, dependency-free
 * module so any layer can subscribe without creating an import cycle.
 */
export function registerErrorSink(sink: ErrorSink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}
