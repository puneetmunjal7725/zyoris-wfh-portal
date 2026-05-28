let audioCtx = null

export function prepareNotifyAudio() {
  if (typeof window === 'undefined') return
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
}

function tone(freq, startSec, durationSec, volume = 0.22) {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  const t0 = audioCtx.currentTime + startSec
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec)
  osc.start(t0)
  osc.stop(t0 + durationSec + 0.05)
}

/** Short bell — WFH activity check popup */
export function playActivityCheckBell() {
  prepareNotifyAudio()
  if (!audioCtx) return
  tone(784, 0, 0.14, 0.2)
  tone(988, 0.16, 0.18, 0.18)
  tone(1175, 0.34, 0.22, 0.16)
}
