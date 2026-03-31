export class TendrilsError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TendrilsError";
  }
}

export class NotFoundError extends TendrilsError {
  constructor(entity: string, id: string) {
    super(`${entity} '${id}' not found`, "NOT_FOUND", 3, { entity, id });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends TendrilsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 4, details);
    this.name = "ConflictError";
  }
}

export class NoWorkspaceError extends TendrilsError {
  constructor(message?: string) {
    super(
      message ?? "No workspace found. Run 'td init <name>' to create one.",
      "NO_WORKSPACE",
      5,
    );
    this.name = "NoWorkspaceError";
  }
}

export class InvalidArgumentError extends TendrilsError {
  constructor(message: string) {
    super(message, "INVALID_ARGUMENT", 2);
    this.name = "InvalidArgumentError";
  }
}
