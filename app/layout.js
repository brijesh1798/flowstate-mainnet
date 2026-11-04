import './globals.css'
import Providers from '../components/Providers'
import Header from '../components/Header'

export const metadata = {
  title: 'Flowstate Mainnet — Arc Liquidity Intelligence',
  description: 'USDC / EURC swaps, liquidity and activity on Arc Mainnet.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="main">{children}</main>
          <footer className="footer">FLOWSTATE · ARC MAINNET · CHAIN 5042</footer>
        </Providers>
      </body>
    </html>
  )
}
