'use client'
import { EXPLORER, short } from '../lib/arc'

function deepLinks() {
  const url = window.location.href
  const noProto = url.replace(/^https?:\/\//, '')
  const enc = encodeURIComponent(url)
  return [
    { name: 'MetaMask', href: 'https://metamask.app.link/dapp/' + noProto },
    { name: 'OKX Wallet', href: 'okx://wallet/dapp/url?dappUrl=' + enc },
    { name: 'Bitget Wallet', href: 'https://bkcode.vip?action=dapp&url=' + enc },
    { name: 'Trust Wallet', href: 'https://link.trustwallet.com/open_url?coin_id=60&url=' + enc },
    { name: 'Coinbase Wallet', href: 'https://go.cb-w.com/dapp?cb_url=' + enc },
  ]
}

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
  const deep = !wallets.length && !account ? deepLinks() : []

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
            {wallets.length > 0 &&
              wallets.map((w) => (
                <button key={w.id} className="wallet-btn" disabled={busyId !== null} onClick={() => onPick(w)}>
                  {w.icon ? (
                    <img src={w.icon} alt="" />
                  ) : (
                    <span className="wallet-ico">{w.name.slice(0, 1)}</span>
                  )}
                  <span>{busyId === w.id ? 'Connecting…' : w.name}</span>
                </button>
              ))}

            {wallets.length === 0 && (
              <div>
                <p className="muted">
                  No wallet detected in this browser. Open this site inside your wallet app:
                </p>
                {deep.map((d) => (
                  <a key={d.name} className="deep" href={d.href}>
                    Open in {d.name}
                  </a>
                ))}
                <p className="muted small">
                  Already have a wallet app? You can also open its built-in browser and paste this site link there.
                </p>
              </div>
            )}

            {wallets.length > 0 && (
              <p className="muted small" style={{ marginTop: 12 }}>
                Do not see your wallet? Open this site inside your wallet app&apos;s built-in browser.
              </p>
            )}

            {error && <div className="status err">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
          }
