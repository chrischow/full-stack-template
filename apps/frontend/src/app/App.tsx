import { BrowserRouter, Route, Routes } from 'react-router'

import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import WithProviders from '@/components/WithProviders'
import WithSidebarLayout from '@/components/WithSidebarLayout'
import AccountSettingsPage from '@/pages/account'
import HomePage from '@/pages/home'
import LoginPage from '@/pages/login'
import OtpPage from '@/pages/login/otp'
import LoginRedirectPage from '@/pages/login/redirect'

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<WithProviders />}>
            <Route element={<WithSidebarLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/account" element={<AccountSettingsPage />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/otp" element={<OtpPage />} />
            <Route path="/login/redirect" element={<LoginRedirectPage />} />
            {import.meta.env.DEV && (
              <Route path="/wireframes">
                <Route element={<WithSidebarLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="account" element={<AccountSettingsPage />} />
                </Route>
              </Route>
            )}
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
