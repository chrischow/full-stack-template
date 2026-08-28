import './App.css'

import { BrowserRouter, Route, Routes } from 'react-router'

import { Provider } from '@/components/ui/provider'
import { Toaster } from '@/components/ui/toaster'
import WithProviders from '@/components/WithProviders'
import WithTopAndSideLayout from '@/components/WithTopAndSideLayout'
import AccountSettingsPage from '@/pages/account'
import HomePage from '@/pages/home'
import LoginPage from '@/pages/login'
import OtpPage from '@/pages/login/otp'
import LoginRedirectPage from '@/pages/login/redirect'

function App() {
  return (
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route element={<WithProviders />}>
            <Route element={<WithTopAndSideLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/account" element={<AccountSettingsPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/otp" element={<OtpPage />} />
            <Route path="/login/redirect" element={<LoginRedirectPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </Provider>
  )
}

export default App
