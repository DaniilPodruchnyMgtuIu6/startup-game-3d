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
import { Character } from '../character/Character'
import { FloorClickCatcher } from '../character/FloorClickCatcher'

export interface OfficeProps {
  MaterialsProvider?: ComponentType<{ children: ReactNode }>
  LightingComponent?: ComponentType
  CharacterComponent?: ComponentType
}

export function Office({
  MaterialsProvider = OfficeMaterialsProvider,
  LightingComponent = Lighting,
  CharacterComponent = Character,
}: OfficeProps) {
  return (
    <Suspense fallback={null}>
      <MaterialsProvider>
        <IsometricCamera />
        <LightingComponent />
        <Building />
        <FloorClickCatcher />
        <OpenSpace />
        <MeetingRoom />
        <FocusRoom />
        <ServerRoom />
        <CeoOffice />
        <Kitchen />
        <GameRoom />
        <CharacterComponent />
      </MaterialsProvider>
    </Suspense>
  )
}
