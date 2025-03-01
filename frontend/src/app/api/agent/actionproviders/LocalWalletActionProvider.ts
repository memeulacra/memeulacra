//@ts-expect-error test
import { ActionProvider, CreateAction, walletActionProvider, WalletActionProvider, WalletProvider, GetWalletDetailsSchema, Network} from '@coinbase/agentkit'
import { z } from 'zod'

/**
 * Action provider that creates an LocalWalletActionProvider
 * we need to provide wallet details access but we don't want to
 * provide the ability to transfer funds
 */
class LocalWalletActionProvider extends ActionProvider<WalletProvider> {
  private wap: WalletActionProvider
  /**
   * Constructor for the CreateNFTProvider class.
   */
  constructor() {
    super('local-wallet-provider', [])
    this.wap = walletActionProvider()
  }

  @CreateAction({
    name: 'get_wallet_details',
    description: 'Gets the details of the connected wallet including address, network, and balance.',
    schema: GetWalletDetailsSchema,
  })
  /**
   * Gets the details of the connected wallet including address, network, and balance.
   *
   * @param walletProvider - The wallet provider to get the details from.
   * @param _ - Empty args object (not used).
   * @returns A formatted string containing the wallet details.
   */
  async getWalletDetails(walletProvider: WalletProvider, _: z.infer<typeof GetWalletDetailsSchema>): Promise<string> {
    return this.wap.getWalletDetails(walletProvider, _)
  }

  supportsNetwork = (network: Network) => true
}

export const localWalletActionProvider = () => new LocalWalletActionProvider()