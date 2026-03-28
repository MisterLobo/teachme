import { Header } from "@/components/blocks/header";
import { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <Header />
      {children}
    </div>
  )
}