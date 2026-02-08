export interface EndpointCallLog {
  endpointId: string;
  endpointName: string;
  url: string;
  latencyMs: number;
  costUsd: number;
  success: boolean;
  error?: string;
}

export function logEndpointCall(entry: EndpointCallLog): void {
  const status = entry.success ? "OK" : "FAIL";
  const errorSuffix = entry.error ? ` | error=${entry.error}` : "";
  console.log(
    `[x402] ${status} | endpoint=${entry.endpointId} | latency=${entry.latencyMs}ms | cost=$${entry.costUsd}${errorSuffix}`
  );
}

export function logInfo(message: string): void {
  console.log(`[parallax] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const errorStr = error instanceof Error ? error.message : String(error ?? "");
  console.error(`[parallax] ERROR: ${message}${errorStr ? ` — ${errorStr}` : ""}`);
}
