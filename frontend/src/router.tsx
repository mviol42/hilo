import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { JoinPage } from '@/pages/JoinPage'
import { LobbyPage } from '@/pages/LobbyPage'
import { GamePage } from '@/pages/GamePage'
import { ErrorPage } from '@/pages/ErrorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/join',
    element: <JoinPage />,
  },
  {
    path: '/lobby',
    element: <LobbyPage />,
  },
  {
    path: '/game',
    element: <GamePage />,
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
