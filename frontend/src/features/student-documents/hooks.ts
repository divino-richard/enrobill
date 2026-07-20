import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMyDocuments, uploadMyDocument } from "./api";
import type { Semester, StudentDocumentType } from "./types";

export const myDocumentsQueryKey = ["me", "documents"] as const;

// The student's own clearance / grade slips for the active school year.
export function useMyDocuments() {
  return useQuery({
    queryKey: myDocumentsQueryKey,
    queryFn: fetchMyDocuments,
  });
}

// Upload (or replace) one semester/type slot.
export function useUploadMyDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      semester,
      type,
      file,
      onProgress,
    }: {
      semester: Semester;
      type: StudentDocumentType;
      file: File;
      onProgress?: (percent: number) => void;
    }) => uploadMyDocument(semester, type, file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myDocumentsQueryKey });
    },
  });
}
