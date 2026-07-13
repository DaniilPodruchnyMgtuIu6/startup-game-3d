import { createContext, useContext } from 'react'
import type { OfficeMaterials } from './types'

export const MaterialsContext = createContext<OfficeMaterials | null>(null)

export function useMaterials(): OfficeMaterials {
  const ctx = useContext(MaterialsContext)
  if (!ctx) {
    throw new Error('useMaterials must be used within a MaterialsContext provider')
  }
  return ctx
}
