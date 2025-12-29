import { Router } from './router'
import { ToastContainer } from './components/Toast'
import { ConnectionStatus } from './components/ConnectionStatus'

function App() {
  return (
    <>
      <ConnectionStatus />
      <Router />
      <ToastContainer />
    </>
  )
}

export default App
