import { describe, it, expect } from 'vitest'
import { buildCyberStorySceneScript } from './cyberStoryDialogues'
import { CYBER_STORY_CATALOG } from './cyberStoryCatalog'

const NOT_TRAINED = {
  ilyaHired: false,
  securityTrainingCompleted: false,
  centralLoggingChosen: false,
  hasStrongPhishingDefense: false,
  hasSecureLogMasking: false,
}

describe('cyberStoryDialogues: general shape', () => {
  it('every scene has at least one line and 2-3 choices, each choice has a non-empty hint', () => {
    for (const def of CYBER_STORY_CATALOG) {
      const script = buildCyberStorySceneScript(def.id, NOT_TRAINED)
      expect(script.lines.length).toBeGreaterThan(0)
      expect(script.choices.length).toBeGreaterThanOrEqual(2)
      expect(script.choices.length).toBeLessThanOrEqual(3)
      for (const choice of script.choices) {
        expect(choice.hint).toBeTruthy()
        expect(choice.hint).not.toMatch(/\d{2,}/) // no raw numbers in the qualitative hint
      }
      // reaction is defined for every real choice id
      for (const choice of script.choices) {
        expect(script.reaction(choice.id).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('executive-phishing-request dialogue', () => {
  it('offers only 2 choices without Ilya, 3 with Ilya (escalate is Ilya-exclusive)', () => {
    const without = buildCyberStorySceneScript('executive-phishing-request', NOT_TRAINED)
    expect(without.choices.map((c) => c.id)).toEqual(['send-requested-data', 'verify-through-known-channel'])
    const withIlya = buildCyberStorySceneScript('executive-phishing-request', { ...NOT_TRAINED, ilyaHired: true })
    expect(withIlya.choices.map((c) => c.id)).toEqual(['send-requested-data', 'verify-through-known-channel', 'escalate-phishing-to-security'])
  })

  it('the security-training flavour line only appears once training is completed', () => {
    const trained = buildCyberStorySceneScript('executive-phishing-request', { ...NOT_TRAINED, securityTrainingCompleted: true })
    const untrained = buildCyberStorySceneScript('executive-phishing-request', NOT_TRAINED)
    const trainedText = trained.lines.map((l) => l.text).join(' ')
    const untrainedText = untrained.lines.map((l) => l.text).join(' ')
    expect(trainedText).toContain('учили')
    expect(untrainedText).not.toContain('учили')
    // the risky choice remains offered even when trained - agency is preserved
    expect(trained.choices.map((c) => c.id)).toContain('send-requested-data')
  })

  it("Ilya's line only appears once he is hired", () => {
    const withIlya = buildCyberStorySceneScript('executive-phishing-request', { ...NOT_TRAINED, ilyaHired: true })
    const withoutIlya = buildCyberStorySceneScript('executive-phishing-request', NOT_TRAINED)
    expect(withIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(true)
    expect(withoutIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
  })
})

describe('supply-chain-update dialogue', () => {
  it('always offers exactly the three documented choices', () => {
    const script = buildCyberStorySceneScript('supply-chain-update', NOT_TRAINED)
    expect(script.choices.map((c) => c.id)).toEqual(['install-update-immediately', 'keep-current-version', 'review-and-pin-dependency'])
  })

  it("Ilya's permissions line only appears once he is hired", () => {
    const withIlya = buildCyberStorySceneScript('supply-chain-update', { ...NOT_TRAINED, ilyaHired: true })
    const withoutIlya = buildCyberStorySceneScript('supply-chain-update', NOT_TRAINED)
    expect(withIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(true)
    expect(withoutIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
  })
})

describe('shadow-it-log-upload dialogue', () => {
  it('the secure-sharing choice is unavailable without Ilya or central logging', () => {
    const script = buildCyberStorySceneScript('shadow-it-log-upload', NOT_TRAINED)
    expect(script.choices.map((c) => c.id)).toEqual(['upload-raw-logs-to-personal-cloud', 'sanitize-logs-manually'])
  })

  it('the secure-sharing choice appears once Ilya is hired', () => {
    const script = buildCyberStorySceneScript('shadow-it-log-upload', { ...NOT_TRAINED, ilyaHired: true })
    expect(script.choices.map((c) => c.id)).toContain('configure-secure-log-sharing')
  })

  it('the secure-sharing choice also appears once central logging was chosen, even without Ilya', () => {
    const script = buildCyberStorySceneScript('shadow-it-log-upload', { ...NOT_TRAINED, centralLoggingChosen: true })
    expect(script.choices.map((c) => c.id)).toContain('configure-secure-log-sharing')
  })
})

describe('secret-committed-to-repository dialogue', () => {
  it('always offers exactly the three documented choices, distinguishing remove/rewrite/rotate', () => {
    const script = buildCyberStorySceneScript('secret-committed-to-repository', NOT_TRAINED)
    expect(script.choices.map((c) => c.id)).toEqual(['remove-secret-in-new-commit', 'rewrite-repository-history', 'rotate-and-secure-secret'])
  })

  it("Ilya's exposure-severity line only appears once he is hired", () => {
    const withIlya = buildCyberStorySceneScript('secret-committed-to-repository', { ...NOT_TRAINED, ilyaHired: true })
    const withoutIlya = buildCyberStorySceneScript('secret-committed-to-repository', NOT_TRAINED)
    expect(withIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(true)
    expect(withoutIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
  })

  it('remove and rewrite hints both make clear the key is still considered exposed, not clean', () => {
    const script = buildCyberStorySceneScript('secret-committed-to-repository', NOT_TRAINED)
    const remove = script.choices.find((c) => c.id === 'remove-secret-in-new-commit')!
    const rewrite = script.choices.find((c) => c.id === 'rewrite-repository-history')!
    const rotate = script.choices.find((c) => c.id === 'rotate-and-secure-secret')!
    expect(remove.hint!.toLowerCase()).toMatch(/истори/)
    expect(rewrite.hint!.toLowerCase()).toMatch(/fork|кэш|локальн/)
    expect(rotate.hint!.toLowerCase()).toMatch(/отзыва|отзыв/)
  })
})

describe('mfa-fatigue-attack dialogue', () => {
  it('always offers exactly the three documented choices', () => {
    const script = buildCyberStorySceneScript('mfa-fatigue-attack', NOT_TRAINED)
    expect(script.choices.map((c) => c.id)).toEqual(['change-password-only', 'revoke-sessions-and-investigate', 'enable-phishing-resistant-auth'])
  })

  it('the change-password-only hint makes clear the unknown session is NOT revoked', () => {
    const script = buildCyberStorySceneScript('mfa-fatigue-attack', NOT_TRAINED)
    const passwordOnly = script.choices.find((c) => c.id === 'change-password-only')!
    expect(passwordOnly.hint).toMatch(/не отзыва/)
  })

  it('the strong-phishing-defence flavour line only appears once escalate-phishing-to-security already happened', () => {
    const defended = buildCyberStorySceneScript('mfa-fatigue-attack', { ...NOT_TRAINED, hasStrongPhishingDefense: true })
    const undefended = buildCyberStorySceneScript('mfa-fatigue-attack', NOT_TRAINED)
    const defendedText = defended.lines.map((l) => l.text).join(' ')
    const undefendedText = undefended.lines.map((l) => l.text).join(' ')
    expect(defendedText).toContain('фишингом')
    expect(undefendedText).not.toContain('фишингом')
  })
})

describe('external-ai-data-disclosure dialogue', () => {
  it('always offers exactly the three documented choices', () => {
    const script = buildCyberStorySceneScript('external-ai-data-disclosure', NOT_TRAINED)
    expect(script.choices.map((c) => c.id)).toEqual(['allow-unrestricted-ai-tools', 'ban-external-ai-tools', 'configure-controlled-ai-gateway'])
  })

  it('never names a real external AI service/brand', () => {
    const script = buildCyberStorySceneScript('external-ai-data-disclosure', { ...NOT_TRAINED, ilyaHired: true })
    const allText = [...script.lines.map((l) => l.text), ...script.choices.map((c) => c.hint)].join(' ').toLowerCase()
    for (const brand of ['chatgpt', 'openai', 'claude', 'anthropic', 'gemini', 'copilot', 'deepseek']) {
      expect(allText).not.toContain(brand)
    }
  })

  it('the secure-log-masking flavour line only appears once shadow-it-log-upload configured masking', () => {
    const masked = buildCyberStorySceneScript('external-ai-data-disclosure', { ...NOT_TRAINED, hasSecureLogMasking: true })
    const unmasked = buildCyberStorySceneScript('external-ai-data-disclosure', NOT_TRAINED)
    const maskedText = masked.lines.map((l) => l.text).join(' ')
    const unmaskedText = unmasked.lines.map((l) => l.text).join(' ')
    expect(maskedText).toContain('маскируются')
    expect(unmaskedText).not.toContain('маскируются')
  })

  it('the security-training flavour line only appears once training is completed', () => {
    const trained = buildCyberStorySceneScript('external-ai-data-disclosure', { ...NOT_TRAINED, securityTrainingCompleted: true })
    const untrained = buildCyberStorySceneScript('external-ai-data-disclosure', NOT_TRAINED)
    const trainedText = trained.lines.map((l) => l.text).join(' ')
    const untrainedText = untrained.lines.map((l) => l.text).join(' ')
    expect(trainedText).toContain('обучении')
    expect(untrainedText).not.toContain('обучении')
  })
})
