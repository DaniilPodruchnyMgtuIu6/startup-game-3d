import type { ReactNode } from 'react'
import { Texture } from 'three'
import { MaterialsContext } from './MaterialsContext'
import type { OfficeMaterials } from './types'
import * as procedural from './proceduralMaterials'

function stubTextureSet() {
  return { map: new Texture(), normalMap: new Texture(), roughnessMap: new Texture() }
}

export const STUB_MATERIALS: OfficeMaterials = {
  floorWoodTextures: stubTextureSet(),
  floorConcreteTextures: stubTextureSet(),
  wallPaint: procedural.wallPaint,
  wallAccentBlue: procedural.wallAccentBlue,
  wallAccentGreen: procedural.wallAccentGreen,
  glass: procedural.glass,
  metalFrame: procedural.metalFrame,
  metalChrome: procedural.metalChrome,
  plasticBlack: procedural.plasticBlack,
  woodDesktop: procedural.woodDesktop,
  leather: { color: '#5b4230', roughness: 1, metalness: 0 },
  fabricLounge: { color: '#cfc9bd', roughness: 1, metalness: 0 },
  screenEmissive: procedural.screenEmissive,
  ledGreen: procedural.ledGreen,
  ledAmber: procedural.ledAmber,
  chairFabric: procedural.chairFabric,
}

export function StubMaterialsProvider({ children }: { children: ReactNode }) {
  return <MaterialsContext.Provider value={STUB_MATERIALS}>{children}</MaterialsContext.Provider>
}
