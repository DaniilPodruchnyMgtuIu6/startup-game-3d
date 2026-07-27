import { create } from 'zustand'

// 18H §20: which rally is live at the ping-pong table right now, if any -
// set by the matchmaker when BOTH participants have arrived (performing) and
// cleared when the rally finishes. Purely visual state: the ball and any
// spectator logic read it; gameplay math never does.
interface PingPongRallyStore {
  participants: [string, string] | null
  begin: (a: string, b: string) => void
  end: () => void
}

export const usePingPongRallyStore = create<PingPongRallyStore>()((set) => ({
  participants: null,
  begin: (a, b) => set({ participants: [a, b] }),
  end: () => set({ participants: null }),
}))
