import { ethers } from 'ethers'
import { z } from 'zod'
import { ActionProvider, CreateAction, EvmWalletProvider, WalletProvider, Network } from '@coinbase/agentkit'
import foundMeJSON from '../FoundMeContract.json'


export const GetMessageSchema = z.object({})

/**
 * asdf
 */
class GetMessageProvider extends ActionProvider<WalletProvider> {
  /**
   * asdf
   */
  constructor() {
    super('get-message-provider', [])
  }

  /**
   * asdfa s
   * @param args asdf
   * @returns adsf
   */
  @CreateAction({
    name: 'get-message',
    description: 'Get a message, it can be a secret message, a public message, or any message you want, but gets the message from the blockchain',
    schema: GetMessageSchema,
  })
  async getMessage(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetMessageSchema>,
  ): Promise<string> {
    // walletProvider.signMessage(args.myField);
    console.log('walletAddress: ', walletProvider.getAddress())
    const contractAddress = '0x58fC579C65fE7e1129D6c5Ef0C57d0F10DaFFeed'
    const baseSepoliaProvider = new ethers.JsonRpcProvider('https://sepolia.base.org')
    const contract = new ethers.Contract(contractAddress, foundMeJSON.abi, baseSepoliaProvider)
    try {
      const message = await contract.foundMe()
      return message
    } catch (error) {
      console.error('Error executing get message:', error)
      if (error instanceof Error) {
        return `Error executing get message: ${error.message}`
      }
      return `Error executing get message: ${error}`
    }
  }

  supportsNetwork = (network: Network) => true
}

export const getMessageProvider = () => new GetMessageProvider()