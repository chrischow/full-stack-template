import './App.css'

import { BrowserRouter, Route, Routes } from 'react-router'

import { Provider } from '@/components/ui/provider'
import { Toaster } from '@/components/ui/toaster'
import WithProviders from '@/components/WithProviders'
import HomePage from '@/pages/home'
import LoginPage from '@/pages/login'
import LoginRedirectPage from '@/pages/login/redirect'

function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route element={<WithProviders />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/redirect" element={<LoginRedirectPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </Provider>
  )
}

export default App
