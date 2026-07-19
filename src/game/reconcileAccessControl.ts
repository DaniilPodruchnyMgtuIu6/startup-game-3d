import { useSprintStore } from './sprintStore'
import { useRiskStore } from './riskStore'
import { useAccessControlStore } from './accessControlStore'
import { getActualRiskLevel, getDetectedRiskLevel } from './riskRules'
import { canUnlockAccessControlProposal } from './accessControlRules'
import { toWorkdayIndex } from './workdayIndex'

// Migration from an old Feature 09 save (spec §31): open the СКУД proposal if
// office-access risk is already observably elevated, and arm the intrusion
// threat if actual risk is high and no active access control - giving the player
// a full fresh delay, never firing the incident retroactively. Idempotent; a
// continuing Feature 10 save is a no-op or a normal reconcile.
export function reconcileAccessControlThreatAndProposal(): void {
  const signals = useRiskStore.getState().signals
  const ac = useAccessControlStore.getState()
  const sprint = useSprintStore.getState()
  const currentWorkdayIndex = toWorkdayIndex(sprint.sprintNumber, sprint.day)

  if (ac.accessControl.proposalStatus === 'locked' && canUnlockAccessControlProposal(getDetectedRiskLevel(signals, 'office-access'))) {
    ac.unlockProposal(currentWorkdayIndex)
  } else if (
    // Feature 16 §9: a save whose proposal is already available/postponed but has
    // no availableAt stamp (older save) gets one now — the escalation deadline is
    // measured from the reload, never retroactively.
    (ac.accessControl.proposalStatus === 'available' || ac.accessControl.proposalStatus === 'postponed') &&
    ac.accessControl.availableAtWorkdayIndex === undefined
  ) {
    useAccessControlStore.setState({ accessControl: { ...ac.accessControl, availableAtWorkdayIndex: currentWorkdayIndex } })
  }

  ac.reconcileIntrusionThreat({
    currentWorkdayIndex: toWorkdayIndex(sprint.sprintNumber, sprint.day),
    actualOfficeAccessLevel: getActualRiskLevel(signals, 'office-access'),
    accessControlActive: ac.accessControl.proposalStatus === 'active',
    intrusionStatus: ac.intrusion.status,
    armedAtWorkdayIndex: ac.intrusion.armedAtWorkdayIndex,
    dueWorkdayIndex: ac.intrusion.dueWorkdayIndex,
  })
}
