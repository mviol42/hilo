import { useUI } from '@/context'

export function ToastContainer() {
  const { toasts, removeToast } = useUI()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex justify-between items-center px-4 py-3 rounded-lg shadow-lg text-white font-medium cursor-pointer animate-slide-in ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
              ? 'bg-red-600'
              : 'bg-blue-600'
          }`}
          onClick={() => removeToast(toast.id)}
        >
          <span>{toast.message}</span>
          <button className="ml-4 text-2xl leading-none hover:opacity-80">&times;</button>
        </div>
      ))}
    </div>
  )
}
