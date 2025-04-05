import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, MockAaveLendingPool, Treasury, PrincipalToken, YieldToken, FundsVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FundsVault", function () {
  let mockUSDC: MockUSDC;
  let vault: FundsVault;
  let yieldToken: YieldToken;
  let principalToken: PrincipalToken;
  let treasury: Treasury;
  let mockAavePool: MockAaveLendingPool;
  let owner: SignerWithAddress;
  let merchant: SignerWithAddress;
  let testDepositAmount = ethers.parseUnits("100", 6); // 100 USDC with 6 decimals

  beforeEach(async function () {
    [owner, merchant] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy YieldToken
    const YieldToken = await ethers.getContractFactory("YieldToken");
    yieldToken = await YieldToken.deploy();
    await yieldToken.waitForDeployment();

    // Deploy PrincipalToken
    const PrincipalToken = await ethers.getContractFactory("PrincipalToken");
    principalToken = await PrincipalToken.deploy();
    await principalToken.waitForDeployment();

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(await mockUSDC.getAddress());
    await treasury.waitForDeployment();

    // Deploy MockAaveLendingPool
    const MockAaveLendingPool = await ethers.getContractFactory("MockAaveLendingPool");
    mockAavePool = await MockAaveLendingPool.deploy(await mockUSDC.getAddress());
    await mockAavePool.waitForDeployment();

    // Deploy FundsVault
    const FundsVault = await ethers.getContractFactory("FundsVault");
    const initialSetup = {
      _initialOwner: owner.address,
      _usdc: await mockUSDC.getAddress(),
      _aavePool: await mockAavePool.getAddress(),
      _treasury: await treasury.getAddress(),
      _principalToken: await principalToken.getAddress(),
      _yieldToken: await yieldToken.getAddress()
    };

    vault = await FundsVault.deploy(initialSetup);
    await vault.waitForDeployment();

    // Set FundsVault address in PrincipalToken and YieldToken
    await principalToken.setFundsVault(await vault.getAddress());
    await yieldToken.setFundsVault(await vault.getAddress());

    // Transfer initial funds to the vault
    const initialFundsAmount = ethers.parseUnits("1000", 6); // 1000 USDC
    await mockUSDC.transfer(await vault.getAddress(), initialFundsAmount);
  });

  async function deposit() {
    await mockUSDC.approve(await vault.getAddress(), testDepositAmount);
    await vault.deposit(testDepositAmount, 90 * 24 * 60 * 60); // 90 days in seconds
  }

  describe("Deposit and Withdraw", function () {
    it("should deposit and withdraw assets", async function () {
      const balanceBefore = await mockUSDC.balanceOf(owner.address);
      console.log("Balance before deposit:", ethers.formatUnits(balanceBefore, 6));

      await mockUSDC.approve(await vault.getAddress(), testDepositAmount);
      await vault.deposit(testDepositAmount, 90 * 24 * 60 * 60); // 90 days in seconds

      const balanceAfter = await mockUSDC.balanceOf(owner.address);
      console.log("Balance after deposit:", ethers.formatUnits(balanceAfter, 6));

      // Advance time by 90 days
      await time.increase(90 * 24 * 60 * 60);

      await vault.withdrawPrincipal();

      const balanceAfterWithdraw = await mockUSDC.balanceOf(owner.address);
      console.log("Balance after withdraw:", ethers.formatUnits(balanceAfterWithdraw, 6));

      expect(balanceAfter).to.be.lt(balanceBefore);
      expect(balanceAfterWithdraw).to.be.gt(balanceAfter);
    });

    it("should not withdraw principal before unlock time", async function () {
      await deposit();

      // Advance time by only 10 days
      await time.increase(10 * 24 * 60 * 60);

      await expect(vault.withdrawPrincipal()).to.be.revertedWith("90-day lockup not completed");
    });
  });

  describe("Yield Harvesting", function () {
    it("should harvest yield after some time", async function () {
      await deposit();

      // Advance time significantly to generate yield
      await time.increase(300 * 24 * 60 * 60); // 300 days

      const yieldAmount = await vault.harvestYield();
      expect(yieldAmount).to.be.gt(0);
    });

    it("should not harvest yield if none is available", async function () {
      await deposit();

      // Don't advance time - no yield will be generated
      await expect(vault.harvestYield()).to.be.revertedWith("No yield available");
    });
  });

  describe("Fund Claiming", function () {
    it("should claim funds before lockup period", async function () {
      await deposit();

      // Advance time by only 10 days (less than lockup period)
      await time.increase(10 * 24 * 60 * 60);

      const claimedAmount = await vault.claimFunds(owner.address);
      expect(claimedAmount).to.be.gt(0);
    });
  });

  describe("Merchant Payments", function () {
    it("should pay merchant", async function () {
      await deposit();

      const merchantBalanceBefore = await mockUSDC.balanceOf(merchant.address);
      const amountToPay = ethers.parseUnits("50", 6); // 50 USDC

      await vault.payMerchant(amountToPay, merchant.address);

      const merchantBalanceAfter = await mockUSDC.balanceOf(merchant.address);
      
      expect(merchantBalanceAfter).to.be.gt(merchantBalanceBefore);
      expect(merchantBalanceAfter - merchantBalanceBefore).to.equal(amountToPay);
    });

    it("should not pay merchant more than deposited amount", async function () {
      await deposit();

      const amountToPay = ethers.parseUnits("150", 6); // 150 USDC, more than deposited

      await expect(vault.payMerchant(amountToPay, merchant.address))
        .to.be.revertedWith("Insufficient funds to cover the payment");
    });
  });

  describe("Yield Token Operations", function () {
    it("should sell yield tokens", async function () {
      await deposit();

      const yieldTokenBalance = await yieldToken.balanceOf(owner.address);
      await vault.sellYieldTokensForTokens(yieldTokenBalance, await mockUSDC.getAddress());

      const yieldTokenBalanceAfter = await yieldToken.balanceOf(owner.address);
      
      expect(yieldTokenBalanceAfter).to.be.lt(yieldTokenBalance);
      expect(yieldTokenBalanceAfter).to.equal(0);
    });
  });

  describe("Token Decimals", function () {
    it("should return correct decimal values", async function () {
      const ytDecimals = await yieldToken.decimals();
      const ptDecimals = await principalToken.decimals();
      const usdcDecimals = await mockUSDC.decimals();

      expect(ytDecimals).to.equal(6);
      expect(ptDecimals).to.equal(6);
      expect(usdcDecimals).to.equal(6);
    });
  });
});