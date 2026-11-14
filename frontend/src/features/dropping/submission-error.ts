import axios from 'axios';
import { getErrorMessage } from '@/lib/get-error-message';

const fallback = 'Your dropping request could not be submitted. Check your reason and documents, then try again. If this continues, contact the school for help.';
const documentFields: Record<string, string> = { name: 'name', mime: 'type', size: 'size', key: 'upload reference' };

function submissionMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const message = value.trim();
  if (!message || message === 'The given data was invalid.'
    || /^Request failed with status code \d+/i.test(message)
    || /<[^>]+>|PHP (?:Warning|Notice|Fatal error|Parse error|Request Startup)/i.test(message)) return;

  if (/failed to upload|upload failed/i.test(message)) {
    return 'One of your documents could not be uploaded. Please try again. If this continues, contact the school for help.';
  }

  return message
    .replace(/\b(?:The )?files\.(\d+)(?:\.(name|mime|size|key))?(?: field)?\b/gi, (_, index: string, field?: string) =>
      `Document ${Number(index) + 1}${field ? ` ${documentFields[field.toLowerCase()]}` : ''}`)
    .replace(/\benrollmentId\b/g, 'enrollment');
}

export function getDroppingSubmissionError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'We could not confirm your submission. Check your connection and your dropping requests before trying again.';
    }
    if (error.response.status === 413) {
      return 'Your documents are too large to upload. Choose files up to 2 MB each and 7 MB in total, then try again.';
    }
    if (error.response.status >= 500) {
      return 'The school server could not complete the request. Check your dropping requests before trying again. If this continues, contact the school for help.';
    }

    const data: unknown = error.response.data;
    if (error.response.status === 422 && data && typeof data === 'object' && 'errors' in data) {
      const errors = data.errors;
      if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
        const messages = Object.values(errors).flat().map(submissionMessage)
          .filter((message): message is string => !!message);
        if (messages.length) return [...new Set(messages)].join(' ');
      }
    }
  }

  return submissionMessage(getErrorMessage(error, fallback)) ?? fallback;
}
