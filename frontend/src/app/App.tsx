import './App.css'

import { BrowserRouter, Route, Routes } from 'react-router'

import { Provider } from '@/components/ui/provider'
import { Toaster } from '@/components/ui/toaster'
import WithProviders from '@/components/WithProviders'

function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route element={<WithProviders />}>
            <Route path="/" element={<></>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </Provider>
  )
}

export default App
