import { Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { OfficeMaterialsProvider } from '../materials/OfficeMaterialsProvider'
import { IsometricCamera } from './camera/IsometricCamera'
import { CutsceneCamera } from './camera/CutsceneCamera'
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
import { Npcs } from '../character/Npcs'
import { FloorClickCatcher } from '../character/FloorClickCatcher'
import { MeetPmController } from '../game/MeetPmController'
import { PostAuditConversationController } from '../game/PostAuditConversationController'
import { SecuritySpecialistController } from '../game/SecuritySpecialistController'
import { FreeNpcChatController } from '../game/FreeNpcChatController'
import { NpcAmbientConversationController } from '../game/NpcAmbientConversationController'
import { AccessControlReader } from '../furniture/AccessControlReader'
import { CutsceneRunner } from '../cutscenes/CutsceneRunner'

export interface OfficeProps {
  MaterialsProvider?: ComponentType<{ children: ReactNode }>
  LightingComponent?: ComponentType
  CharacterComponent?: ComponentType
  NpcsComponent?: ComponentType
  StoryComponent?: ComponentType
}

export function Office({
  MaterialsProvider = OfficeMaterialsProvider,
  LightingComponent = Lighting,
  CharacterComponent = Character,
  NpcsComponent = Npcs,
  StoryComponent = MeetPmController,
}: OfficeProps) {
  return (
    <Suspense fallback={null}>
      <MaterialsProvider>
        <IsometricCamera />
        <CutsceneCamera />
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
        <NpcsComponent />
        <StoryComponent />
        <PostAuditConversationController />
        <SecuritySpecialistController />
        <FreeNpcChatController />
        <NpcAmbientConversationController />
        <AccessControlReader />
        <CutsceneRunner />
      </MaterialsProvider>
    </Suspense>
  )
}
