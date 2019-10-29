var MainToken = artifacts.require('./MainToken.sol')
var TestHelper = require("./helpers");

var should = require('chai').should();

var BigNumber = web3.BigNumber;

var should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('Arbitary Mint', (accounts) => {
  let mainToken;
  let owner;

  const mainTokenName = "MainToken";
  const mainTokenSymbol = "MT1";
  const mainTokenDecimals = 18;
  const initialSupply = new BigNumber(web3.toWei(1000, 'ether'));
  const maximumSupply = new BigNumber(web3.toWei(10000, 'ether'));

  const revertMessage = 'VM Exception while processing transaction: revert';

  beforeEach(async function() {
    mainToken = await MainToken.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply);
    owner = accounts[0];
  });

  describe("Constructor", async function() {

    it("should be created", async function() {
      should.exist(mainToken);
      should.exist(mainToken.address);
    });

    it("should have the specified owner", async function() {
      const actualOwner = await mainToken.owner();
      actualOwner.should.equal(owner);
    });

    it("should have the specified name", async function() {
      const name = await mainToken.name();
      name.should.equal(mainTokenName);
    });

    it("Total supply should be the initial supply", async function() {
      const totalSupply = await mainToken.totalSupply();
      totalSupply.should.bignumber.equal(initialSupply);
    });

    it("should have the specified maximum supply", async function() {
      const maxSupply = await mainToken.maxSupply();
      maxSupply.should.bignumber.equal(maximumSupply);
    });

  });

  describe("Mint", async function() {
    const oneThousandEther = new BigNumber(web3.toWei(1000, 'ether'));

    it("should succeed when totalSupply is less than the maximum supplu", async function() {
      await mainToken.mint.sendTransaction(oneThousandEther);

      // Then
      const mintedEvent = mainToken.Minted();

      const watcher = function(err,event) {
        mintedEvent.stopWatching();

        event.event.should.be.equal('Minted');
        event.args.recipient.should.be.equal(owner);
        event.args.mintedAmount.should.be.bignumber.equal(oneThousandEther);
      }

      await TestHelper.awaitEvent(mintedEvent, watcher);
      const totalSupply = await mainToken.totalSupply.call();
      totalSupply.should.be.bignumber.equal(initialSupply.plus(oneThousandEther));
    });

    it("should fail when totalSupply is more than the maximum supply", async function() {
      TestHelper.expectThrow(mainToken.mint(maximumSupply.sub(initialSupply).add(1)));
    });

    it("should fail if called not by owner", async function() {
      const notOwner = accounts[9];

      TestHelper.expectThrow(mainToken.mint(oneThousandEther, {from: notOwner}));
    });
  });


  describe("Lock, Unlock test", async function() {
    const oneThousandEther = new BigNumber(web3.toWei(1000, 'ether'));

    it("should fail if called not by owner", async function() {
      const notOwner = accounts[9];

      await TestHelper.expectThrow(mainToken.lockAccount(accounts[1], {from: notOwner}));
    });

    it("unlock should fail when user is already unlocked", async function() {
      await TestHelper.expectThrow(mainToken.unlockAccount(accounts[1], {from: owner}));
    });

    it("lock should fail when user is already locked", async function() {
      await mainToken.lockAccount(accounts[1], {from: owner});

      await TestHelper.expectThrow(mainToken.lockAccount(accounts[1], {from: owner}));
    });

    it("should revert when locked user makes transactions", async function() {
      await mainToken.transfer(accounts[1], oneThousandEther, { from: owner });
      await mainToken.lockAccount(accounts[1], {from: owner});

      await TestHelper.expectThrow(mainToken.transfer(accounts[2], oneThousandEther, {from: accounts[1]}));
    });

    it("should transfer when locked -> unlocked user makes transactions", async function() {
      await mainToken.transfer(accounts[1], oneThousandEther, { from: owner });

      await mainToken.lockAccount(accounts[1], {from: owner});
      await TestHelper.expectThrow(mainToken.transfer(accounts[2], oneThousandEther, {from: accounts[1]}));

      await mainToken.unlockAccount(accounts[1], {from: owner});
      await mainToken.transfer(accounts[2], oneThousandEther, {from: accounts[1]});

      const testBalance = await mainToken.balanceOf(accounts[2]);
      testBalance.should.be.bignumber.equal(oneThousandEther);
    });
  });

  describe("Pause, UnPause test", async function() {
    const oneThousandEther = new BigNumber(web3.toWei(1000, 'ether'));

    it("should fail if pause called not by owner", async function() {
      const notOwner = accounts[9];

      await TestHelper.expectThrow(mainToken.pause({from: notOwner}));
    });

    it("should fail if unpause called not by owner", async function() {
      const notOwner = accounts[9];

      await mainToken.pause({from: owner});
      await TestHelper.expectThrow(mainToken.unpause({from: notOwner}));
    });

    it("unpause should fail when token is already unpaused", async function() {
      await TestHelper.expectThrow(mainToken.unpause({from: owner}));
    });

    it("pause should fail when token is already paused", async function() {
      await mainToken.pause({from: owner});

      await TestHelper.expectThrow(mainToken.pause({from: owner}));
    });

    it("should revert transaction when token is paused", async function() {
      await mainToken.pause({from: owner});
      await TestHelper.expectThrow(mainToken.transfer(accounts[1], oneThousandEther, { from: owner }));
      await TestHelper.expectThrow(mainToken.approve(accounts[1], oneThousandEther, { from: owner }));
    });

    it("should transfer when paused -> unpaused", async function() {
      await mainToken.pause({from: owner});
      await TestHelper.expectThrow(mainToken.transfer(accounts[1], oneThousandEther, { from: owner }));
      await TestHelper.expectThrow(mainToken.approve(accounts[1], oneThousandEther, { from: owner }));

      await mainToken.unpause({from: owner});
      await mainToken.transfer(accounts[1], oneThousandEther, { from: owner });
      await mainToken.transfer(accounts[2], oneThousandEther, {from: accounts[1]});

      const testBalance = await mainToken.balanceOf(accounts[2]);
      testBalance.should.be.bignumber.equal(oneThousandEther);
    });
  });
});
