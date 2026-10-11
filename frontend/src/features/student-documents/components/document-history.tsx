import { useState } from 'react';
import { FileTextIcon, FolderOpenIcon, CircleAlertIcon } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentViewerDialog } from '@/components/document-viewer-dialog';
import { useMyDocuments } from '../hooks';
import { fetchStudentDocumentBlob, fetchStudentDocumentViewUrl } from '../api';
import { documentTypeLabel, semesterLabel, type StudentDocument } from '../types';

export function DocumentHistory() {
  const query = useMyDocuments(true);
  const [viewing, setViewing] = useState<StudentDocument | null>(null);
  return (
    <section aria-label="Saved documents">
      <Card className="shadow-none [--card-spacing:--spacing(5)]">
        <CardHeader className="border-b">
          <CardTitle><h2>Saved documents</h2></CardTitle>
          <CardDescription>Clearance and grade slips from your enrollment records.</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? <div role="status" aria-label="Loading saved documents"><Skeleton className="h-32" /></div>
            : query.isError ? <div role="alert"><EmptyState icon={CircleAlertIcon} title="Documents unavailable" description="We couldn’t load your saved documents. Please try again."
              action={<Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>Try again</Button>} /></div>
            : !query.data?.length ? <EmptyState icon={FolderOpenIcon} title="No saved documents yet" description="Uploaded clearance and grade slips will be available here for reference." />
            : <ul className="divide-y">{query.data.map(document => (
              <li className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0" key={document.id}>
                <FileTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{document.fileName}</p>
                  <p className="text-xs text-muted-foreground">{document.schoolYear ? `SY ${document.schoolYear} · ` : ''}{semesterLabel(document.semester)} · {documentTypeLabel(document.type)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewing(document)}>View</Button>
              </li>
            ))}</ul>}
        </CardContent>
      </Card>
      <DocumentViewerDialog document={viewing} onOpenChange={open => {if (!open) setViewing(null);}} queryKey={['student-document-history', viewing?.id]} fetchUrl={fetchStudentDocumentViewUrl} fetchBlob={fetchStudentDocumentBlob} />
    </section>
  );
}
