/** Default legal entity for privacy, DPA, terms, and data protection pages. Override via ROM_* env vars. */

export const DEFAULT_OPERATOR_LEGAL_NAME = "Report-O-Matic Ltd";

export const DEFAULT_COMPANY_NUMBER = "17239610";

export const DEFAULT_REGISTERED_OFFICE =
  "33 Vange Hill Drive, Basildon, Essex, England, SS16 4DD";

export const DEFAULT_TRADING_ADDRESS =
  "Entre Ríos 13, Hacienda Teresa, Espartinas, Sevilla, 41807, Spain";

export const DEFAULT_JURISDICTION = "England and Wales";

/** Public contact addresses (override in Vercel: ROM_PRIVACY_CONTACT_EMAIL, ROM_SUPPORT_EMAIL). */
export const DEFAULT_PRIVACY_EMAIL = "privacy@report-o-matic.online";

export const DEFAULT_SUPPORT_EMAIL = "support@report-o-matic.online";

export function operatorLegalName(): string {
  return process.env.ROM_OPERATOR_LEGAL_NAME?.trim() || DEFAULT_OPERATOR_LEGAL_NAME;
}

export function operatorCompanyNumber(): string {
  return process.env.ROM_OPERATOR_COMPANY_NUMBER?.trim() || DEFAULT_COMPANY_NUMBER;
}

export function operatorRegisteredAddress(): string {
  return process.env.ROM_OPERATOR_REGISTERED_ADDRESS?.trim() || DEFAULT_REGISTERED_OFFICE;
}

export function operatorTradingAddress(): string {
  return process.env.ROM_OPERATOR_TRADING_ADDRESS?.trim() || DEFAULT_TRADING_ADDRESS;
}

export function operatorJurisdiction(): string {
  return process.env.ROM_OPERATOR_JURISDICTION?.trim() || DEFAULT_JURISDICTION;
}

export function privacyContactEmail(): string {
  return (
    process.env.ROM_PRIVACY_CONTACT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
    DEFAULT_PRIVACY_EMAIL
  );
}

export function supportContactEmail(): string {
  return process.env.ROM_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}

export function icoRegistrationNumber(): string | null {
  return process.env.ROM_ICO_REGISTRATION_NUMBER?.trim() || null;
}
