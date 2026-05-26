import { Header } from '@/components/blocks/header'
import { isAuthenticated } from '@/lib/actions'
import { ReactNode } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
  const loggedIn = await isAuthenticated()
  return (
    <div className="w-full">
      <Header loggedIn={loggedIn} />
      {children}
    </div>
  )
}