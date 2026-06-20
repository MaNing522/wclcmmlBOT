function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomDelay() {
  const min = 300, max = 800;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
module.exports = { sleep, randomDelay };