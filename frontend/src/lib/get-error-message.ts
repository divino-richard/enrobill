import axios from 'axios'

interface ApiError {
  message?: string
}

// Extracts a human-readable message from an unknown error (axios or otherwise).
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    return data?.message ?? error.message
  }
  if (error instanceof Error) return error.message
  return fallback
}
