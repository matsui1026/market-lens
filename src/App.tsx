import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { AppProvider } from './app/AppProvider'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ToastProvider'
import { AboutPage } from './pages/AboutPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SetupPage } from './pages/SetupPage'

/** Shown only while a chart page's code loads on a direct visit. */
function RouteFallback() {
  return <div className="page" aria-busy="true" />
}

// Chart pages (ECharts) load on demand so the search screen opens fast.
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    hydrateFallbackElement: <RouteFallback />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'stock/:code',
        lazy: () => import('./pages/StockPage').then((m) => ({ Component: m.StockPage })),
      },
      {
        path: 'compare',
        lazy: () => import('./pages/ComparePage').then((m) => ({ Component: m.ComparePage })),
      },
      { path: 'about', element: <AboutPage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The local server already queues requests for the rate limit; let the user retry.
            retry: false,
            refetchOnWindowFocus: false,
            gcTime: 30 * 60_000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AppProvider>
    </QueryClientProvider>
  )
}
