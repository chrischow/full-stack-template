import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { toaster } from '../ui/toaster'

const WithProviders = () => {
  const toastId = 'error-toast'

  const [queryClient] = useState(
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
        },
      },
      queryCache: new QueryCache({
        onError: (error) => {
          if (!isAxiosError(error)) {
            toaster.create({
              id: toastId,
              description: error.message,
              type: 'error',
            })

            return
          }
        },
      }),
    }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

export default WithProviders
