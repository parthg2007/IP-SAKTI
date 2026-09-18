import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle.jsx'
import Landing from './pages/Landing.jsx'
import { brandTheme } from './theme.js'

const Chat = lazy(() => import('./pages/Chat.jsx'))

const AppRoutes = ({ theme, onToggleTheme }) => {
  const location = useLocation()
  const isChat = location.pathname === '/chat'

  return (
    <>
      {!isChat && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<Suspense fallback={<p role="status" className="p-8">Loading…</p>}><Chat /></Suspense>} />
      </Routes>
    </>
  )
}

const App = () => {
  const [theme, setTheme] = useState("dark")

  useEffect(() => {
    try {
      localStorage.setItem('ip-sakti-theme', theme)
    } catch {
      // Theme switching still works when browser storage is unavailable.
    }
  }, [theme])

  return (
    <div className={`${brandTheme} ${theme === 'dark' ? 'dark scheme-dark' : 'scheme-light'} min-h-dvh bg-[var(--lp-bg)] text-[var(--lp-ink)]`}>
      <BrowserRouter>
        <AppRoutes theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />
      </BrowserRouter>
    </div>
  )
}

export default App
