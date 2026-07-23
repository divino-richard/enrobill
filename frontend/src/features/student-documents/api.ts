import axios from "axios";
import api from "@/lib/api";
import type { Semester, StudentDocument, StudentDocumentType } from "./types";

interface Wrapped<T> {
  data: T;
}

interface PresignResponse {
  key: string;
  url: string;
  headers: Record<string, string | string[]>;
}

// The authenticated student's uploaded documents for the active school year.
export async function fetchMyDocuments(): Promise<StudentDocument[]> {
  const { data } = await api.get<Wrapped<StudentDocument[]>>("/me/documents");
  return data.data;
}

/**
 * Upload one document straight to S3 via a pre-signed URL, then record it against
 * its semester/type slot. Same strategy as application documents: the file never
 * passes through the API.
 */
export async function uploadMyDocument(
  semester: Semester,
  type: StudentDocumentType,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<StudentDocument> {
  const { data: signed } = await api.post<PresignResponse>(
    "/me/documents/presign",
    { semester, type, content_type: file.type, size: file.size },
  );

  // Bare axios (not the app instance) so our Bearer token isn't sent to S3. The
  // Content-Type must match what the backend signed or S3 rejects the PUT.
  await axios.put(signed.url, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const { data } = await api.post<Wrapped<StudentDocument>>("/me/documents", {
    semester,
    type,
    key: signed.key,
    file_name: file.name,
    size: file.size,
    content_type: file.type,
  });

  return data.data;
}

// Remove one of the student's own documents, freeing the slot. The stored file
// is deleted server-side too.
export async function deleteMyDocument(documentId: number): Promise<void> {
  await api.delete(`/me/documents/${documentId}`);
}

export interface DocumentViewUrl {
  url: string;
  fileName: string;
  contentType: string | null;
}

// A short-lived URL to view a document — usable by its owner or an admin.
export async function fetchStudentDocumentViewUrl(
  documentId: number,
): Promise<DocumentViewUrl> {
  const { data } = await api.get<DocumentViewUrl>(
    `/student-documents/${documentId}`,
  );
  return data;
}

// The raw bytes, streamed through our own API. The signed S3 URL is cross-origin
// and unreadable by JS, so the viewer's download and print actions need this.
export async function fetchStudentDocumentBlob(
  documentId: number,
): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `/student-documents/${documentId}/download`,
    { responseType: "blob" },
  );
  return data;
}
