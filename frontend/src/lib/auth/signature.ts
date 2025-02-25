import { isAddress, recoverMessageAddress } from 'ethers'

/**
 * Verifies a signature against an Ethereum address and nonce
 * 
 * @param address The Ethereum address that supposedly signed the message
 * @param signature The signature to verify
 * @param nonce The nonce that was signed
 * @returns boolean indicating if the signature is valid
 */
export async function verifySignature(
  address: string, 
  signature: string, 
  nonce: string
): Promise<boolean> {
  try {
    // Validate the address format
    if (!isAddress(address)) {
      console.error('Invalid address format')
      return false
    }
    
    // Create the same message that was signed by the wallet
    const message = `Sign this message to authenticate with our application.\n\nNonce: ${nonce}`
    
    // Recover the address from the signature
    const recoveredAddress = await recoverMessageAddress(message, signature)
    
    // Compare the recovered address with the claimed address (case-insensitive)
    return recoveredAddress.toLowerCase() === address.toLowerCase()
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}
