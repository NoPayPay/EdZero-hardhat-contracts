import fs from "fs";
import { ethers } from "hardhat";
import { MockUSDC__factory, MockAaveLendingPool__factory, Treasury__factory, PrincipalToken__factory, YieldToken__factory, FundsVault__factory } from "../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC") as MockUSDC__factory;
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  console.log("MockUSDC deployed to:", await mockUSDC.getAddress());
  
  // Deploy YieldToken
  const YieldToken = await ethers.getContractFactory("YieldToken") as YieldToken__factory;
  const yieldToken = await YieldToken.deploy();
  await yieldToken.waitForDeployment();
  console.log("YieldToken deployed to:", await yieldToken.getAddress());
  
  // Deploy PrincipalToken
  const PrincipalToken = await ethers.getContractFactory("PrincipalToken") as PrincipalToken__factory;
  const principalToken = await PrincipalToken.deploy();
  await principalToken.waitForDeployment();
  console.log("PrincipalToken deployed to:", await principalToken.getAddress());
  
  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury") as Treasury__factory;
  const treasury = await Treasury.deploy(await mockUSDC.getAddress());
  await treasury.waitForDeployment();
  console.log("Treasury deployed to:", await treasury.getAddress());
  
  // Deploy MockAaveLendingPool
  const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool") as MockAaveLendingPool__factory;
  const mockAavePool = await MockAaveLendingPool.deploy(await mockUSDC.getAddress());
  await mockAavePool.waitForDeployment();
  console.log("MockAaveLendingPool deployed to:", await mockAavePool.getAddress());
  
  // Deploy FundsVault
  const FundsVault = await ethers.getContractFactory("FundsVault") as FundsVault__factory;
  const initialSetup = {
    _initialOwner: deployer.address,
    _usdc: await mockUSDC.getAddress(),
    _aavePool: await mockAavePool.getAddress(),
    _treasury: await treasury.getAddress(),
    _principalToken: await principalToken.getAddress(),
    _yieldToken: await yieldToken.getAddress()
  };
  
  const vault = await FundsVault.deploy(initialSetup);
  await vault.waitForDeployment();
  console.log("FundsVault deployed to:", await vault.getAddress());
  
  // Set FundsVault address in PrincipalToken and YieldToken
  await principalToken.setFundsVault(await vault.getAddress());
  console.log("Set FundsVault in PrincipalToken");
  
  await yieldToken.setFundsVault(await vault.getAddress());
  console.log("Set FundsVault in YieldToken");
  
  // Transfer initial funds to the vault
  const initialFundsAmount = ethers.parseUnits("1000", 6); // 1000 USDC
  await mockUSDC.approve(await vault.getAddress(), initialFundsAmount);
  await vault.depositInitialFunds(initialFundsAmount);
  console.log("Transferred initial funds to the vault:", ethers.formatUnits(initialFundsAmount, 6), "USDC");
  
  // Log deployed contract addresses for verification
  console.log("\nDeployed Contract Addresses:");
  console.log("----------------------------");
  console.log("MockUSDC:", await mockUSDC.getAddress());
  console.log("MockAavePool:", await mockAavePool.getAddress());
  console.log("PrincipalToken:", await principalToken.getAddress());
  console.log("YieldToken:", await yieldToken.getAddress());
  console.log("Treasury:", await treasury.getAddress());
  console.log("FundsVault:", await vault.getAddress());

  const deployments = {
    Owner: deployer.address,
    MockUSDC: await mockUSDC.getAddress(),
    MockAavePool: await mockAavePool.getAddress(),
    PrincipalToken: await principalToken.getAddress(),
    YieldToken: await yieldToken.getAddress(),
    Treasury: await treasury.getAddress(),
    FundsVault: await vault.getAddress()
  };
  
  fs.writeFileSync(
    "deployments.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("Deployment addresses saved to deployments.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });