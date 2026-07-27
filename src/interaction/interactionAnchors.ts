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
// approach/exit sit at z=0.9, a real 0.25m clear of the plates. Walkability
// of this exact point is guaranteed by the bar registering only its
// POST/CROSSBAR line as a nav obstacle (not the plates/braces bounds, which
// with grid inflation used to wall off the whole approach) and pinned by the
// mounted registry test. The mount clip's forward travel is ramp-normalized
// to this stand-off (tools/art/normalizeClipForwardTravel.mjs) so the jump
// ends with the hands on the bar.
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

// Stand-off 0.75m behind each table end: the table's obstacle box plus the
// nav grid's character-radius inflation blocks cells out to ~0.5m past the
// edge (plus cell rounding), so the old 0.4m root was itself unwalkable and
// every arriving player got silently diverted off the mark (mounted registry
// test pins the walkability now).
const SIDE_ROOT = TABLE_HALF_LENGTH + 0.75
const SIDE_APPROACH = TABLE_HALF_LENGTH + 1.0

export const PING_PONG_TABLE_ANCHORS: { sideA: InteractionAnchorSet; sideB: InteractionAnchorSet } = {
  sideA: {
    approach: { position: [-SIDE_APPROACH, 0, 0], facingY: -Math.PI / 2 },
    root: { position: [-SIDE_ROOT, 0, 0], facingY: -Math.PI / 2 },
    rightHand: { position: [-(TABLE_HALF_LENGTH + 0.15), TABLE_HEIGHT + 0.12, 0] },
    lookAt: { position: [SIDE_ROOT, TABLE_HEIGHT, 0] },
    exit: { position: [-SIDE_APPROACH, 0, 0], facingY: -Math.PI / 2 },
  },
  sideB: {
    approach: { position: [SIDE_APPROACH, 0, 0], facingY: Math.PI / 2 },
    root: { position: [SIDE_ROOT, 0, 0], facingY: Math.PI / 2 },
    leftHand: { position: [TABLE_HALF_LENGTH + 0.15, TABLE_HEIGHT + 0.12, 0] },
    lookAt: { position: [-SIDE_ROOT, TABLE_HEIGHT, 0] },
    exit: { position: [SIDE_APPROACH, 0, 0], facingY: Math.PI / 2 },
  },
}
