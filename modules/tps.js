let lastPhysicsTick = Date.now();
let tpsHistory = [];
const TPS_SAMPLE_SIZE = 20;
function tick() {
  const now = Date.now();
  const delta = now - lastPhysicsTick;
  lastPhysicsTick = now;
  tpsHistory.push(delta);
  if (tpsHistory.length > TPS_SAMPLE_SIZE) tpsHistory.shift();
}
function getTps() {
  if (tpsHistory.length < 5) return null;
  const avgDelta = tpsHistory.reduce((a, b) => a + b, 0) / tpsHistory.length;
  return Math.min(20, 1000 / avgDelta);
}
module.exports = { tick, getTps };