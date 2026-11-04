'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { encodeFunctionData, formatUnits, parseUnits } from 'viem'
import {
  ADDR, EXPLORER, MAX128, SYM0, SYM1, TOKEN0, TOKEN1,
  erc20Abi, feeLabel, fmt, loadPools, loadPositions, npmAbi,
  planPosition, positionAmounts, priceEurcPerUsdc, publicClient,
} from '../../lib/arc'
import { useWallet } from '../../components/Providers'

const RANGES = [
  { v: 'full', label: 'Full range' },
  { v: 5, label: '±5%' },
  { v: 1, label: '±1%' },
]

export default function LiquidityPage() {
  const { account, onArc, connect, switchToArc, write } = useWallet()
  const [pools, setPools] = useState([])
  const [fee, setFee] = useState(null)
  const [range, setRange] = useState('full')
  const [amount, setAmount] = useState('')
  const [bal, setBal] = useState({ USDC: 0n, EURC: 0n })
  const [positions, setPositions] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [isErr, setIsErr] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    loadPools()
      .then((p) => {
        setPools(p)
        if (p.length) {
          const best = [...p].sort((a, b) => (b.liquidity > a.liquidity ? 1 : -1))[0]
          setFee(best.fee)
        }
      })
      .catch(() => {})
  }, [tick])

  useEffect(() => {
    if (!account) {
      setPositions(null)
      return
    }
    let dead = false
    Promise.all([
      publicClient.readContract({ address: ADDR.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      publicClient.readContract({ address: ADDR.EURC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    ])
      .then(([u, e]) => !dead && setBal({ USDC: u, EURC: e }))
      .catch(() => {})
    loadPositions(account)
      .then((p) => !dead && setPositions(p))
      .catch(() => !dead && setPositions([]))
    return () => {
      dead = true
    }
  }, [account, tick])

  const pool = pools.find((p) => p.fee === fee)

  const usdcRaw = useMemo(() => {
    try {
      if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return 0n
      return parseUnits(amount, 6)
    } catch (e) {
      return 0n
    }
  }, [amount])

  const plan = useMemo(() => (pool && usdcRaw > 0n ? planPosition(pool, usdcRaw, range) : null), [pool, usdcRaw, range])

  const run = useCallback(async (fn) => {
    setBusy(true)
    setIsErr(false)
    setTxHash('')
    try {
      await fn()
      setTick((x) => x + 1)
    } catch (e) {
      setIsErr(true)
      setStatus((e && (e.shortMessage || e.message)) || 'Transaction fail ho gaya')
    }
    setBusy(false)
  }, [])

  async function ensureAllowance(token, need, label) {
    const cur = await publicClient.readContract({
      address: token, abi: erc20Abi, functionName: 'allowance', args: [account, ADDR.NPM],
    })
    if (cur < need) {
      setStatus(label + ' approve — wallet me confirm karo…')
      await write({ address: token, abi: erc20Abi, functionName: 'approve', args: [ADDR.NPM, need] })
    }
  }

  function addLiquidity() {
    return run(async () => {
      const a0 = plan.amount0
      const a1 = plan.amount1
      await ensureAllowance(TOKEN0, a0, SYM0)
      await ensureAllowance(TOKEN1, a1, SYM1)
      setStatus('Position mint — wallet me confirm karo…')
      const hash = await write({
        address: ADDR.NPM,
        abi: npmAbi,
        functionName: 'mint',
        args: [
          {
            token0: TOKEN0,
            token1: TOKEN1,
            fee: pool.fee,
            tickLower: plan.tickLower,
            tickUpper: plan.tickUpper,
            amount0Desired: a0,
            amount1Desired: a1,
            amount0Min: (a0 * 97n) / 100n,
            amount1Min: (a1 * 97n) / 100n,
            recipient: account,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          },
        ],
      })
      setTxHash(hash)
      setStatus('Liquidity add ho gayi ✅')
      setAmount('')
    })
  }

  function collectFees(pos) {
    return run(async () => {
      setStatus('Fees collect — wallet me confirm karo…')
      const hash = await write({
        address: ADDR.NPM,
        abi: npmAbi,
        functionName: 'collect',
        args: [{ tokenId: pos.id, recipient: account, amount0Max: MAX128, amount1Max: MAX128 }],
      })
      setTxHash(hash)
      setStatus('Fees collect ho gaye ✅')
    })
  }

  function removeLiquidity(pos, pct) {
    return run(async () => {
      const liq = (pos.liquidity * BigInt(pct)) / 100n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
      const data = [
        encodeFunctionData({
          abi: npmAbi,
          functionName: 'decreaseLiquidity',
          args: [{ tokenId: pos.id, liquidity: liq, amount0Min: 0n, amount1Min: 0n, deadline }],
        }),
        encodeFunctionData({
          abi: npmAbi,
          functionName: 'collect',
          args: [{ tokenId: pos.id, recipient: account, amount0Max: MAX128, amount1Max: MAX128 }],
        }),
      ]
      setStatus('Remove ' + pct + '% — wallet me confirm karo…')
      const hash = await write({ address: ADDR.NPM, abi: npmAbi, functionName: 'multicall', args: [data] })
      setTxHash(hash)
      setStatus('Liquidity remove ho gayi ✅')
    })
  }

  let action
  if (!account) action = <button className="btn" onClick={() => connect().catch(() => {})}>Connect wallet</button>
  else if (!onArc) action = <button className="btn warn" onClick={() => switchToArc().catch(() => {})}>Switch to Arc Mainnet</button>
  else if (!pool) action = <button className="btn" disabled>Pool nahi mila</button>
  else if (!plan) action = <button className="btn" disabled>Enter USDC amount</button>
  else if (plan.usdc > bal.USDC) action = <button className="btn" disabled>Insufficient USDC</button>
  else if (plan.eurc > bal.EURC) action = <button className="btn" disabled>Insufficient EURC</button>
  else action = <button className="btn" disabled={busy} onClick={addLiquidity}>{busy ? 'Processing…' : 'Add liquidity'}</button>

  return (
    <div>
      <h1>Liquidity</h1>
      <p className="lead">USDC / EURC pool me liquidity daalo aur trading fees kamao. Position ek Uniswap v3 NFT hoti hai.</p>
      <div className="notice">
        Real mainnet funds. Concentrated range (±1%, ±5%) me zyada fees milte hain, par price range ke bahar gaya to position fees kamana band kar deti hai. Full range sabse safe hai.
      </div>

      <div className="card">
        <div className="stat-label">FEE TIER</div>
        <div className="seg">
          {pools.map((p) => (
            <button key={p.fee} className={fee === p.fee ? 'on' : ''} onClick={() => setFee(p.fee)}>{feeLabel(p.fee)}</button>
          ))}
          {!pools.length && <span className="muted small">Loading pools…</span>}
        </div>

        <div className="stat-label">RANGE</div>
        <div className="seg">
          {RANGES.map((r) => (
            <button key={r.label} className={range === r.v ? 'on' : ''} onClick={() => setRange(r.v)}>{r.label}</button>
          ))}
        </div>

        <div className="field">
          <div className="field-top">
            <span>USDC amount</span>
            <span>
              Balance: {fmt(bal.USDC, 4)}{' '}
              <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setAmount(formatUnits(bal.USDC, 6))}>MAX</a>
            </span>
          </div>
          <div className="field-row">
            <input inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
            <span className="token">USDC</span>
          </div>
        </div>

        {pool && (
          <div className="kv"><span>Pool price</span><b>1 USDC = {priceEurcPerUsdc(pool).toFixed(4)} EURC</b></div>
        )}
        {plan && (
          <div>
            <div className="kv"><span>EURC needed</span><b>~{fmt(plan.eurc, 4)} EURC</b></div>
            <div className="kv"><span>EURC balance</span><b>{fmt(bal.EURC, 4)}</b></div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>{action}</div>

        {status && (
          <div className={'status' + (isErr ? ' err' : '')}>
            {status}{' '}
            {txHash && <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx ↗</a>}
          </div>
        )}
      </div>

      <h2>Your positions</h2>
      {!account && <p className="muted">Positions dekhne ke liye wallet connect karo.</p>}
      {account && !positions && <p className="muted">Loading positions…</p>}
      {account && positions && !positions.length && <p className="muted">Abhi koi USDC/EURC position nahi hai.</p>}
      {positions &&
        positions.map((pos) => {
          const pp = pools.find((p) => p.fee === pos.fee)
          const amts = positionAmounts(pos, pp)
          const inRange = pp ? pp.tick >= pos.tickLower && pp.tick < pos.tickUpper : null
          return (
            <div className="card" key={pos.id.toString()}>
              <div className="pos-head">
                <b>#{pos.id.toString()} · USDC / EURC · {feeLabel(pos.fee)}</b>
                {inRange !== null && <span className={'pill ' + (inRange ? 'in' : 'out')}>{inRange ? 'In range' : 'Out of range'}</span>}
              </div>
              {amts && (
                <div className="kv"><span>Liquidity (approx)</span><b>{fmt(amts.usdc, 2)} USDC + {fmt(amts.eurc, 2)} EURC</b></div>
              )}
              <div className="kv"><span>Unclaimed fees</span><b>{fmt(pos.feeUsdc, 4)} USDC + {fmt(pos.feeEurc, 4)} EURC</b></div>
              <div className="btn-row">
                <button className="btn ghost" disabled={busy || !onArc} onClick={() => collectFees(pos)}>Collect fees</button>
                <button className="btn ghost" disabled={busy || !onArc || pos.liquidity === 0n} onClick={() => removeLiquidity(pos, 50)}>Remove 50%</button>
                <button className="btn ghost" disabled={busy || !onArc || pos.liquidity === 0n} onClick={() => removeLiquidity(pos, 100)}>Remove 100%</button>
              </div>
            </div>
          )
        })}
    </div>
  )
}
