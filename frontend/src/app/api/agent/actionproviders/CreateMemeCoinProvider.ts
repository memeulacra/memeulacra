import { ethers } from 'ethers'
import { z } from 'zod'
import MemeulacraFactoryJSON from '../MemeulacraFactory.json'
import { encodeFunctionData, getAddress, Address } from 'viem'
import { ActionProvider, CreateAction, EvmWalletProvider, WalletProvider, Network } from '@coinbase/agentkit'
import { LocalWalletProvider } from '../providers/LocalWalletProvider'
import { getUserProportionsWithAddresses } from '@/db/get-contributors'
import { getUserById } from '@/db/user'
import { getMemeById } from '@/db/meme'

let didDeployCoin = false


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
const CreateMemeCoinSchema = z.object({
  name: z.string().nonempty().max(100).describe('The name of the meme coin'),
  symbol: z.string().nonempty().max(10).describe('The symbol of the meme coin'),
})

/**
 * Action provider that creates an erc-20 token for the meme.
 */
class CreateMemeCoinProvider extends ActionProvider<WalletProvider> {
  /**
     * Constructor for the CreateMemeTokenProvider class.
     */
  constructor() {
    super('create-meme-coin-provider', [])
  }

    @CreateAction({
      name: 'create_coin',
      description:
        'create a meme coin, an erc-20 token for the meme, makes and deploys the memecoin as an ERC20 token',
      schema: CreateMemeCoinSchema,
    })
  async createCoin(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateMemeCoinSchema>,
  ): Promise<string> {
    const { name, symbol } = args

    if (didDeployCoin) {
      return 'A Coin has already been deployed for this MEME!'
    }

    try {
      let contributors: Address[] = []
      let contributorProportions: bigint[] = [] //[BigInt(1), BigInt(2), BigInt(3)];
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

        const contributorsAndUsers = await getUserProportionsWithAddresses(walletProvider.memeId)
        contributors = contributorsAndUsers.map((contributor) => contributor.address)
        contributorProportions = contributorsAndUsers.map((contributor) => BigInt(contributor.proportion))

        console.log('user address', userAddress, 'memeUrl', memeUrl)
        console.log('contributors:', JSON.stringify(contributors, null, 2), 'proportions:', contributorProportions)
      }

      const coinData = encodeFunctionData({
        abi: MemeulacraFactoryJSON.abi,
        functionName: 'deployMemeToken',
        args: [
          name, // name
          symbol, // symbol
          memeUrl, // url to meme
          getAddress(userAddress || '0x377C2A416B5b43D970681D614196d6e773032999'), // owner address
          contributors, //address[] memory contributors
          contributorProportions, //uint256[] memory contributorProportions
        ],
      })
      const coinTxHash = await walletProvider.sendTransaction({
        to: process.env.MEME_TOKEN_PROVIDER_ADDRESS as `0x${string}`,
        data: coinData,
        value: BigInt(0),//0n,
      })

      const receipt = await walletProvider.waitForTransactionReceipt(coinTxHash)

      // Decode the logs to extract the deployed token address
      const eventABI = [
        'event NewMemeTokenFactoryEvent(address indexed owner, address indexed newTokenAddress)',
      ]
      const iface = new ethers.Interface(eventABI)

      // Find the log for NewMemeTokenFactoryEvent
      const matchingLog = receipt.logs.find(
        ( log: { topics: string[]; }) =>
          log.topics[0] ===
            ethers.keccak256(ethers.toUtf8Bytes('NewMemeTokenFactoryEvent(address,address)')),
      )

      let deployedTokenAddress: unknown
      if (!matchingLog) {
        // Parse the log to extract the token address
        const decodedLog = iface.parseLog(matchingLog)
        deployedTokenAddress =
                decodedLog?.args.newTokenAddress ?? 'could not find the contact address'

      } else {
        deployedTokenAddress = 'could not find the contact address'
        //throw new Error("NewMemeTokenFactoryEvent log not found in transaction receipt.");
      }

      didDeployCoin = true

      return `Coin creation successful! Transaction hash: ${coinTxHash}. Receipt: ${JSON.stringify(receipt, bigintReplacer)}\n\nCoin Address: ${deployedTokenAddress}`
    } catch (error) {
      console.error('Coin Creation Failed:', error)
      if (error instanceof Error) {
        return `Error Coin Creation Failed: ${error.message}`
      }
      return `Error Coin Creation Failed: ${error}`
    }
  }

    supportsNetwork = (network: Network) => true
}

export const createMemeCoinProvider = () => new CreateMemeCoinProvider()
