/** Error de API con status HTTP. Vive aparte para que access.ts y server.ts no se importen en círculo. */
export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
