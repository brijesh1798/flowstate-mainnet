'use client'
import { useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { ADDR, EXPLORER, TOKENS, erc20Abi, feeLabel, fmt, loadPools, publicClient, quoterAbi, routerAbi } from '../../lib/arc'
import { useWallet } from '../../components/Providers'

export default function SwapPage() {
  const { account, onArc, connect, switchToArc, write } = useWallet()
  const [from, setFrom] = useState('USDC')
  const to = from === 'USDC' ? 'EURC' : 'USDC'
  const [amount, setAmount] = useState('')
  const [slip, setSlip] = useState(0.5)
  const [pools, setPools] = useState([])
  const [bal, setBal] = useState({ USDC: 0n, EURC: 0n })
  const [quote, setQuote] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [isErr, setIsErr] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [tick, setTick] = useState(0)

  const amountRaw = useMemo(() => {
    try {
      if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return 0n
      return parseUnits(amount, 6)
    } catch (e) {
      return 0n
    }
  }, [amount])

  useEffect(() => {
    loadPools().then(setPools).catch(() => {})
  }, [])

  useEffect(() => {
    if (!account) return
    let dead = false
    Promise.all([
      publicClient.readContract({ address: ADDR.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      publicClient.readContract({ address: ADDR.EURC, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
    ])
      .then(([u, e]) => !dead && setBal({ USDC: u, EURC: e }))
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [account, tick])

  useEffect(() => {
    setQuote(null)
    if (amountRaw <= 0n || !pools.length) return
    let dead = false
    setQuoting(true)
    const t = setTimeout(async () => {
      const results = await Promise.all(
        pools
          .filter((p) => p.liquidity > 0n)
          .map(async (p) => {
            try {
              const { result } = await publicClient.simulateContract({
                address: ADDR.QUOTER,
                abi: quoterAbi,
                functionName: 'quoteExactInputSingle',
                args: [{ tokenIn: TOKENS[from], tokenOut: TOKENS[to], amountIn: amountRaw, fee: p.fee, sqrtPriceLimitX96: 0n }],
              })
              return { fee: p.fee, out: result[0] }
            } catch (e) {
              return null
            }
          })
      )
      if (dead) return
      const best = results.filter(Boolean).sort((a, b) => (b.out > a.out ? 1 : b.out < a.out ? -1 : 0))[0]
      setQuote(best || null)
      setQuoting(false)
    }, 400)
    return () => {
      dead = true
      clearTimeout(t)
    }
  }, [amountRaw, from, pools])

  const minOut = quote ? (quote.out * BigInt(10000 - Math.round(slip * 100))) / 10000n : 0n
  const insufficient = amountRaw > bal[from]

  async function doSwap() {
    setBusy(true)
    setIsErr(false)
    setTxHash('')
    try {
      const allowance = await publicClient.readContract({
        address: TOKENS[from],
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, ADDR.ROUTER],
      })
      if (allowance < amountRaw) {
        setStatus('Step 1/2: Approve ' + from + ' in your wallet…')
        await write({ address: TOKENS[from], abi: erc20Abi, functionName: 'approve', args: [ADDR.ROUTER, amountRaw] })
      }
      setStatus('Step 2/2: Confirm the swap in your wallet…')
      const hash = await write({
        address: ADDR.ROUTER,
        abi: routerAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: TOKENS[from],
            tokenOut: TOKENS[to],
            fee: quote.fee,
            recipient: account,
            amountIn: amountRaw,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0n,
          },
        ],
      })
      setTxHash(hash)
      setStatus('Swap complete ✅')
      setAmount('')
      setTick((x) => x + 1)
    } catch (e) {
      setIsErr(true)
      setStatus((e && (e.shortMessage || e.message)) || 'Swap failed')
    }
    setBusy(false)
  }

  let action
  if (!account) action = <button className="btn" onClick={connect}>Connect wallet</button>
  else if (!onArc) action = <button className="btn warn" onClick={() => switchToArc().catch(() => {})}>Switch to Arc Mainnet</button>
  else if (amountRaw <= 0n) action = <button className="btn" disabled>Enter amount</button>
  else if (insufficient) action = <button className="btn" disabled>Insufficient {from}</button>
  else if (!quote) action = <button className="btn" disabled>{quoting ? 'Getting quote…' : 'No route / liquidity'}</button>
  else action = <button className="btn" disabled={busy} onClick={doSwap}>{busy ? 'Processing…' : 'Swap'}</button>

  return (
    <div>
      <h1>Swap</h1>
      <p className="lead">USDC ↔ EURC · Arc Mainnet · Uniswap v3</p>
      <div className="notice">This is real Arc Mainnet. Test with a small amount (like 1 USDC) first.</div>

      <div className="card">
        <div className="field">
          <div className="field-top">
            <span>You pay</span>
            <span>
              Balance: {fmt(bal[from], 4)}{' '}
              <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setAmount(formatUnits(bal[from], 6))}>MAX</a>
            </span>
          </div>
          <div className="field-row">
            <input inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
            <span className="token">{from}</span>
          </div>
        </div>

        <button className="flip" onClick={() => { setFrom(to); setAmount('') }}>↓</button>

        <div className="field">
          <div className="field-top">
            <span>You receive (estimated)</span>
            <span>Balance: {fmt(bal[to], 4)}</span>
          </div>
          <div className="field-row">
            <input readOnly placeholder="0.0" value={quote ? formatUnits(quote.out, 6) : ''} />
            <span className="token">{to}</span>
          </div>
        </div>

        <div className="stat-label">SLIPPAGE</div>
        <div className="seg">
          {[0.1, 0.5, 1].map((s) => (
            <button key={s} className={slip === s ? 'on' : ''} onClick={() => setSlip(s)}>{s}%</button>
          ))}
        </div>

        {quote && (
          <div>
            <div className="kv"><span>Route</span><b>Uniswap v3 · {feeLabel(quote.fee)} pool</b></div>
            <div className="kv"><span>Minimum received</span><b>{fmt(minOut, 6)} {to}</b></div>
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
    </div>
  )
}
