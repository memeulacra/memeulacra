import { z } from 'zod'
import MemeNFTJSON from '../MemeNFT.json'
import { encodeFunctionData, getAddress, stringToHex, Address } from 'viem'
import { ActionProvider, CreateAction, EvmWalletProvider, WalletProvider, Network } from '@coinbase/agentkit'
import { LocalWalletProvider } from '../providers/LocalWalletProvider'
import { getUserById } from '@/db/user'
import { getMemeById } from '@/db/meme'

/**
 * This function converts a bigint to a string when stringifying JSON.
 * @param key ignored
 * @param value if a bigint, convert to string
 * @returns original value or string representation of bigint
 */
function bigintReplacer(key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

// Define the action schema
const CreateNFTSchema = z.object({})

/**
 * Action provider that creates an NFT of a meme.
 */
class CreateNFTProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the CreateNFTProvider class.
   */
  constructor() {
    super('create-nft-provider', [])
  }

  @CreateAction({
    name: 'create_nft',
    description: 'create an NFT of the meme, makes and deploys the meme as an NFT',
    schema: CreateNFTSchema,
  })
  async createNFT(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateNFTSchema>,
  ): Promise<string> {

    try {
      let userAddress: Address | string = ''
      let memeUrl: string = ''
      if (walletProvider instanceof LocalWalletProvider) {
        // Special handling for LocalWalletProvider if needed
        console.log('userId:', walletProvider.userId, 'memeId:', walletProvider.memeId)

        // Get the user from the db and extract address
        const user = await getUserById(walletProvider.userId)
        if (!user) throw new Error('User not found')
        userAddress = user.address

        // Get meme  and extract url
        const meme = await getMemeById(walletProvider.memeId)
        if (!meme) throw new Error('Meme not found')
        memeUrl = meme.meme_cdn_url && meme.meme_cdn_url.replace('memulacra.nyc3.digitaloceanspaces.com', 'memes.memeulacra.com')
      }

      const nftData = encodeFunctionData({
        abi: MemeNFTJSON.abi,
        functionName: 'mint',
        args: [
          getAddress(userAddress),
          memeUrl,
          stringToHex('metadata', { size: 32 }),
        ],
      })

      const nftTxHash = await walletProvider.sendTransaction({
        to: process.env.NFT_PROVIDER_ADDRESS as `0x${string}`,
        data: nftData,
        value: BigInt(0),//0n,
      })

      const receipt = await walletProvider.waitForTransactionReceipt(nftTxHash)

      return `NFT creation successful! Transaction hash: ${nftTxHash}. Receipt: ${JSON.stringify(receipt, bigintReplacer)}`
    } catch (error) {
      console.error('NFT Creation Failed:', error)
      if (error instanceof Error) {
        return `Error NFT Creation Failed: ${error.message}`
      }
      return `Error NFT Creation Failed: ${error}`
    }
  }

  supportsNetwork = (network: Network) => true
}

export const createNFTProvider = () => new CreateNFTProvider()
