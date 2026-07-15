import { femalePm } from '../character/characters/femalePm'
import type { CutsceneScript, Point } from './types'

const PM_DESK: Point = [-2, 0.8, 6.3]
// CameraControls' existing minDistance (14) clamps anything tighter, so this
// offset from PM_DESK keeps the requested framing just outside that floor.
const PM_DESK_CAMERA: Point = [8, 12.8, 16.3]
const PM_AWAY_POINT: Point = [-2, 0, 3]
const GUARD1_SPAWN: Point = [-5, 0, 5]
const GUARD1_DESK_MARK: Point = [-1.2, 0, 6.3]
const GUARD2_SPAWN: Point = [-5, 0, 7]
const GUARD2_DESK_MARK: Point = [-2.8, 0, 6.9]

const GUARD1 = { speaker: 'Охранник 1', speakerRole: 'Служба безопасности' }
const GUARD2 = { speaker: 'Охранник 2', speakerRole: 'Служба безопасности' }

export const securityBreachScene: CutsceneScript = async (director) => {
  await director.camera(PM_DESK, { position: PM_DESK_CAMERA, durationMs: 1500 })
  await director.walk(femalePm.id, PM_AWAY_POINT)

  director.spawnActor('guard1', GUARD1_SPAWN, 0, '#37475c')
  director.spawnActor('guard2', GUARD2_SPAWN, 0, '#4a3c3c')
  await Promise.all([director.walk('guard1', GUARD1_DESK_MARK), director.walk('guard2', GUARD2_DESK_MARK)])

  await director.say([
    { ...GUARD1, text: 'Так, а тут у нас непорядок. Компьютер не заблокирован — ушла и оставила всё как есть.' },
    { ...GUARD2, text: 'Если это дойдёт до руководства — влетит всему отделу. Идём к начальнику отдела, обсудим.' },
  ])

  director.despawnActor('guard1')
  director.despawnActor('guard2')
}
