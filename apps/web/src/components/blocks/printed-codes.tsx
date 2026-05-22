import { useState } from 'react'
import { Button } from '../ui/button'
import { toast } from 'sonner'
import { Spinner } from '../ui/spinner'

export default function PrintedCodes({ codes }: { codes: string }) {
  const [busy, setBusy] = useState(false)
  const copyCodes = () => {
    setBusy(true)
    navigator.clipboard.writeText(codes)
    setTimeout(() => {
      setBusy(false)
      toast('copied to clipboard')
    }, 500)
  }

  return (
    <div className="flex flex-row justify-between gap-4 w-full items-center">
      <code className="uppercase text-xl">{codes}</code>
      <Button onClick={copyCodes} className="w-12">{busy ? <Spinner /> : 'copy'}</Button>
    </div>
  )
}