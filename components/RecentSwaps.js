'use client'
import { useEffect, useState } from 'react'
import { EXPLORER, feeLabel, fetchSwaps, fmt, loadPools, short, timeAgo } from '../lib/arc'

export default function RecentSwaps({ limit = 10, mine = null }) {
  const [items, setItems] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let dead = false
    async function run() {
      try {
        const pools = await loadPools()
        let swaps = await fetchSwaps(pools, mine ? 100 : limit)
        if (mine) swaps = swaps.filter((s) => s.trader.toLowerCase() === mine.toLowerCase())
        if (!dead) {
          setItems(swaps)
          setErr('')
        }
      } catch (e) {
        if (!dead) setErr('Swaps load nahi ho paaye. Thodi der baad refresh karo.')
      }
    }
    run()
    const t = mine ? null : setInterval(run, 60000)
    return () => {
      dead = true
      if (t) clearInterval(t)
    }
  }, [limit, mine])

  if (err) return <p className="muted">{err}</p>
  if (!items) return <p className="muted">Loading swaps…</p>
  if (!items.length) return <p className="muted">Pichhle ~3 din me koi swap nahi mila.</p>

  return (
    <div className="list">
      {items.map((s) => (
        <a key={s.key} className="row" href={`${EXPLORER}/tx/${s.hash}`} target="_blank" rel="noreferrer">
          <div>
            <div className="row-main">
              {fmt(s.amountIn, 2)} {s.from} → {fmt(s.amountOut, 2)} {s.to}
            </div>
            <div className="muted small">
              {short(s.trader)} · pool {feeLabel(s.fee)}
            </div>
          </div>
          <div className="muted small">{timeAgo(s.time)} ↗</div>
        </a>
      ))}
    </div>
  )
}
