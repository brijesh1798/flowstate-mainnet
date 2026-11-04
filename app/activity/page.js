'use client'
import { useState } from 'react'
import RecentSwaps from '../../components/RecentSwaps'
import { useWallet } from '../../components/Providers'

export default function ActivityPage() {
  const { account } = useWallet()
  const [onlyMine, setOnlyMine] = useState(false)

  return (
    <div>
      <h1>Activity</h1>
      <p className="lead">USDC / EURC pools ke recent on-chain swaps (Arc Mainnet).</p>
      {account && (
        <div className="seg">
          <button className={!onlyMine ? 'on' : ''} onClick={() => setOnlyMine(false)}>All swaps</button>
          <button className={onlyMine ? 'on' : ''} onClick={() => setOnlyMine(true)}>My swaps</button>
        </div>
      )}
      <div className="card">
        <RecentSwaps limit={30} mine={onlyMine ? account : null} />
      </div>
    </div>
  )
}
