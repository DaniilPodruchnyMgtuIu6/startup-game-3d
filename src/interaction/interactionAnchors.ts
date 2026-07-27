// 18H Wave 2 (§11): explicit interaction anchors for furniture that positions
// more than one body point (hands, feet, look target) - richer than
// TriggerTarget (a single world-space click destination). Local-space, same
// convention as Workstation's CHAIR_LOCAL: measured against the furniture
// piece's own origin, resolved to world space by the room group it sits in.
//
// Seating (Chair/CaptainChair/Sofa/Workstation) does not need this: the
// FSM's sit states already place the whole body via one Target point and the
// authored sit/type/sofaSit clips do the rest. Anchors earn their keep where
// a clip needs more than "stand here, face this way" - hands must find a
// specific bar or table edge that a single point/facing can't express.
export interface Transform {
  position: [number, number, number]
  facingY?: number
}

export interface InteractionAnchorSet {
  approach: Transform
  root: Transform
  leftHand?: Transform
  rightHand?: Transform
  leftFoot?: Transform
  rightFoot?: Transform
  hips?: Transform
  lookAt?: Transform
  exit?: Transform
}

// Pull-up bar (public/character heights measured 1.50-1.80m, see
// docs/art/18h-character-environment-scale-audit.md): the grip sits on the
// crossbar at BAR_Y=2.0m (PullUpBar.tsx), (WIDTH/2)=0.6m either side of
// centre. Overhead reach for the shortest hired characters (~1.50m) falls
// short of 2.0m standing flat-footed - Wave 3's mount clip should plan for a
// short hop/reach-up rather than a flat-footed grab (documented, not fixed
// here: fixing it is an animation decision, not an anchor-placement one).
// Foot plates (PullUpBar.tsx) extend to z=0.65 (position z=0.3, depth 0.7) -
// approach/exit sit at z=0.9, a real 0.25m clear of the plates, not merely
// outside the post radius.
export const PULL_UP_BAR_ANCHORS: InteractionAnchorSet = {
  approach: { position: [0, 0, 0.9], facingY: Math.PI },
  root: { position: [0, 0, 0], facingY: Math.PI },
  leftHand: { position: [-0.6, 2.0, 0] },
  rightHand: { position: [0.6, 2.0, 0] },
  hips: { position: [0, 1.1, 0] },
  lookAt: { position: [0, 1.6, 0.5] },
  exit: { position: [0, 0, 0.9], facingY: Math.PI },
}

// Ping-pong table (PingPongTable.tsx): HEIGHT=0.76m matches regulation table
// height and the spec's own ~0.76m reference. Two independent anchor sets -
// players stand on opposite LENGTH ends, never sharing a side.
const TABLE_HALF_LENGTH = 2.74 / 2
const TABLE_HEIGHT = 0.76

export const PING_PONG_TABLE_ANCHORS: { sideA: InteractionAnchorSet; sideB: InteractionAnchorSet } = {
  sideA: {
    approach: { position: [-(TABLE_HALF_LENGTH + 0.7), 0, 0], facingY: -Math.PI / 2 },
    root: { position: [-(TABLE_HALF_LENGTH + 0.4), 0, 0], facingY: -Math.PI / 2 },
    rightHand: { position: [-(TABLE_HALF_LENGTH + 0.15), TABLE_HEIGHT + 0.12, 0] },
    lookAt: { position: [TABLE_HALF_LENGTH + 0.4, TABLE_HEIGHT, 0] },
    exit: { position: [-(TABLE_HALF_LENGTH + 0.7), 0, 0], facingY: -Math.PI / 2 },
  },
  sideB: {
    approach: { position: [TABLE_HALF_LENGTH + 0.7, 0, 0], facingY: Math.PI / 2 },
    root: { position: [TABLE_HALF_LENGTH + 0.4, 0, 0], facingY: Math.PI / 2 },
    leftHand: { position: [TABLE_HALF_LENGTH + 0.15, TABLE_HEIGHT + 0.12, 0] },
    lookAt: { position: [-(TABLE_HALF_LENGTH + 0.4), TABLE_HEIGHT, 0] },
    exit: { position: [TABLE_HALF_LENGTH + 0.7, 0, 0], facingY: Math.PI / 2 },
  },
}
