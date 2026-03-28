import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReactNode, Suspense } from 'react'

export default async function DashboardLayout({
  children
}: {
  children: ReactNode,
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <Suspense>
        <TooltipProvider>
          <AppSidebar variant="inset" />
        </TooltipProvider>
      </Suspense>
      <SidebarInset>
        <Suspense fallback={<p>loading</p>}>
          {children}
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}