import { useRouteError, Link } from 'react-router-dom'

export function ErrorPage() {
  const error = useRouteError() as Error

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Oops!</h1>
        <p className="text-gray-600 mb-2">Sorry, an unexpected error has occurred.</p>
        <p className="text-red-600 mb-8">
          {error?.message || 'Unknown error'}
        </p>
        <Link
          to="/"
          className="text-blue-600 hover:text-blue-700 font-semibold"
        >
          Return to Home
        </Link>
      </div>
    </div>
  )
}
