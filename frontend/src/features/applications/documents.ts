// Verification documents an applicant may upload for previous-school
// verification. Kept in sync with the backend presign validation.
export const APPLICATION_DOCUMENT_TYPES = [
  { value: "good_moral", label: "Good Moral" },
  { value: "psa_birth_certificate", label: "PSA / Birth Certificate" },
  { value: "certificate_of_enrollment", label: "Certificate of Enrollment" },
  { value: "report_card_tor", label: "Report Card / TOR" },
  { value: "diploma", label: "Diploma" },
] as const;

export type ApplicationDocumentType =
  (typeof APPLICATION_DOCUMENT_TYPES)[number]["value"];

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

// Applicants must upload at least this many of the accepted documents.
export const MIN_REQUIRED_DOCUMENTS = 3;
