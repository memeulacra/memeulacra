'use client'
import { Suspense } from 'react'
import MemeDisplay from './memeDisplay'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MemeDisplay />
    </Suspense>
  )
}
