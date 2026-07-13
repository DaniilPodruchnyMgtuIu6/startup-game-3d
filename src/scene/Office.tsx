import { Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { OfficeMaterialsProvider } from '../materials/OfficeMaterialsProvider'
import { IsometricCamera } from './camera/IsometricCamera'
import { Lighting } from './lighting/Lighting'
import { Building } from './Building'
import { OpenSpace } from '../rooms/OpenSpace'
import { MeetingRoom } from '../rooms/MeetingRoom'
import { FocusRoom } from '../rooms/FocusRoom'
import { ServerRoom } from '../rooms/ServerRoom'
import { CeoOffice } from '../rooms/CeoOffice'
import { Kitchen } from '../rooms/Kitchen'
import { GameRoom } from '../rooms/GameRoom'

export interface OfficeProps {
  MaterialsProvider?: ComponentType<{ children: ReactNode }>
  LightingComponent?: ComponentType
}

export function Office({ MaterialsProvider = OfficeMaterialsProvider, LightingComponent = Lighting }: OfficeProps) {
  return (
    <Suspense fallback={null}>
      <MaterialsProvider>
        <IsometricCamera />
        <LightingComponent />
        <Building />
        <OpenSpace />
        <MeetingRoom />
        <FocusRoom />
        <ServerRoom />
        <CeoOffice />
        <Kitchen />
        <GameRoom />
      </MaterialsProvider>
    </Suspense>
  )
}
