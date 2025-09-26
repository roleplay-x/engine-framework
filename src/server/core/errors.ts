export class GamemodeServerError extends Error {
  public readonly key: string;
  public readonly params: Record<string, string>;
  public readonly statusCode: number;

  constructor(key: string, params: Record<string, string>, statusCode: number, message?: string) {
    super(message);
    this.key = key;
    this.name = key;
    this.params = params;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class UnauthorizedError extends GamemodeServerError {
  constructor(key: string, params: Record<string, string>, message?: string) {
    super(key, params, 401, message);
  }
}

export class ForbiddenError extends GamemodeServerError {
  constructor(key: string, params: Record<string, string>, message?: string) {
    super(key, params, 403, message);
  }
}

export class NotFoundError extends GamemodeServerError {
  constructor(key: string, params: Record<string, string>, message?: string) {
    super(key, params, 404, message);
  }
}

export class ConflictError extends GamemodeServerError {
  constructor(key: string, params: Record<string, string>, message?: string) {
    super(key, params, 409, message);
  }
}
