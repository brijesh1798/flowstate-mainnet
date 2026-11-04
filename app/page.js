'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { feeLabel, fmt, loadPools, priceEurcPerUsdc, publicClient } from '../lib/arc'
import RecentSwaps from '../components/RecentSwaps'

export default function Home() {
  const [pools, setPools] = useState(null)
  const [block, setBlock] = useState(null)

  useEffect(() => {
    let dead = false
    async function run() {
      try {
        const [p, b] = await Promise.all([loadPools(), publicClient.getBlockNumber()])
        if (!dead) {
          setPools(p)
          setBlock(b)
        }
      } catch (e) {
        if (!dead) setPools([])
      }
    }
    run()
    const t = setInterval(run, 30000)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [])

  return (
    <div>
      <span className="badge">
        ARC MAINNET · CHAIN 5042 · {block ? 'BLOCK ' + block.toString() : '…'}
      </span>
      <h1>
        Follow the <em>flow of capital.</em>
      </h1>
      <p className="lead">
        Flowstate Arc Mainnet pe USDC / EURC ke swaps, pools aur liquidity ko ek jagah dikhata hai.
      </p>
      <div className="btn-row">
        <Link href="/swap" className="btn">Open swap ↗</Link>
        <Link href="/liquidity" className="btn ghost">Add liquidity</Link>
      </div>

      <h2>Pools</h2>
      {!pools && <p className="muted">Loading pools…</p>}
      {pools && !pools.length && <p className="muted">Abhi koi USDC/EURC pool nahi mila.</p>}
      {pools &&
        pools.map((p) => (
          <div className="card" key={p.fee}>
            <div className="pos-head">
              <b>USDC / EURC</b>
              <span className="pill">{feeLabel(p.fee)} fee</span>
            </div>
            <div className="grid2">
              <div>
                <div className="stat-label">RESERVE (USDC)</div>
                <div className="stat-val">{fmt(p.usdc, 2)}</div>
              </div>
              <div>
                <div className="stat-label">RESERVE (EURC)</div>
                <div className="stat-val">{fmt(p.eurc, 2)}</div>
              </div>
              <div>
                <div className="stat-label">1 USDC =</div>
                <div className="stat-val">{priceEurcPerUsdc(p).toFixed(4)} EURC</div>
              </div>
              <div>
                <div className="stat-label">1 EURC =</div>
                <div className="stat-val">{(1 / priceEurcPerUsdc(p)).toFixed(4)} USDC</div>
              </div>
            </div>
            <div className="btn-row">
              <Link href="/liquidity" className="btn ghost">Manage liquidity ›</Link>
              <Link href="/swap" className="btn ghost">Swap ›</Link>
            </div>
          </div>
        ))}

      <h2>Recent swaps</h2>
      <div className="card">
        <RecentSwaps limit={8} />
      </div>
    </div>
  )
}
