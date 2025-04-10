# FundsVault - Hardhat Implementation

This project contains the implementation of the FundsVault contracts using Hardhat development environment.

### Contract Address
```
    fundsVault: '0x94E3Ae807dD4c1030AA3bF94B348e29CFf1CF0aE'
    treasury: '0xC6660C0952C98a9Ac14c26b35b1dB598f2139Efa'
    yieldToken: '0x8A90B3FDa4fEb2Cafc875b5241227ee285be18D4'
    principalToken: '0xe89Ad517A30292Ab63A922B147B7E83727C2B3BB'
    mockUsdc: '0x5e47b3Ba6f9E80f1504b8cCbC83e2d7Ca69Ab22d'
    mockAavePool: '0xab01753b6D75d550d87807a8E4a9Ddd07D15797e'
```

## Project Structure

- `contracts/`: Solidity smart contracts
- `scripts/`: Deployment and utility scripts
- `test/`: Test files for the contracts

## Contracts Overview

- `MockUSDC.sol`: A mock USDC token for testing.
- `MockAavePool.sol`: A mock implementation of the Aave lending pool.
- `PrincipalToken.sol`: Represents the principal amount of deposits.
- `YieldToken.sol`: Represents yield earned from deposits.
- `Treasury.sol`: Manages fees and funds collection.
- `Vault.sol`: Main contract orchestrating the deposit/withdrawal flow.

## Setup and Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd hardhat-funds-vault
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file:
   ```
   cp .env.example .env
   ```
   
4. Edit the `.env` file with your configuration:
   - Add your private key
   - Add your RPC URL for Sepolia testnet
   - Add your Etherscan API key for verification

## Running Tests

```
npm test
```

## Deployment

1. Local deployment:
   ```
   npm run deploy
   ```

2. Testnet deployment (Sepolia):
   ```
   npm run deploy:sepolia
   ```

## Contract Verification

After deployment to the Sepolia testnet, you can verify your contracts using:

```
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGUMENTS>
```

For contracts with complex constructor arguments like `FundsVault`, you'll need to prepare the arguments properly. See Hardhat documentation for more details.

## Contract Interaction

After deployment, you can interact with your contracts using the Hardhat console:

```
npx hardhat console --network sepolia
```

## License

MIT

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
