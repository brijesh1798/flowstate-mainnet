'use client'
import { useState } from 'react'
import { EXPLORER, short } from '../lib/arc'

const CATALOG = [
  {
    key: 'metamask', name: 'MetaMask', domain: 'metamask.io', match: /metamask/i,
    install: 'https://metamask.io/download/',
    deep: (u) => 'https://metamask.app.link/dapp/' + u.noProto,
  },
  {
    key: 'rabby', name: 'Rabby Wallet', domain: 'rabby.io', match: /rabby/i,
    install: 'https://rabby.io/', deep: null,
  },
  {
    key: 'okx', name: 'OKX Wallet', domain: 'okx.com', match: /okx|okex/i,
    install: 'https://www.okx.com/web3',
    deep: (u) => 'https://www.okx.com/download?deeplink=' + encodeURIComponent('okx://wallet/dapp/url?dappUrl=' + u.enc),
  },
  {
    key: 'bitget', name: 'Bitget Wallet', domain: 'bitget.com', match: /bitget|bitkeep/i,
    install: 'https://web3.bitget.com/en/wallet-download',
    deep: (u) => 'https://bkcode.vip?action=dapp&url=' + u.enc,
  },
  {
    key: 'trust', name: 'Trust Wallet', domain: 'trustwallet.com', match: /trust/i,
    install: 'https://trustwallet.com/download',
    deep: (u) => 'https://link.trustwallet.com/open_url?coin_id=60&url=' + u.enc,
  },
  {
    key: 'coinbase', name: 'Coinbase Wallet', domain: 'coinbase.com', match: /coinbase/i,
    install: 'https://www.coinbase.com/wallet/downloads',
    deep: (u) => 'https://go.cb-w.com/dapp?cb_url=' + u.enc,
  },
  {
    key: 'phantom', name: 'Phantom', domain: 'phantom.app', match: /phantom/i,
    install: 'https://phantom.app/download',
    deep: (u) => 'https://phantom.app/ul/browse/' + u.enc + '?ref=' + encodeURIComponent(u.origin),
  },
  {
    key: 'rainbow', name: 'Rainbow', domain: 'rainbow.me', match: /rainbow/i,
    install: 'https://rainbow.me/download', deep: null,
  },
  {
    key: 'zerion', name: 'Zerion', domain: 'zerion.io', match: /zerion/i,
    install: 'https://zerion.io/download', deep: null,
  },
  {
    key: 'safepal', name: 'SafePal', domain: 'safepal.com', match: /safepal/i,
    install: 'https://www.safepal.com/download', deep: null,
  },
  {
    key: 'tokenpocket', name: 'TokenPocket', domain: 'tokenpocket.pro', match: /tokenpocket/i,
    install: 'https://www.tokenpocket.pro/en/download/app', deep: null,
  },
]

const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

function Icon({ src, label }) {
  const [bad, setBad] = useState(false)
  if (!src || bad) return <span className="wallet-ico">{(label || '?').slice(0, 1)}</span>
  return <img src={src} alt="" width="32" height="32" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

const matches = (w, c) => c.match.test(w.id || '') || c.match.test(w.name || '')

export default function WalletModal({
  open,
  onClose,
  wallets,
  onPick,
  busyId,
  error,
  account,
  walletName,
  onArc,
  switchToArc,
  disconnect,
}) {
  if (!open) return null

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  function openOutside(c) {
    const href = window.location.href
    const u = {
      noProto: href.replace(/^https?:\/\//, ''),
      enc: encodeURIComponent(href),
      origin: window.location.origin,
    }
    if (isMobile && c.deep) window.location.href = c.deep(u)
    else window.open(c.install, '_blank', 'noopener')
  }

  const used = new Set()
  const rows = CATALOG.map((c) => {
    const w = wallets.find((x) => matches(x, c))
    if (w) used.add(w)
    return { c, w }
  })
  const unknown = wallets.filter((w) => !used.has(w))
  const installed = rows.filter((r) => r.w)
  const missing = rows.filter((r) => !r.w)

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{account ? 'Wallet' : 'Connect wallet'}</h3>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {account ? (
          <div>
            <div className="kv"><span>Wallet</span><b>{walletName || 'Connected'}</b></div>
            <div className="kv"><span>Address</span><b>{short(account)}</b></div>
            <div className="kv"><span>Network</span><b>{onArc ? 'Arc Mainnet' : 'Wrong network'}</b></div>
            <div className="btn-row">
              {!onArc && (
                <button className="btn warn" onClick={() => switchToArc().catch(() => {})}>
                  Switch to Arc
                </button>
              )}
              <a className="btn ghost" href={`${EXPLORER}/address/${account}`} target="_blank" rel="noreferrer">
                Explorer ↗
              </a>
              <button className="btn ghost" onClick={disconnect}>Disconnect</button>
            </div>
          </div>
        ) : (
          <div>
            {unknown.map((w) => (
              <button key={w.id} className="wallet-btn" disabled={busyId !== null} onClick={() => onPick(w)}>
                <Icon src={w.icon} label={w.name} />
                <span>{busyId === w.id ? 'Connecting…' : w.name}</span>
                <span className="wtag on">Detected</span>
              </button>
            ))}

            {installed.map(({ c, w }) => (
              <button key={c.key} className="wallet-btn" disabled={busyId !== null} onClick={() => onPick(w)}>
                <Icon src={w.icon || favicon(c.domain)} label={c.name} />
                <span>{busyId === w.id ? 'Connecting…' : c.name}</span>
                <span className="wtag on">Detected</span>
              </button>
            ))}

            {missing.map(({ c }) => (
              <button key={c.key} className="wallet-btn" onClick={() => openOutside(c)}>
                <Icon src={favicon(c.domain)} label={c.name} />
                <span>{c.name}</span>
                <span className="wtag">{isMobile && c.deep ? 'Open app' : 'Install'}</span>
              </button>
            ))}

            <p className="muted small" style={{ marginTop: 12 }}>
              On mobile, tapping a wallet that is not detected opens this site inside that wallet app.
              Then tap Connect wallet again.
            </p>

            {error && <div className="status err">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
