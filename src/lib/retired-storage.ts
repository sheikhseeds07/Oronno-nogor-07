// Keep the existing clients' fetch/Auth behavior; do not synthesize 410 errors.
export function retiredStorageResponse(_input: RequestInfo | URL): Response | null {
  return null;
}
