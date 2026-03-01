import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LoginPage } from './LoginPage'
import { isLoggedIn } from './auth'
import { LinuxLevel1Page } from './training/LinuxLevel1Page'
import { LinuxLevel2Page } from './training/LinuxLevel2Page'
import { InfraBasic1Page } from './training/InfraBasic1Page'
import { InfraBasicTopPage } from './training/InfraBasicTopPage'
import { InfraBasic2TopPage } from './training/InfraBasic2TopPage'
import { InfraBasic21Page } from './training/InfraBasic21Page'
import { InfraBasic3TopPage } from './training/InfraBasic3TopPage'
import { InfraBasic31Page } from './training/InfraBasic31Page'
import { InfraBasic32Page } from './training/InfraBasic32Page'
import { InfraWbsPage } from './training/InfraWbsPage'
import { IntroPage } from './training/IntroPage'
import { AdminPage } from './admin/AdminPage'
import { MentorDesk } from './components/MentorDesk'
import { IntroGate } from './components/IntroGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={isLoggedIn() ? <App /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/training/linux-level1" element={<IntroGate><LinuxLevel1Page /></IntroGate>} />
          <Route path="/training/linux-level2" element={<IntroGate><LinuxLevel2Page /></IntroGate>} />
          <Route path="/training/infra-basic-1" element={<IntroGate><InfraBasic1Page /></IntroGate>} />
          <Route path="/training/infra-basic-top" element={<IntroGate><InfraBasicTopPage /></IntroGate>} />
          <Route path="/training/infra-basic-2-top" element={<IntroGate><InfraBasic2TopPage /></IntroGate>} />
          <Route path="/training/infra-basic-2-1" element={<IntroGate><InfraBasic21Page /></IntroGate>} />
          <Route path="/training/infra-basic-3-top" element={<IntroGate><InfraBasic3TopPage /></IntroGate>} />
          <Route path="/training/infra-basic-3-1" element={<IntroGate><InfraBasic31Page /></IntroGate>} />
          <Route path="/training/infra-basic-3-2" element={<IntroGate><InfraBasic32Page /></IntroGate>} />
          <Route path="/training/infra-wbs" element={<IntroGate><InfraWbsPage /></IntroGate>} />
          <Route path="/training/intro" element={<IntroPage />} />
        </Routes>
        <MentorDesk />
      </>
    </HashRouter>
  </StrictMode>,
)
