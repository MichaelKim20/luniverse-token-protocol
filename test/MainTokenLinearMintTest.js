var MainToken = artifacts.require('./MainToken.sol')
var TestingLinearMintableMainToken = artifacts.require('./TestingLinearMintableMainToken.sol')
var TestHelper = require("./helpers")

var should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

var BigNumber = web3.BigNumber;

contract('Linear Mint for Main Token', (accounts) => {
  let linearMintableMainToken;
  let owner;

  const mainTokenName = "LinearMintableMainToken";
  const mainTokenSymbol = "MT1";
  const mainTokenDecimals = 18;
  const initialSupply = new BigNumber(web3.toWei(1000, 'ether'));
  const maximumSupply = new BigNumber(web3.toWei(10000, 'ether'));
  const mintingSupply = maximumSupply.sub(initialSupply);

  const revertMessage = 'VM Exception while processing transaction: revert';

  beforeEach(async function() {
    owner = accounts[0];
  });

  describe("Constructor", async function() {
    var mintAmountPerPeriod = new BigNumber(10);
    var intervalPeriodInDays = new BigNumber(1);

    beforeEach(async function() {
      linearMintableMainToken = await MainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
      await linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);
    });

    it("should be created", async function() {
      should.exist(linearMintableMainToken);
      should.exist(linearMintableMainToken.address);
    });

    it("should have the specified owner", async function() {
      const actualOwner = await linearMintableMainToken.owner();
      actualOwner.should.equal(owner);
    });

    it("should have the specified name", async function() {
      const name = await linearMintableMainToken.name();
      name.should.equal(mainTokenName);
    });

    it("Total supply should be the initial supply", async function() {
      const totalSupply = await linearMintableMainToken.totalSupply();
      totalSupply.should.bignumber.equal(initialSupply);
    });

    it("should have the specified maximum supply", async function() {
      const maxSupply = await linearMintableMainToken.maxSupply();
      maxSupply.should.bignumber.equal(maximumSupply);
    });

    it("should have the specified mintAmountPerDay", async function() {
      const actualMintAmountPerPeriod = await linearMintableMainToken.mintAmountPerPeriod();
      actualMintAmountPerPeriod.should.be.bignumber.equal(mintAmountPerPeriod);
    });
  });

  describe('linearMint', async function() {
    beforeEach(async function() {
      linearMintableMainToken = await MainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
    })

    it('should be reverted when already minting', async function() {
      let intervalPeriodInDays = 1;
      let mintAmountPerPeriod = 1;

      await linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);
      const linearMintPromise = linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

      TestHelper.expectThrow(linearMintPromise);
    });

    it('should be reverted when mintAmountPerPeriod is zero', async function() {
      let intervalPeriodInDays = 1;
      let mintAmountPerPeriod = 0;

      const linearMintPromise = linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

      TestHelper.expectThrow(linearMintPromise);
    });

    it('should be reverted when intervalPeriodInDays is zero', async function() {
      let intervalPeriodInDays = 0;
      let mintAmountPerPeriod = 1;

      const linearMintPromise = linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

      TestHelper.expectThrow(linearMintPromise);
    });
  })

  describe("Minting", async function() {
    const ONE_DAY = 1;
    const TWO_DAYS = 2;
    const SECONDS_IN_A_DAY = 24*60*60;

    const oneEther = new BigNumber(web3.toWei(1, 'ether'));
    const twoEther = new BigNumber(web3.toWei(2, 'ether'));
    const tenEther = new BigNumber(web3.toWei(10, 'ether'));

    const testData = [
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  0,                    mintingAmount: 10, mintedAmount:10, mintingStatus: true},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  1*SECONDS_IN_A_DAY-1, mintingAmount: 10, mintedAmount:10, mintingStatus: true},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  1*SECONDS_IN_A_DAY,   mintingAmount: 20, mintedAmount:20, mintingStatus: true},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  2*SECONDS_IN_A_DAY-1, mintingAmount: 20, mintedAmount:20, mintingStatus: true},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  8*SECONDS_IN_A_DAY,   mintingAmount: 90, mintedAmount:90, mintingStatus: false},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds:  9*SECONDS_IN_A_DAY-1, mintingAmount: 90, mintedAmount:90, mintingStatus: false},
      {initialSupply: 10, maximumSupply: 100, mintAmountPerPeriod: 10, intervalPeriod: ONE_DAY, pastDaysInSeconds: 10*SECONDS_IN_A_DAY-1, mintingAmount:100, mintedAmount:90, mintingStatus: false},
    ];

    testData.forEach(function(data) {
      it(`should mint ${data.mintedAmount} after ${data.pastDaysInSeconds / 86400} for ${JSON.stringify(data)}`, async function () {
        var mintAmountPerPeriod = new BigNumber(web3.toWei(data.mintAmountPerPeriod, 'ether'));
        var intervalPeriodInDays = data.intervalPeriod;
        const initialSupply = new BigNumber(web3.toWei(data.initialSupply, 'ether'));
        const maximumSupply = new BigNumber(web3.toWei(data.maximumSupply, 'ether'));
        const mintingSupply = maximumSupply.sub(initialSupply);

        linearMintableMainToken = await TestingLinearMintableMainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
        await linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

        const lastBlock = web3.eth.getBlock('latest');
        const start = new BigNumber(lastBlock.timestamp);

        const blockTimestamp = start.add(data.pastDaysInSeconds);
        const mintingAmount = await linearMintableMainToken.calculateMintAmount.call(blockTimestamp);

        mintingAmount.should.be.bignumber.equal(new BigNumber(web3.toWei(data.mintingAmount, 'ether')));
      });

      it(`should fail arbit mint when LinearMint is Registered`, async function () {
        var mintAmountPerPeriod = new BigNumber(web3.toWei(data.mintAmountPerPeriod, 'ether'));
        var intervalPeriodInDays = data.intervalPeriod;
        const initialSupply = new BigNumber(web3.toWei(data.initialSupply, 'ether'));
        const maximumSupply = new BigNumber(web3.toWei(data.maximumSupply, 'ether'));
        const mintingSupply = maximumSupply.sub(initialSupply);

        linearMintableMainToken = await TestingLinearMintableMainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
        await linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

        await TestHelper.expectThrow2(linearMintableMainToken.mint(100));
      });

      it(`should success arbit mint ${data.mintedAmount} when LinearMint is not Registered`, async function () {
        const initialSupply = new BigNumber(web3.toWei(data.initialSupply, 'ether'));
        const maximumSupply = new BigNumber(web3.toWei(data.maximumSupply, 'ether'));

        linearMintableMainToken = await TestingLinearMintableMainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
        await linearMintableMainToken.mint(web3.toWei(data.mintedAmount));

        const mintedEvent = linearMintableMainToken.Minted({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});

        let watcher = function(err, event) {
          mintedEvent.stopWatching();

          event.event.should.be.equal('Minted');
          event.args.mintedAmount.should.be.bignumber.equal(new BigNumber(web3.toWei(data.mintedAmount)));
        };

        await TestHelper.awaitEvent(mintedEvent, watcher);
      });
    });

    testData.forEach(function(data) {
      //
      // to test this, make the visibility of LinearMintableMainToken.mint2 to public
      //
      it(`should mint ${data.mintedAmount} after ${data.pastDaysInSeconds / 86400} for ${JSON.stringify(data)}`, async function () {
        var mintAmountPerPeriod = new BigNumber(web3.toWei(data.mintAmountPerPeriod, 'ether'));
        var intervalPeriodInDays = data.intervalPeriod;
        const initialSupply = new BigNumber(web3.toWei(data.initialSupply, 'ether'));
        const maximumSupply = new BigNumber(web3.toWei(data.maximumSupply, 'ether'));
        const mintingSupply = maximumSupply.sub(initialSupply);

        linearMintableMainToken = await TestingLinearMintableMainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
        await linearMintableMainToken.registerLinearMint(mintingSupply,mintAmountPerPeriod, intervalPeriodInDays);

        const lastBlock = web3.eth.getBlock('latest');
        const blockTimestamp = new BigNumber(lastBlock.timestamp).add(data.pastDaysInSeconds);

        // When
        await linearMintableMainToken.mintForTest(blockTimestamp);

        // Then
        const mintedEvent = linearMintableMainToken.Minted({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});

        let watcher = function(err, event) {
          mintedEvent.stopWatching();

          event.event.should.be.equal('Minted');
          event.args.mintedAmount.should.be.bignumber.equal(new BigNumber(web3.toWei(data.mintedAmount)));
        }

        await TestHelper.awaitEvent(mintedEvent, watcher);
        const totalSupply = await linearMintableMainToken.totalSupply.call();
        totalSupply.should.be.bignumber.lte(maximumSupply);

        const mintingStatus = await linearMintableMainToken.mintingStatus.call();
        mintingStatus.should.be.equal(data.mintingStatus);
      })
    });
  });
});
