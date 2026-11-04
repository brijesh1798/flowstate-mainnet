'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from './Providers'
import { short } from '../lib/arc'

const links = [
  { href: '/', label: 'Network' },
  { href: '/swap', label: 'Swap' },
  { href: '/liquidity', label: 'Liquidity' },
  { href: '/activity', label: 'Activity' },
]

export default function Header() {
  const { account, onArc, connect, switchToArc } = useWallet()
  const path = usePathname()

  let btn
  if (!account) btn = <button className="btn btn-sm" onClick={() => connect().catch(() => {})}>Connect wallet</button>
  else if (!onArc) btn = <button className="btn btn-sm warn" onClick={() => switchToArc().catch(() => {})}>Switch to Arc</button>
  else btn = <span className="chip">{short(account)}</span>

  return (
    <header className="header">
      <div className="header-top">
        <Link href="/" className="logo">
          <span className="logo-mark">F</span>
          <span>FLOWSTATE</span>
        </Link>
        {btn}
      </div>
      <nav className="nav">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
