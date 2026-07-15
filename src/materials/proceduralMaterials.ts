import type { StandardMaterialProps, PhysicalMaterialProps } from './types'

export const wallPaint: StandardMaterialProps = { color: '#f2efe7', roughness: 0.9, metalness: 0 }
export const wallAccentBlue: StandardMaterialProps = { color: '#3457a6', roughness: 0.85, metalness: 0 }
export const wallAccentGreen: StandardMaterialProps = { color: '#2f5d4f', roughness: 0.85, metalness: 0 }
export const glass: PhysicalMaterialProps = {
  color: '#ffffff',
  transmission: 0.92,
  roughness: 0.04,
  thickness: 0.08,
  ior: 1.5,
  metalness: 0,
}
export const metalFrame: StandardMaterialProps = { color: '#33363c', metalness: 0.85, roughness: 0.35 }
export const metalChrome: StandardMaterialProps = { color: '#c9cdd2', metalness: 1, roughness: 0.15 }
export const plasticBlack: StandardMaterialProps = { color: '#17181a', roughness: 0.45, metalness: 0.05 }
export const woodDesktop: StandardMaterialProps = { color: '#b98a5a', roughness: 0.55, metalness: 0 }
export const screenEmissive: StandardMaterialProps = {
  color: '#0a1a2a',
  emissive: '#4fb8ff',
  emissiveIntensity: 1.4,
  roughness: 0.3,
  metalness: 0.1,
}
// A monitor with nobody sitting at it - dark glass, no glow.
export const screenOff: StandardMaterialProps = {
  color: '#0a1a2a',
  emissive: '#000000',
  emissiveIntensity: 0,
  roughness: 0.3,
  metalness: 0.1,
}
export const ledGreen: StandardMaterialProps = {
  color: '#062b0d',
  emissive: '#37ff6b',
  emissiveIntensity: 3,
  roughness: 0.4,
}
export const ledAmber: StandardMaterialProps = {
  color: '#2b1c02',
  emissive: '#ffb020',
  emissiveIntensity: 3,
  roughness: 0.4,
}
export const ledRed: StandardMaterialProps = {
  color: '#2b0505',
  emissive: '#ff3b30',
  emissiveIntensity: 3,
  roughness: 0.4,
}
export function chairFabric(color: string): StandardMaterialProps {
  return { color, roughness: 0.85, metalness: 0 }
}
