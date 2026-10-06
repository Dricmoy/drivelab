export function emptyDecisionCopy(planner: 'baseline' | 'lattice' | undefined, finalFrame: boolean) {
  if (!planner) return { title: 'Awaiting a decision', detail: 'Awaiting a recorded decision.', candidates: 'Candidate results are not ready yet.' };
  if (finalFrame) return { title: 'Replay complete', detail: 'Final recorded state. No new decision is computed at this frame.', candidates: 'No new candidate search at the final frame. Step back to inspect the last decision.' };
  if (planner === 'baseline') return { title: 'Route following', detail: 'Route following without candidate search.', candidates: 'No candidate search in the baseline.' };
  return { title: 'No recorded decision', detail: 'No candidate decision is recorded at this frame.', candidates: 'No candidates recorded for this frame.' };
}
