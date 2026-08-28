import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { AuthProvider } from '@/context/auth'

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
          toaster.create({
            id: toastId,
            description: error.message,
            type: 'error',
          })
        },
      }),
    }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default WithProviders
