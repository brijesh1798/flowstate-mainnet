'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { arc, publicClient } from '../lib/arc'
import WalletModal from './WalletModal'

const Ctx = createContext(null)
export const useWallet = () => useContext(Ctx)

const toNum = (c) => (typeof c === 'string' ? parseInt(c, c.startsWith('0x') ? 16 : 10) : Number(c))

function guessName(p) {
  if (p.isRabby) return 'Rabby'
  if (p.isOkxWallet || p.isOKExWallet) return 'OKX Wallet'
  if (p.isBitKeep || p.isBitget) return 'Bitget Wallet'
  if (p.isTrust || p.isTrustWallet) return 'Trust Wallet'
  if (p.isCoinbaseWallet) return 'Coinbase Wallet'
  if (p.isPhantom) return 'Phantom'
  if (p.isRainbow) return 'Rainbow'
  if (p.isSafePal) return 'SafePal'
  if (p.isTokenPocket) return 'TokenPocket'
  if (p.isMetaMask) return 'MetaMask'
  return 'Browser wallet'
}

function legacyWallets() {
  const out = []
  const push = (provider, name) => {
    if (!provider || typeof provider.request !== 'function') return
    if (out.some((o) => o.provider === provider)) return
    out.push({ id: 'legacy-' + name, name, icon: null, provider })
  }
  const eth = window.ethereum
  if (eth && Array.isArray(eth.providers) && eth.providers.length) {
    eth.providers.forEach((p) => push(p, guessName(p)))
  } else if (eth) {
    push(eth, guessName(eth))
  }
  push(window.okxwallet, 'OKX Wallet')
  push(window.bitkeep && window.bitkeep.ethereum, 'Bitget Wallet')
  push(window.trustwallet, 'Trust Wallet')
  push(window.phantom && window.phantom.ethereum, 'Phantom')
  return out
}

export default function Providers({ children }) {
  const [wallets, setWallets] = useState([])
  const [active, setActive] = useState(null)
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  /* find installed wallets (EIP-6963 + legacy injected providers) */
  useEffect(() => {
    const add = (w) => {
      setWallets((prev) => {
        const nm = (w.name || '').toLowerCase()
        if (prev.some((p) => p.provider === w.provider || (p.name || '').toLowerCase() === nm)) return prev
        return [...prev, w]
      })
    }
    const onAnnounce = (e) => {
      const d = e.detail || {}
      if (!d.provider) return
      const info = d.info || {}
      add({
        id: info.rdns || info.uuid || info.name || 'wallet',
        name: info.name || 'Wallet',
        icon: info.icon || null,
        provider: d.provider,
      })
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    const t1 = setTimeout(() => legacyWallets().forEach(add), 600)
    const t2 = setTimeout(() => {
      window.dispatchEvent(new Event('eip6963:requestProvider'))
      legacyWallets().forEach(add)
    }, 2000)
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  /* silently reconnect the last used wallet */
  useEffect(() => {
    if (active) return
    let saved = null
    try {
      saved = localStorage.getItem('fs_wallet')
    } catch (_) {}
    if (!saved) return
    const w = wallets.find((x) => x.id === saved)
    if (!w) return
    let dead = false
    w.provider
      .request({ method: 'eth_accounts' })
      .then(async (accs) => {
        if (dead || !accs || !accs.length) return
        const cid = await w.provider.request({ method: 'eth_chainId' })
        if (dead) return
        setActive(w)
        setAccount(accs[0])
        setChainId(toNum(cid))
      })
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [wallets, active])

  /* listen to account / network changes of the connected wallet */
  useEffect(() => {
    if (!active) return
    const p = active.provider
    const onAcc = (a) => {
      if (!a || !a.length) {
        setActive(null)
        setAccount(null)
        setChainId(null)
      } else {
        setAccount(a[0])
      }
    }
    const onChain = (c) => setChainId(toNum(c))
    p.on && p.on('accountsChanged', onAcc)
    p.on && p.on('chainChanged', onChain)
    return () => {
      p.removeListener && p.removeListener('accountsChanged', onAcc)
      p.removeListener && p.removeListener('chainChanged', onChain)
    }
  }, [active])

  const connect = useCallback(() => {
    setError('')
    setOpen(true)
  }, [])

  const pick = useCallback(async (w) => {
    setError('')
    setBusyId(w.id)
    try {
      const accs = await w.provider.request({ method: 'eth_requestAccounts' })
      const cid = await w.provider.request({ method: 'eth_chainId' })
      if (!accs || !accs.length) throw new Error('No account returned by the wallet.')
      setActive(w)
      setAccount(accs[0])
      setChainId(toNum(cid))
      try {
        localStorage.setItem('fs_wallet', w.id)
      } catch (_) {}
      setOpen(false)
    } catch (e) {
      setError(
        e && e.code === 4001
          ? 'Connection request was rejected.'
          : (e && (e.shortMessage || e.message)) || 'Could not connect to this wallet.'
      )
    }
    setBusyId(null)
  }, [])

  const disconnect = useCallback(() => {
    setActive(null)
    setAccount(null)
    setChainId(null)
    try {
      localStorage.removeItem('fs_wallet')
    } catch (_) {}
    setOpen(false)
  }, [])

  const switchToArc = useCallback(async () => {
    if (!active) return
    const p = active.provider
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x13b2' }] })
    } catch (e) {
      if (e && (e.code === 4902 || /unrecognized|not added|add/i.test(e.message || ''))) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x13b2',
              chainName: 'Arc',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
              rpcUrls: ['https://rpc.mainnet.arc.io'],
              blockExplorerUrls: ['https://explorer.arc.io'],
            },
          ],
        })
      } else {
        throw e
      }
    }
  }, [active])

  const write = useCallback(
    async ({ address, abi, functionName, args }) => {
      if (!active || !account) throw new Error('Wallet not connected.')
      const wc = createWalletClient({ account, chain: arc, transport: custom(active.provider) })
      const hash = await wc.writeContract({ address, abi, functionName, args })
      const r = await publicClient.waitForTransactionReceipt({ hash })
      if (r.status !== 'success') throw new Error('Transaction failed: ' + hash)
      return hash
    },
    [active, account]
  )

  const value = {
    account,
    chainId,
    onArc: chainId === 5042,
    walletName: active ? active.name : '',
    connect,
    disconnect,
    switchToArc,
    write,
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <WalletModal
        open={open}
        onClose={() => setOpen(false)}
        wallets={wallets}
        onPick={pick}
        busyId={busyId}
        error={error}
        account={account}
        walletName={active ? active.name : ''}
        onArc={chainId === 5042}
        switchToArc={switchToArc}
        disconnect={disconnect}
      />
    </Ctx.Provider>
  )
}
