/** Pure rules for Kiragon Leif's Hope; testable without Foundry. */
export const freshState = () => ({
  version: 1,
  competition: { round: 0, status: 'active', scores: {}, reconciliation: { joy: 0, anger: 0 } },
  footsteps: { vp: 0, rounds: 0 },
  grief: { vp: 0 },
  four: { fear: false, shame: false, love: false, anger: false },
  boss: { vp: 0, resolved: false, fracture: false }
});
export function getContestRow(competition, actorId) {
  if (!competition.scores[actorId]) competition.scores[actorId] = { joy: 0, anger: 0, winner: null, erosionApplied: false, boonGranted: false };
  return competition.scores[actorId];
}
export function contestScore(competition, actorId, emotion, delta) {
  if (!['joy','anger'].includes(emotion)) throw new Error('Invalid emotion');
  if (!Number.isInteger(delta) || delta < -2 || delta > 2) throw new Error('Invalid point change');
  if (competition.status !== 'active') return { changed: false, reason: 'Contest is over' };
  const row = getContestRow(competition, actorId);
  if (row.winner) return { changed: false, reason: 'This character already has an emotional gift' };
  const before = row[emotion];
  row[emotion] = Math.max(0, Math.min(5, before + delta));
  if (row[emotion] === 5) row.winner = emotion;
  return {changed: before !== row[emotion], winner: row.winner, threshold: before < 5 && row[emotion] === 5};
}
export function nextContestRound(competition) {
  if (competition.status !== 'active') return competition.round;
  competition.round = Math.min(5, competition.round+1);
  if (competition.round === 5) competition.status = 'ended';
  return competition.round;
}
export function reconcile(competition, emotion, delta) {
  if (!['joy','anger'].includes(emotion)) throw new Error('Invalid emotion');
  if (competition.status !== 'active') return;
  competition.reconciliation[emotion] = Math.max(0, Math.min(3, competition.reconciliation[emotion] + delta));
  if (competition.reconciliation.joy === 3 && competition.reconciliation.anger === 3) competition.status = 'reconciled';
}
export function advanceVP(state, section, delta) {
  const caps = { footsteps:3, grief:3, boss:6 };
  if (!(section in caps)) throw new Error('Invalid VP section');
  const value = state[section].vp;
  const floor = section === 'boss' ? Math.min(4, Math.floor(value/2)*2) : 0;
  const ceiling = section === 'boss' ? Math.min(6, Math.floor(value/2)*2+2) : caps[section];
  const next = Math.max(floor, Math.min(ceiling, value + delta));
  state[section].vp = next;
  if (section === 'boss' && next === 6) state.boss.resolved = true;
  return next;
}
