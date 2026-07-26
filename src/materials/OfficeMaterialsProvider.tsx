import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace } from 'three'
import { MaterialsContext } from './MaterialsContext'
import type { OfficeMaterials } from './types'
import * as procedural from './proceduralMaterials'

export function OfficeMaterialsProvider({ children }: { children: ReactNode }) {
  const wood = useTexture({
    map: '/textures/wood-floor/diffuse.jpg',
    normalMap: '/textures/wood-floor/normal.jpg',
    roughnessMap: '/textures/wood-floor/roughness.jpg',
  })
  const concrete = useTexture({
    map: '/textures/concrete-floor/diffuse.jpg',
    normalMap: '/textures/concrete-floor/normal.jpg',
    roughnessMap: '/textures/concrete-floor/roughness.jpg',
  })
  const leatherTex = useTexture({
    map: '/textures/leather/diffuse.jpg',
    normalMap: '/textures/leather/normal.jpg',
    roughnessMap: '/textures/leather/roughness.jpg',
  })
  const boucleTex = useTexture({
    map: '/textures/boucle/diffuse.jpg',
    normalMap: '/textures/boucle/normal.jpg',
    roughnessMap: '/textures/boucle/roughness.jpg',
  })
  const artTex = useTexture({
    dashboard: '/textures/officeflow_dashboard.jpg',
    posterOfficeFlow: '/posters/officeflow.jpg',
    posterLockScreen: '/posters/lock_screen.jpg',
  })

  const value = useMemo<OfficeMaterials>(() => {
    wood.map.colorSpace = SRGBColorSpace
    concrete.map.colorSpace = SRGBColorSpace
    leatherTex.map.colorSpace = SRGBColorSpace
    boucleTex.map.colorSpace = SRGBColorSpace
    artTex.dashboard.colorSpace = SRGBColorSpace
    artTex.posterOfficeFlow.colorSpace = SRGBColorSpace
    artTex.posterLockScreen.colorSpace = SRGBColorSpace

    return {
      floorWoodTextures: wood,
      floorConcreteTextures: concrete,
      wallPaint: procedural.wallPaint,
      wallAccentBlue: procedural.wallAccentBlue,
      wallAccentGreen: procedural.wallAccentGreen,
      glass: procedural.glass,
      metalFrame: procedural.metalFrame,
      metalChrome: procedural.metalChrome,
      plasticBlack: procedural.plasticBlack,
      woodDesktop: procedural.woodDesktop,
      leather: {
        map: leatherTex.map,
        normalMap: leatherTex.normalMap,
        roughnessMap: leatherTex.roughnessMap,
        roughness: 1,
        metalness: 0,
      },
      fabricLounge: {
        map: boucleTex.map,
        normalMap: boucleTex.normalMap,
        roughnessMap: boucleTex.roughnessMap,
        roughness: 1,
        metalness: 0,
      },
      screenEmissive: procedural.screenEmissive,
      screenOff: procedural.screenOff,
      screenDashboard: {
        map: artTex.dashboard,
        emissive: '#ffffff',
        emissiveMap: artTex.dashboard,
        emissiveIntensity: 0.75,
        roughness: 0.35,
        metalness: 0.05,
      },
      posterOfficeFlow: { map: artTex.posterOfficeFlow, roughness: 0.85, metalness: 0 },
      posterLockScreen: { map: artTex.posterLockScreen, roughness: 0.85, metalness: 0 },
      ledGreen: procedural.ledGreen,
      ledAmber: procedural.ledAmber,
      ledRed: procedural.ledRed,
      chairFabric: procedural.chairFabric,
    }
  }, [wood, concrete, leatherTex, boucleTex, artTex])

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>
}
