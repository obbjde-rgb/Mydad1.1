export const logError = (error: unknown, info?: unknown) => {
  console.error("Midad Error:", error, info);
  try {
    const raw = localStorage.getItem('midad_errors') || '[]';
    const parsed = JSON.parse(raw);
    const errors = Array.isArray(parsed) ? parsed : [];
    const errObj = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
    errors.push({
      timestamp: new Date().toISOString(),
      message: errObj.message,
      stack: errObj.stack,
      info: info ? String(info) : undefined,
    });
    if (errors.length > 50) errors.shift();
    localStorage.setItem('midad_errors', JSON.stringify(errors));
  } catch {
    // Ignore storage quota or private-mode errors inside error boundary logging
  }
};
