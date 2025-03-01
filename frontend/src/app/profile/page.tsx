'use client'
import { Suspense } from 'react'
import Profile from './profile'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Profile />
    </Suspense>
  )
}
