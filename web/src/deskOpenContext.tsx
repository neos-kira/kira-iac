import { createContext, useContext, useState, type ReactNode } from 'react'

export type DeskOpenContextValue = {
  deskOpen: boolean
  setDeskOpen: (open: boolean) => void
}

const DeskOpenContext = createContext<DeskOpenContextValue | null>(null)

export function DeskOpenProvider({ children }: { children: ReactNode }) {
  const [deskOpen, setDeskOpen] = useState(false)
  return (
    <DeskOpenContext.Provider value={{ deskOpen, setDeskOpen }}>
      {children}
    </DeskOpenContext.Provider>
  )
}

export function useDeskOpen(): DeskOpenContextValue | null {
  return useContext(DeskOpenContext)
}
