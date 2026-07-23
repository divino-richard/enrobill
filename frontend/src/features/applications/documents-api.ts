import axios from "axios";
import api from "@/lib/api";
import type { ApplicationDocumentType, UploadedDocument } from "./documents";

interface PresignResponse {
  key: string;
  url: string;
  headers: Record<string, string | string[]>;
}

/**
 * Upload a single verification document directly to S3 using the pre-signed
 * URL strategy: ask the API for a short-lived signed URL, then PUT the file
 * straight to the bucket so it never passes through the Laravel server.
 */
export async function uploadApplicationDocument(
  type: ApplicationDocumentType,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedDocument> {
  const { data } = await api.post<PresignResponse>(
    "/applications/documents/presign",
    { type, content_type: file.type, size: file.size },
  );

  // PUT to S3 with a bare axios call (not the app `api` instance) so our Bearer
  // token isn't leaked to the bucket. The Content-Type must match what the
  // backend signed, or S3 rejects the request.
  await axios.put(data.url, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return {
    type,
    key: data.key,
    fileName: file.name,
    size: file.size,
    contentType: file.type,
  };
}

// Attach a supporting document the applicant promised but didn't upload with
// their application.
export async function submitOutstandingDocument(
  applicationId: number,
  type: ApplicationDocumentType,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const uploaded = await uploadApplicationDocument(type, file, onProgress);
  await api.post(`/applications/${applicationId}/documents`, {
    type: uploaded.type,
    key: uploaded.key,
    file_name: uploaded.fileName,
    size: uploaded.size,
    content_type: uploaded.contentType,
  });
}

// Remove a supporting document already attached to an application, freeing the
// slot so a corrected file can be uploaded in its place.
export async function deleteApplicationDocument(
  applicationId: number,
  documentId: number,
): Promise<void> {
  await api.delete(`/applications/${applicationId}/documents/${documentId}`);
}

// Discard a file uploaded during the wizard but never attached to an
// application, so removing it doesn't leave the object orphaned in the bucket.
export async function deleteUnattachedDocument(key: string): Promise<void> {
  await api.delete("/applications/documents", { data: { key } });
}

export interface DocumentViewUrl {
  url: string;
  fileName: string;
  contentType: string | null;
}

// Fetch a short-lived URL to view a previously uploaded document.
export async function fetchDocumentViewUrl(
  applicationId: number,
  documentId: number,
): Promise<DocumentViewUrl> {
  const { data } = await api.get<DocumentViewUrl>(
    `/applications/${applicationId}/documents/${documentId}`,
  );
  return data;
}

// Stream a document's raw bytes through the API (same-origin, authenticated) so
// the SPA can download or print it without the S3 bucket allowing CORS reads.
export async function fetchDocumentBlob(
  applicationId: number,
  documentId: number,
): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `/applications/${applicationId}/documents/${documentId}/download`,
    { responseType: "blob" },
  );
  return data;
}
