import type { ThreeElements } from '@react-three/fiber'
import type { Texture } from 'three'

export type StandardMaterialProps = ThreeElements['meshStandardMaterial']
export type PhysicalMaterialProps = ThreeElements['meshPhysicalMaterial']

export interface TiledTextureSet {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
}

export interface OfficeMaterials {
  floorWoodTextures: TiledTextureSet
  floorConcreteTextures: TiledTextureSet
  wallPaint: StandardMaterialProps
  wallAccentBlue: StandardMaterialProps
  wallAccentGreen: StandardMaterialProps
  glass: PhysicalMaterialProps
  metalFrame: StandardMaterialProps
  metalChrome: StandardMaterialProps
  plasticBlack: StandardMaterialProps
  woodDesktop: StandardMaterialProps
  leather: StandardMaterialProps
  fabricLounge: StandardMaterialProps
  screenEmissive: StandardMaterialProps
  ledGreen: StandardMaterialProps
  ledAmber: StandardMaterialProps
  ledRed: StandardMaterialProps
  chairFabric: (color: string) => StandardMaterialProps
}
