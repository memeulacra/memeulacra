import * as secp from '@noble/secp256k1'
interface NostrKeys {
  privateKeyHex: string;
  publicKeyHex: string;
  nsec: string;
  npub: string;
}

/**
 * Generates a Nostr keypair (nsec private key and npub public key)
 * @returns {Promise<NostrKeys>} Object containing the hex and bech32 representations of keys
 */
async function generateNostrKeys(): Promise<NostrKeys> {
  // Generate a random private key
  const privateKeyBytes = secp.utils.randomPrivateKey()
  const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex')

  // Derive the public key from the private key
  const publicKeyBytes = secp.getPublicKey(privateKeyBytes)
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex')

  // Convert to npub format (bech32)
  const npub = hexToNpub(publicKeyHex)
  // Convert to nsec format (bech32)
  const nsec = hexToNsec(privateKeyHex)

  return {
    privateKeyHex,
    publicKeyHex,
    nsec,
    npub
  }
}

/**
 * Converts a hex public key to npub format
 * @param {string} publicKeyHex - The hex representation of the public key
 * @returns {string} The npub (bech32 encoded public key)
 */
function hexToNpub(publicKeyHex: string): string {
  return encodeBech32('npub', publicKeyHex)
}

/**
 * Converts a hex private key to nsec format
 * @param {string} privateKeyHex - The hex representation of the private key
 * @returns {string} The nsec (bech32 encoded private key)
 */
function hexToNsec(privateKeyHex: string): string {
  return encodeBech32('nsec', privateKeyHex)
}

/**
 * Encodes data with bech32
 * @param {string} prefix - Human readable prefix (npub/nsec)
 * @param {string} hex - Hex string to encode
 * @returns {string} Bech32 encoded string
 */
function encodeBech32(prefix: string, hex: string): string {
  // Convert hex string to byte array
  const data = Buffer.from(hex, 'hex')

  // Convert to 5-bit words as required by bech32
  const words = convertBits(data, 8, 5, true)

  // Use bech32 library from project
  return bech32Encode(prefix, words)
}

/**
 * Bech32 encoding implementation
 * @param {string} hrp - Human readable prefix
 * @param {number[]} words - 5-bit words
 * @returns {string} Bech32 encoded string
 */
function bech32Encode(hrp: string, words: number[]): string {
  // You'll need to import your project's actual bech32 library
  // This is a placeholder - replace with your actual bech32 encoding logic
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

  // Add checksum
  const values = createChecksum(hrp, words)
  let result = hrp + '1'

  for (let i = 0; i < words.length + 6; i++) {
    const value = i < words.length ? words[i] : values[i - words.length]
    result += CHARSET.charAt(value)
  }

  return result
}

/**
 * Helper for bech32 checksum calculation
 */
function createChecksum(hrp: string, data: number[]): number[] {
  const values = [0, 0, 0, 0, 0, 0]
  const hrpExpanded = expandHrp(hrp)
  const combined = hrpExpanded.concat(data).concat(values)
  const polymod = polymodValue(combined) ^ 1

  for (let i = 0; i < 6; i++) {
    values[i] = (polymod >> 5 * (5 - i)) & 31
  }

  return values
}

/**
 * Helper for bech32 checksum calculation
 */
function expandHrp(hrp: string): number[] {
  const result: number[] = []
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) >> 5)
  }
  result.push(0)
  for (let i = 0; i < hrp.length; i++) {
    result.push(hrp.charCodeAt(i) & 31)
  }
  return result
}

/**
 * Helper for bech32 checksum calculation
 */
function polymodValue(data: number[]): number {
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1

  for (let i = 0; i < data.length; i++) {
    const value = data[i]
    const top = chk >> 25
    chk = (chk & 0x1ffffff) << 5 ^ value

    for (let j = 0; j < 5; j++) {
      if ((top >> j) & 1) {
        chk ^= GENERATOR[j]
      }
    }
  }

  return chk
}

/**
 * Helper function for converting between bit sizes
 */
function convertBits(data: Buffer, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0
  let bits = 0
  const ret: number[] = []
  const maxv = (1 << toBits) - 1

  for (let p = 0; p < data.length; p++) {
    const value = data[p]
    acc = (acc << fromBits) | value
    bits += fromBits

    while (bits >= toBits) {
      bits -= toBits
      ret.push((acc >> bits) & maxv)
    }
  }

  if (pad && bits > 0) {
    ret.push((acc << (toBits - bits)) & maxv)
  }

  return ret
}

// Example usage
// async function main() {
//   const keys = await generateNostrKeys();
//   console.log('Private Key (hex):', keys.privateKeyHex);
//   console.log('Public Key (hex):', keys.publicKeyHex);
//   console.log('Private Key (nsec):', keys.nsec);
//   console.log('Public Key (npub):', keys.npub);
// }
// main().catch(console.error);
//
