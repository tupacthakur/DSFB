export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof SyntaxError) {
    return new ApiError(400, 'INVALID_JSON', 'Invalid JSON payload');
  }
  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error');
}
