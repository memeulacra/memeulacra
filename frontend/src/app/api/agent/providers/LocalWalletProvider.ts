//@ts-expect-error test
import { CdpWalletProvider, ConfigureCdpAgentkitWithWalletOptions, WalletProvider, Network } from '@coinbase/agentkit'

/**
 * CdpWalletProvider with restricted access to certain methods.
 * CdpWalletProvider has a private constructor so we can't extend and override it directly.
 * there are some functions that we don't want to offer in anyway shape or form to the user
 */
export class LocalWalletProvider extends WalletProvider {
  private baseProvider: CdpWalletProvider
  public userId: string
  public memeId: string

  constructor(baseProvider: CdpWalletProvider, userId: string, memeId: string) {
    super()
    this.baseProvider = baseProvider
    this.userId = userId
    this.memeId = memeId

    // Define a list of function names to block
    const blockedMethods = new Set<string>([
      'nativeTransfer',
      'deployNFT',
      'deployContract',
      'deployToken',
      'createTrade',
    ])

    return new Proxy(this, {
      get(target, prop: string, receiver) {
        // Check if the property/method exists on LocalWalletProvider first
        if (prop in target) {
          const value = (target as any)[prop]
          return typeof value === 'function' ? value.bind(target) : value
        }

        // Check if the method is in the blocked list
        if (blockedMethods.has(prop)) {
          throw new Error(`Access to method '${prop}' is restricted`)
          // Alternatively, return a no-op function:
          // return () => Promise.resolve(`Method '${prop}' is restricted`);
        }

        // Delegate to baseProvider if not blocked
        const baseValue = (target.baseProvider as any)[prop]
        return typeof baseValue === 'function' ? baseValue.bind(target.baseProvider) : baseValue
      },
    })
  }

  /**
   * Configures a new CdpWalletProvider with a wallet.
   *
   * @param config - Optional configuration parameters
   * @returns A Promise that resolves to a new CdpWalletProvider instance
   * @throws Error if required environment variables are missing or wallet initialization fails
   */
  static async configureWithWallet(config: ConfigureCdpAgentkitWithWalletOptions, userId: string, memeId: string): Promise<LocalWalletProvider> {
    //console.log("LocalWalletProvider initializing");
    const walletProvider = await CdpWalletProvider.configureWithWallet(config)
    const provider = new LocalWalletProvider(walletProvider, userId, memeId)
    return new Promise((resolve, reject) => {
      resolve(provider)
    })
  }

  getAddress(): string {
    return this.baseProvider.getAddress()
  }
  getNetwork(): Network {
    return this.baseProvider.getNetwork()
  }
  getName(): string {
    return this.baseProvider.getName()
  }
  getBalance(): Promise<bigint> {
    return this.baseProvider.getBalance()
  }
  async nativeTransfer(to: string, value: string): Promise<string> {
    throw new Error('Method not implemented.')
  }
}
