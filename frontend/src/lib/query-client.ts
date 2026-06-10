import { QueryClient } from '@tanstack/react-query'

// Shared TanStack Query client for the app.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
