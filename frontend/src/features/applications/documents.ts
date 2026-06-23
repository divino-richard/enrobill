// Verification documents an applicant may upload for previous-school
// verification. Kept in sync with the backend presign validation. Required
// documents must be uploaded to submit — unless the applicant provides a
// promissory note with an estimated date to comply (see documents below).
export const APPLICATION_DOCUMENT_TYPES = [
  { value: "good_moral", label: "Good Moral", isRequired: true },
  {
    value: "psa_birth_certificate",
    label: "PSA / Birth Certificate",
    isRequired: false,
  },
  {
    value: "certificate_of_enrollment",
    label: "Certificate of Enrollment",
    isRequired: false,
  },
  { value: "report_card_tor", label: "Report Card / TOR", isRequired: true },
  { value: "diploma", label: "Diploma", isRequired: true },
] as const;

export type ApplicationDocumentType =
  (typeof APPLICATION_DOCUMENT_TYPES)[number]["value"];

// The document types an applicant must always upload — these can never be
// substituted with a promissory note.
export const REQUIRED_DOCUMENT_TYPES: ApplicationDocumentType[] =
  APPLICATION_DOCUMENT_TYPES.filter((doc) => doc.isRequired).map(
    (doc) => doc.value,
  );

// Supporting documents. The applicant uploads these, or commits to providing
// them later via a promissory note.
export const OPTIONAL_DOCUMENT_TYPES: ApplicationDocumentType[] =
  APPLICATION_DOCUMENT_TYPES.filter((doc) => !doc.isRequired).map(
    (doc) => doc.value,
  );

// A document successfully uploaded to S3. The `key` is the object key returned
// by the presign endpoint; that's what gets submitted with the application.
// `id` is only present for documents already persisted with an application.
export interface UploadedDocument {
  id?: number;
  type: ApplicationDocumentType;
  key: string;
  fileName: string;
  size: number;
  contentType: string;
}

// Accepted upload formats (must match the backend's allow-list).
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

// `accept` attribute for the file input.
export const ACCEPTED_DOCUMENT_ACCEPT = ".jpg,.jpeg,.png,.pdf";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

// The required document types still missing from the uploaded set.
export function missingRequiredDocuments(
  documents: Pick<UploadedDocument, "type">[],
): ApplicationDocumentType[] {
  const uploaded = new Set(documents.map((doc) => doc.type));
  return REQUIRED_DOCUMENT_TYPES.filter((type) => !uploaded.has(type));
}

// The supporting (optional) document types still missing — a promissory note is
// required to cover these.
export function missingOptionalDocuments(
  documents: Pick<UploadedDocument, "type">[],
): ApplicationDocumentType[] {
  const uploaded = new Set(documents.map((doc) => doc.type));
  return OPTIONAL_DOCUMENT_TYPES.filter((type) => !uploaded.has(type));
}
