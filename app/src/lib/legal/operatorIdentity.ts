/** Default legal entity for privacy, DPA, and data protection pages. Override with ROM_OPERATOR_LEGAL_NAME. */
export const DEFAULT_OPERATOR_LEGAL_NAME = "Report-O-Matic Ltd";

export function operatorLegalName(): string {
  return process.env.ROM_OPERATOR_LEGAL_NAME?.trim() || DEFAULT_OPERATOR_LEGAL_NAME;
}

export function operatorRegisteredAddress(): string {
  const v = process.env.ROM_OPERATOR_REGISTERED_ADDRESS?.trim();
  return v || "Registered office address available on request — see contact below.";
}

export function privacyContactEmail(): string | null {
  return (
    process.env.ROM_PRIVACY_CONTACT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ||
    null
  );
}

export function icoRegistrationNumber(): string | null {
  return process.env.ROM_ICO_REGISTRATION_NUMBER?.trim() || null;
}
