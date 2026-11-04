import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  parseAbi,
  parseAbiItem,
  formatUnits,
} from 'viem'

export const RPCS = [
  'https://rpc.mainnet.arc.io',
  'https://rpc.drpc.mainnet.arc.io',
  'https://rpc.quicknode.mainnet.arc.io',
  'https://rpc.blockdaemon.mainnet.arc.io',
]

export const arc = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: RPCS } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' } },
})

export const EXPLORER = 'https://explorer.arc.io'

export const ADDR = {
  USDC: '0x3600000000000000000000000000000000000000',
  EURC: '0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1',
  FACTORY: '0xf0db7b58379503491d857db50ac9ece64c653918',
  ROUTER: '0x53bf6b0684ec7ef91e1387da3d1a1769bc5a6f77',
  QUOTER: '0x7dfd4f31be6814d2906bde155c3e1b146eac1468',
  NPM: '0x39654a85a4c05127f5fd6ed22caec077a0fb1377',
}

export const FEES = [100, 500, 3000, 10000]
export const SPACING = { 100: 1, 500: 10, 3000: 60, 10000: 200 }
export const MAX128 = 2n ** 128n - 1n
export const ZERO = '0x0000000000000000000000000000000000000000'

export const USDC_IS_TOKEN0 = BigInt(ADDR.USDC) < BigInt(ADDR.EURC)
export const TOKEN0 = USDC_IS_TOKEN0 ? ADDR.USDC : ADDR.EURC
export const TOKEN1 = USDC_IS_TOKEN0 ? ADDR.EURC : ADDR.USDC
export const SYM0 = USDC_IS_TOKEN0 ? 'USDC' : 'EURC'
export const SYM1 = USDC_IS_TOKEN0 ? 'EURC' : 'USDC'
export const TOKENS = { USDC: ADDR.USDC, EURC: ADDR.EURC }

export const publicClient = createPublicClient({
  chain: arc,
  transport: fallback(RPCS.map((u) => http(u))),
})

/* ---------- ABIs ---------- */
export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
])

export const factoryAbi = parseAbi([
  'function getPool(address,address,uint24) view returns (address)',
])

export const poolAbi = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick)',
  'function liquidity() view returns (uint128)',
])

export const swapEvent = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)'
)

export const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])

export const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
])

export const npmAbi = parseAbi([
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint256 amount0, uint256 amount1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
])

/* ---------- helpers ---------- */
export const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '')

export function fmt(raw, dp = 4) {
  const n = Number(formatUnits(raw, 6))
  return n.toLocaleString('en-US', { maximumFractionDigits: dp })
}

export const feeLabel = (fee) => fee / 10000 + '%'

export function timeAgo(sec) {
  if (sec == null) return ''
  const d = Math.max(0, Math.floor(Date.now() / 1000) - sec)
  if (d < 60) return d + 's ago'
  if (d < 3600) return Math.floor(d / 60) + 'm ago'
  if (d < 86400) return Math.floor(d / 3600) + 'h ago'
  return Math.floor(d / 86400) + 'd ago'
}

export function priceEurcPerUsdc(pool) {
  const s = Number(pool.sqrtPriceX96) / 2 ** 96
  const p = s * s // token1 per token0
  return USDC_IS_TOKEN0 ? p : 1 / p
}

/* ---------- pools ---------- */
export async function loadPools() {
  const out = []
  await Promise.all(
    FEES.map(async (fee) => {
      try {
        const address = await publicClient.readContract({
          address: ADDR.FACTORY,
          abi: factoryAbi,
          functionName: 'getPool',
          args: [ADDR.USDC, ADDR.EURC, fee],
        })
        if (!address || address.toLowerCase() === ZERO) return
        const [slot, liquidity, usdc, eurc] = await Promise.all([
          publicClient.readContract({ address, abi: poolAbi, functionName: 'slot0' }),
          publicClient.readContract({ address, abi: poolAbi, functionName: 'liquidity' }),
          publicClient.readContract({ address: ADDR.USDC, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
          publicClient.readContract({ address: ADDR.EURC, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
        ])
        out.push({ fee, address, sqrtPriceX96: slot[0], tick: Number(slot[1]), liquidity, usdc, eurc })
      } catch (e) {
        /* pool nahi hai ya read fail: skip */
      }
    })
  )
  return out.sort((a, b) => a.fee - b.fee)
}

/* ---------- recent swaps ---------- */
async function getChunk(addresses, from, to) {
  try {
    return await publicClient.getLogs({ address: addresses, event: swapEvent, fromBlock: from, toBlock: to })
  } catch (e) {
    const out = []
    const SUB = 2000n
    for (let s = from; s <= to; s += SUB) {
      const e2 = s + SUB - 1n > to ? to : s + SUB - 1n
      try {
        out.push(...(await publicClient.getLogs({ address: addresses, event: swapEvent, fromBlock: s, toBlock: e2 })))
      } catch (_) {}
    }
    return out
  }
}

export async function fetchSwaps(pools, want = 20) {
  if (!pools.length) return []
  const latest = await publicClient.getBlockNumber()
  const addresses = pools.map((p) => p.address)
  const feeBy = {}
  pools.forEach((p) => (feeBy[p.address.toLowerCase()] = p.fee))

  const STEP = 10000n
  const MAX_STEPS = 60
  let logs = []
  for (let i = 0; i < MAX_STEPS && logs.length < want; i += 4) {
    const batch = []
    for (let j = 0; j < 4 && i + j < MAX_STEPS; j++) {
      const to = latest - STEP * BigInt(i + j)
      if (to < 0n) break
      const from = to - STEP + 1n > 0n ? to - STEP + 1n : 0n
      batch.push(getChunk(addresses, from, to))
    }
    if (!batch.length) break
    const res = await Promise.all(batch)
    res.forEach((r) => logs.push(...r))
  }

  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1
    return (b.logIndex || 0) - (a.logIndex || 0)
  })
  logs = logs.slice(0, want)

  const uniq = [...new Set(logs.map((l) => l.blockNumber))]
  const times = {}
  await Promise.all(
    uniq.map(async (bn) => {
      try {
        const b = await publicClient.getBlock({ blockNumber: bn })
        times[bn.toString()] = Number(b.timestamp)
      } catch (_) {
        times[bn.toString()] = Math.floor(Date.now() / 1000) - Number(latest - bn) / 2
      }
    })
  )

  return logs.map((l) => {
    const a0 = l.args.amount0
    const a1 = l.args.amount1
    const sold0 = a0 > 0n
    return {
      key: l.transactionHash + ':' + l.logIndex,
      hash: l.transactionHash,
      time: times[l.blockNumber.toString()],
      from: sold0 ? SYM0 : SYM1,
      to: sold0 ? SYM1 : SYM0,
      amountIn: sold0 ? a0 : a1,
      amountOut: sold0 ? -a1 : -a0,
      trader: l.args.recipient,
      fee: feeBy[l.address.toLowerCase()],
    }
  })
}

/* ---------- liquidity math ---------- */
export function planPosition(pool, usdcRaw, range) {
  const spacing = SPACING[pool.fee]
  const s = Number(pool.sqrtPriceX96) / 2 ** 96
  const maxT = Math.floor(887272 / spacing) * spacing
  let tl
  let tu
  if (range === 'full') {
    tl = -maxT
    tu = maxT
  } else {
    const p = range / 100
    const price = s * s
    tl = Math.floor(Math.log(price * (1 - p)) / Math.log(1.0001) / spacing) * spacing
    tu = Math.ceil(Math.log(price * (1 + p)) / Math.log(1.0001) / spacing) * spacing
    if (tl > pool.tick) tl = Math.floor(pool.tick / spacing) * spacing
    if (tu <= pool.tick) tu = (Math.floor(pool.tick / spacing) + 1) * spacing
    tl = Math.max(tl, -maxT)
    tu = Math.min(tu, maxT)
  }
  const sa = Math.pow(1.0001, tl / 2)
  const sb = Math.pow(1.0001, tu / 2)
  const x = Number(usdcRaw)
  let a0
  let a1
  if (USDC_IS_TOKEN0) {
    const L = x / (1 / s - 1 / sb)
    a0 = x
    a1 = L * (s - sa) * 1.005
  } else {
    const L = x / (s - sa)
    a1 = x
    a0 = L * (1 / s - 1 / sb) * 1.005
  }
  const amount0 = BigInt(Math.floor(a0))
  const amount1 = BigInt(Math.floor(a1))
  return {
    tickLower: tl,
    tickUpper: tu,
    amount0,
    amount1,
    usdc: USDC_IS_TOKEN0 ? amount0 : amount1,
    eurc: USDC_IS_TOKEN0 ? amount1 : amount0,
  }
}

export function positionAmounts(pos, pool) {
  if (!pool) return null
  const s = Number(pool.sqrtPriceX96) / 2 ** 96
  const sa = Math.pow(1.0001, pos.tickLower / 2)
  const sb = Math.pow(1.0001, pos.tickUpper / 2)
  const L = Number(pos.liquidity)
  let x = 0
  let y = 0
  if (s <= sa) x = L * (1 / sa - 1 / sb)
  else if (s >= sb) y = L * (sb - sa)
  else {
    x = L * (1 / s - 1 / sb)
    y = L * (s - sa)
  }
  return {
    usdc: BigInt(Math.floor(USDC_IS_TOKEN0 ? x : y)),
    eurc: BigInt(Math.floor(USDC_IS_TOKEN0 ? y : x)),
  }
}

/* ---------- user positions ---------- */
export async function loadPositions(owner) {
  const n = await publicClient.readContract({
    address: ADDR.NPM,
    abi: npmAbi,
    functionName: 'balanceOf',
    args: [owner],
  })
  const count = Math.min(Number(n), 60)
  const ids = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      publicClient.readContract({
        address: ADDR.NPM,
        abi: npmAbi,
        functionName: 'tokenOfOwnerByIndex',
        args: [owner, BigInt(i)],
      })
    )
  )
  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        const p = await publicClient.readContract({
          address: ADDR.NPM,
          abi: npmAbi,
          functionName: 'positions',
          args: [id],
        })
        const t0 = p[2].toLowerCase()
        const t1 = p[3].toLowerCase()
        if (t0 !== TOKEN0 || t1 !== TOKEN1) return null
        const pos = {
          id,
          fee: Number(p[4]),
          tickLower: Number(p[5]),
          tickUpper: Number(p[6]),
          liquidity: p[7],
          owed0: p[10],
          owed1: p[11],
        }
        if (pos.liquidity === 0n && pos.owed0 === 0n && pos.owed1 === 0n) return null
        let f0 = pos.owed0
        let f1 = pos.owed1
        try {
          const sim = await publicClient.simulateContract({
            account: owner,
            address: ADDR.NPM,
            abi: npmAbi,
            functionName: 'collect',
            args: [{ tokenId: id, recipient: owner, amount0Max: MAX128, amount1Max: MAX128 }],
          })
          f0 = sim.result[0]
          f1 = sim.result[1]
        } catch (_) {}
        pos.feeUsdc = USDC_IS_TOKEN0 ? f0 : f1
        pos.feeEurc = USDC_IS_TOKEN0 ? f1 : f0
        return pos
      } catch (_) {
        return null
      }
    })
  )
  return rows.filter(Boolean)
}
