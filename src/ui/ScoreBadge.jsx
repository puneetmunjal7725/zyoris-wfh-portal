import { computeScore, scoreTone } from '../state/storage.js'

export function ScoreBadge({ checks }) {
  const { score, responded, total } = computeScore(checks)
  const tone = scoreTone(score)
  const cls =
    tone === 'green' ? 'pill scoreGreen' : tone === 'amber' ? 'pill scoreAmber' : 'pill scoreRed'
  return (
    <span className={cls} title={`${responded}/${total} checks responded`}>
      Activity Score: {score}%
    </span>
  )
}

