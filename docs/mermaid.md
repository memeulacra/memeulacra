flowchart TD
    subgraph "Public Experience"
        A[Website Visitor] --> B[Browse Community Memes]
        A --> C[Preview AI Capabilities]
    end

    subgraph "Authentication"
        A --> D[Connect Crypto Wallet]
        D --> E[CDP Wallet SDK]
        E --> F[Smart Wallet]
        E --> G[EOA Account]
    end

    subgraph "Core User Actions"
        H[Authenticated User] --> I[Create Memes]
        H --> J[Train AI via Likes/Dislikes]
        I --> K[AI Agent Chat Interface]
    end

    subgraph "Value Creation Options"
        K --> L[Create Memecoin]
        K --> M[Mint NFT]
        K --> N[Share Socially]
        K --> O[Additional Customization]
    end

    subgraph "Reward System"
        L --> P[Smart Contract Distribution]
        P --> Q[Reward Contributors]
        Q --> R[Users Who Trained AI]
    end

    subgraph "User Dashboard"
        H --> S[Profile Page]
        S --> T[View Earned Rewards]
        S --> U[Track Contributions]
        S --> V[Manage Portfolio]
    end

    %% Flow connections
    J --> AI{AI Learning System}
    AI --> I
    I --> K
    L --> P

    