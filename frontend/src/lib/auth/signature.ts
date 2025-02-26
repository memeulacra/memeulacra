// File path: /lib/auth/signature.ts
import { ethers } from 'ethers'

/**
 * Verify an Ethereum signature against a wallet address and message
 * @param address The wallet address that supposedly signed the message
 * @param signature The signature to verify
 * @param nonce The nonce that was signed
 * @returns Whether the signature is valid
 */
export async function verifySignature(
  address: string,
  signature: string,
  nonce: string
): Promise<boolean> {
  try {
    // Format the message that was signed
    const message = `Sign this message to authenticate with Memeulacra.\n\nNonce: ${nonce}`

    // Recover the signer address from the signature
    const signerAddress = ethers.verifyMessage(message, signature)

    // Compare addresses (case-insensitive)
    return signerAddress.toLowerCase() === address.toLowerCase()
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}
