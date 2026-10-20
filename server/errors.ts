// Errors the storage layer raises for conditions the API reports with a specific status.

/** Registration used an email address that already has an account (HTTP 409). */
export class EmailInUseError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "EmailInUseError";
  }
}
