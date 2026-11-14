const redactHeaders = (headers?: HeadersInit) => {
  if (!headers) return undefined;
  const result: Record<string, string> = {};
  const entries = headers instanceof Headers
    ? Array.from(headers.entries())
    : Array.isArray(headers)
      ? headers
      : Object.entries(headers);
  for (const [k, v] of entries) {
    const lower = k.toLowerCase();
    result[k] = (lower.includes('auth') || lower.includes('key') || lower.includes('token') || lower.includes('secret'))
      ? '[REDACTED]'
      : String(v);
  }
  return result;
};

export const logNetworkRequest = (url: string, options: RequestInit, label: string) => {
  console.log(`[Diagnostic] ${label} Request:`, {
    url,
    method: options.method || 'GET',
    headers: redactHeaders(options.headers),
    timestamp: new Date().toISOString()
  });
};

export const logNetworkResponse = (url: string, response: Response, label: string) => {
  console.log(`[Diagnostic] ${label} Response for ${url}:`, {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    timestamp: new Date().toISOString()
  });
};

export const logNetworkError = (url: string, error: any, label: string) => {
  const errorMessage = error?.message || (typeof error === 'string' ? error : (error ? String(error) : 'Unknown Error'));
  console.error(`[Diagnostic] ${label} Error for ${url}:`, {
    error: errorMessage,
    timestamp: new Date().toISOString()
  });
};
