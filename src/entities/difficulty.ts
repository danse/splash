import type { BrainOpts } from './bot'

export type DifficultyId = 'easy' | 'medium' | 'hard'

export interface Difficulty {
  id: DifficultyId
  label: string
  brain: BrainOpts
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    brain: {
      aimWobble: 0.38,
      aimJitter: [0.3, 0.8],
      speedMult: 0.62,
      burstOn: 0.9,
      burstOff: 1.1,
      engageDelay: 2.5,
    },
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    brain: {
      aimWobble: 0.2,
      aimJitter: [0.2, 0.5],
      speedMult: 0.82,
      burstOn: 1.4,
      burstOff: 0.45,
      engageDelay: 1.2,
    },
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    brain: {},
  },
}

export const DEFAULT_DIFFICULTY: DifficultyId = 'hard'
