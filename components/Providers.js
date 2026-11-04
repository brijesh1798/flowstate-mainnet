'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { arc, publicClient } from '../lib/arc'

const Ctx = createContext(null)
export const useWallet = () => useContext(Ctx)

export default function Providers({ children }) {
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [hasWallet, setHasWallet] = useState(false)

  useEffect(() => {
    let cleanup = () => {}
    let timer
    function init() {
      const eth = window.ethereum
      if (!eth) return false
      setHasWallet(true)
      eth.request({ method: 'eth_accounts' }).then((a) => setAccount(a[0] || null)).catch(() => {})
      eth.request({ method: 'eth_chainId' }).then((c) => setChainId(parseInt(c, 16))).catch(() => {})
      const onAcc = (a) => setAccount(a[0] || null)
      const onChain = (c) => setChainId(parseInt(c, 16))
      eth.on && eth.on('accountsChanged', onAcc)
      eth.on && eth.on('chainChanged', onChain)
      cleanup = () => {
        eth.removeListener && eth.removeListener('accountsChanged', onAcc)
        eth.removeListener && eth.removeListener('chainChanged', onChain)
      }
      return true
    }
    if (!init()) timer = setTimeout(init, 1200)
    return () => {
      clearTimeout(timer)
      cleanup()
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('Wallet nahi mila. MetaMask / Rabby / Trust Wallet ke in-app browser me ye site kholo.')
      return
    }
    const a = await window.ethereum.request({ method: 'eth_requestAccounts' })
    setAccount(a[0] || null)
    const c = await window.ethereum.request({ method: 'eth_chainId' })
    setChainId(parseInt(c, 16))
    setHasWallet(true)
  }, [])

  const switchToArc = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) return
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x13b2' }] })
    } catch (e) {
      if (e && (e.code === 4902 || /unrecognized|not added|add/i.test(e.message || ''))) {
        await eth.request({
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
  }, [])

  const write = useCallback(
    async ({ address, abi, functionName, args }) => {
      const wc = createWalletClient({ account, chain: arc, transport: custom(window.ethereum) })
      const hash = await wc.writeContract({ address, abi, functionName, args })
      const r = await publicClient.waitForTransactionReceipt({ hash })
      if (r.status !== 'success') throw new Error('Transaction fail ho gaya: ' + hash)
      return hash
    },
    [account]
  )

  const value = {
    account,
    chainId,
    hasWallet,
    onArc: chainId === 5042,
    connect,
    switchToArc,
    write,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
