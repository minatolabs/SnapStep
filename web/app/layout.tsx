import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SnapStep - Guide Editor',
  description: 'Create and edit step-by-step guides',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


