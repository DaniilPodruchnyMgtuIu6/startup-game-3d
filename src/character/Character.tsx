import { useGLTF } from '@react-three/drei'
import { CharacterModel } from './CharacterModel'
import { PLAYER_CHARACTER } from './characters'
import { PLAYER_ID } from './characterStore'

// The player-controlled character, driven by scene clicks.
export function Character() {
  return <CharacterModel characterId={PLAYER_ID} config={PLAYER_CHARACTER.model} />
}

for (const url of Object.values(PLAYER_CHARACTER.model.clips)) {
  useGLTF.preload(url)
}
