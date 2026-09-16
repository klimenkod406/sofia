'use client'

import { ReactNode } from 'react'
import { useSettings } from './settings'

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Force initialization on client side
  useSettings()
  
  return <>{children}</>
}