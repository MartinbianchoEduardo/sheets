// Centralised error codes. Use these everywhere; never bare-string throw new
// Error("...") in API paths. Values are stable wire strings that the frontend
// may pattern-match against.

export const ERR = {
  unauthorized: 'unauthorized',
  bootstrap_invalid: 'bootstrap_invalid',
  missing_fields: 'missing_fields',
  verification_failed: 'verification_failed',
  unknown_credential: 'unknown_credential',

  validation_failed: 'validation_failed',
  not_found: 'not_found',
  server_not_configured: 'server_not_configured',

  category_invalid: 'category_invalid',
  fatura_not_found: 'fatura_not_found',
  duplicate_fatura_name: 'duplicate_fatura_name',

  csv_parse_failed: 'csv_parse_failed',
};
