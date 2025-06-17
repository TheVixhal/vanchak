import type React from "react"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-transparent">
        <div className="w-screen h-screen">{children}</div>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.dev'
    };
