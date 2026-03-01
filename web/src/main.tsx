import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

function MentorDeskOrNull() {
  const loc = useLocation()
  const pathname = (loc.pathname || '').replace(/^\/+/, '') || '/'
  if (pathname === 'login') return null
  return <MentorDesk />
}
import './index.css'
import App from './App.tsx'
import { LoginPage } from './LoginPage'
import { isLoggedIn } from './auth'
import { isJTerada } from './specialUsers'
import { isTask1Cleared } from './training/trainingWbsData'
import { LinuxLevel1Page } from './training/LinuxLevel1Page'
import { LinuxLevel2Page } from './training/LinuxLevel2Page'
import { InfraBasic1Page } from './training/InfraBasic1Page'
import { InfraBasicTopPage } from './training/InfraBasicTopPage'
import { InfraBasic2TopPage } from './training/InfraBasic2TopPage'
import { InfraBasic21Page } from './training/InfraBasic21Page'
import { InfraBasic3TopPage } from './training/InfraBasic3TopPage'
import { InfraBasic31Page } from './training/InfraBasic31Page'
import { InfraBasic32Page } from './training/InfraBasic32Page'
import { InfraBasic4Page } from './training/InfraBasic4Page'
import { InfraWbsPage } from './training/InfraWbsPage'
import { IntroPage } from './training/IntroPage'
import { AdminPage } from './admin/AdminPage'
import { MentorDesk } from './components/MentorDesk'
import { IntroGate } from './components/IntroGate'
import { Task1Gate, Task2Gate } from './components/TaskGates'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

function getDisplayName(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || ''
}

/** j-terada が課題1クリア後はトップ以外のルートにアクセスさせず "/" へリダイレクトする */
function JTeradaRestrictGuard() {
  const loc = useLocation()
  const pathname = loc.pathname.replace(/^\/+/, '') || '/'
  if (pathname === 'login' || pathname === '') return null
  if (!isLoggedIn()) return null
  const name = getDisplayName()
  if (!isJTerada(name) || !isTask1Cleared()) return null
  return <Navigate to="/" replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <>
        <JTeradaRestrictGuard />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={isLoggedIn() ? <App /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/training/linux-level1" element={<IntroGate><LinuxLevel1Page /></IntroGate>} />
          <Route path="/training/infra-basic-1" element={<IntroGate><InfraBasic1Page /></IntroGate>} />
          <Route path="/training/infra-basic-top" element={<IntroGate><InfraBasicTopPage /></IntroGate>} />
          <Route path="/training/infra-basic-2-top" element={<IntroGate><Task1Gate><InfraBasic2TopPage /></Task1Gate></IntroGate>} />
          <Route path="/training/infra-basic-2-1" element={<IntroGate><Task1Gate><InfraBasic21Page /></Task1Gate></IntroGate>} />
          <Route path="/training/linux-level2" element={<IntroGate><Task1Gate><LinuxLevel2Page /></Task1Gate></IntroGate>} />
          <Route path="/training/infra-basic-3-top" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic3TopPage /></Task2Gate></Task1Gate></IntroGate>} />
          <Route path="/training/infra-basic-3-1" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic31Page /></Task2Gate></Task1Gate></IntroGate>} />
          <Route path="/training/infra-basic-3-2" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic32Page /></Task2Gate></Task1Gate></IntroGate>} />
          <Route path="/training/infra-basic-4" element={<IntroGate><InfraBasic4Page /></IntroGate>} />
          <Route path="/training/infra-wbs" element={<IntroGate><InfraWbsPage /></IntroGate>} />
          <Route path="/training/intro" element={<IntroPage />} />
        </Routes>
        <MentorDeskOrNull />
      </>
    </HashRouter>
  </StrictMode>,
)
