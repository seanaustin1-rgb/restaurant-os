export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      teamOnly?: boolean;
    };
  }
}
