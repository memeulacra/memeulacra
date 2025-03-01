import { ethers } from 'ethers'
import { useState } from 'react'
import MSIM_ABI from '@/app/api/agent/MsimToken.json'

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false)

  async function makePayment() {
    setIsLoading(true)
    // @ts-expect-error no types
    console.log('called.', window.ethereum)
    try {
      // @ts-expect-error no types
      if (typeof window !== 'undefined' && window.ethereum) {
        console.log('Sending transaction...')
        // @ts-expect-error no types
        const provider = new ethers.BrowserProvider(window.ethereum)
        console.log('Provider:', provider)
        const accounts: string[] = await provider.send('eth_requestAccounts', [])
        console.log('Accounts:', accounts)
        const signer = await provider.getSigner()
        console.log('Signer:', signer)
        const contract = new ethers.Contract('0x96BeEBB6bC25362baeE97d5a97157AE6314219ef', MSIM_ABI.abi, signer)
        
        const amount = ethers.parseUnits('4', 18)
        const tx = await contract.transfer('0x96BeEBB6bC25362baeE97d5a97157AE6314219ef', amount)
        await tx.wait() // Wait for confirmation
      }
    } catch (error) {
      console.error('Error sending transaction:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return { makePayment, isLoading }
}
