export class ApiError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 400,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
