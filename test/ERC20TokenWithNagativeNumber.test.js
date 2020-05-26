const ERC20TokenNN = artifacts.require('./ERC20TokenWithNegativeNumber.sol');
const chai = require('chai');
const truffleAssert = require('truffle-assertions');

chai.use(require('chai-as-promised'))
  .use(require('chai-bn')(web3.utils.BN))
  .should();

contract('ERC20TokenWithNegativeNumber', (accounts) => {
  const owner = accounts[0];

  const initialSupply = new web3.utils.BN(web3.utils.toWei('1000'));
  const decimals = new web3.utils.BN(18);
  const name = 'NAME';
  const symbol = 'SYMBOL';
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  describe('ERC20TokenWithNegativeNumber Construct test', async () => {
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('owner should have all the initialSupply', async () => {
      const balance = await tokenInstance.balanceOf.call(owner);

      balance.should.be.bignumber.equal(initialSupply);
    });

    it('totalSupply should be equal to initialSupply', async () => {
      const totalSupply = await tokenInstance.totalSupply.call();

      totalSupply.should.be.bignumber.equal(initialSupply);
    });

    it('should have the specified name', async () => {
      const tokenName = await tokenInstance.name.call();

      tokenName.should.equal(name);
    });

    it('should have the specified symbol', async () => {
      const tokenSymbol = await tokenInstance.symbol.call();

      tokenSymbol.should.equal(symbol);
    });

    it('should have the specified decimals', async () => {
      const tokenDecimals = await tokenInstance.decimals.call();

      tokenDecimals.should.be.bignumber.equal(decimals);
    });
  });

  describe('transfer', async () => {
    const recipient = accounts[1];
    const transferAmount = new web3.utils.BN(web3.utils.toWei('100', 'ether'));
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('Sender balance should be decreased after Transfer', async () => {
      const previousSenderBalance = await tokenInstance.balanceOf.call(owner);

      await tokenInstance.transfer(recipient, transferAmount);
      const balance = await tokenInstance.balanceOf.call(owner);
      balance.should.be.bignumber.equal(previousSenderBalance.sub(transferAmount));
    });

    it('Recipient balance should be increased After Transfer', async () => {
      const previousRecipientBalance = await tokenInstance.balanceOf.call(recipient);

      await tokenInstance.transfer(recipient, transferAmount);
      const recipientBalance = await tokenInstance.balanceOf.call(recipient);

      recipientBalance.should.be.bignumber.equal(previousRecipientBalance.add(transferAmount));
    });

    it('should emit an event After Transfer', async () => {
      // transfer ${transferAmount} from owner to recipient. owner => recipient transaction
      const tx = await tokenInstance.transfer(recipient, transferAmount);
      truffleAssert.eventEmitted(tx, 'Transfer', (event) => {
        event.from.should.equal(owner);
        event.to.should.equal(recipient);
        event.value.should.bignumber.equal(transferAmount);
        return true;
      }, 'Transfer Event should be emitted with correct params');
    });

    it('should fail when a user transfers more than balance', async () => {
      const brokenOwner = accounts[2];
      const balance = await tokenInstance.balanceOf.call(brokenOwner);
      const moreThanBalance = balance.add(new web3.utils.BN(web3.utils.toWei('100', 'ether')));
      await truffleAssert.fails(
        tokenInstance.transfer(recipient, moreThanBalance, { from: brokenOwner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail for invalid recipient(zero address)', async () => {
      await truffleAssert.fails(
        tokenInstance.transfer(zeroAddress, transferAmount),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when chain paused', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.transfer(recipient, transferAmount),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('approve', async () => {
    let tokenInstance;
    const spender = accounts[3];
    const spendAmount = new web3.utils.BN(web3.utils.toWei('1', 'ether'));

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('should succeed when valid approve request', async () => {
      const previousApprovedAmount = await tokenInstance.allowance.call(owner, spender);

      await tokenInstance.approve(spender, spendAmount, { from: owner });

      const approvedAmount = await tokenInstance.allowance.call(owner, spender);
      approvedAmount.should.be.bignumber.equal(previousApprovedAmount.add(spendAmount));
    });

    it('should add', async () => {
      const oneEther = new web3.utils.BN(web3.utils.toWei('1', 'ether'));
      const twoEther = new web3.utils.BN(web3.utils.toWei('2', 'ether'));

      await tokenInstance.approve(spender, oneEther, { from: owner });
      await tokenInstance.increaseAllowance(spender, oneEther, { from: owner });

      const approvedAmount = await tokenInstance.allowance.call(owner, spender);
      approvedAmount.should.be.bignumber.equal(twoEther);
    });

    it('to ZERO address should fail', async () => {
      await truffleAssert.fails(
        tokenInstance.approve(zeroAddress, spendAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('to ZERO address should fail', async () => {
      await truffleAssert.fails(
        tokenInstance.approve(zeroAddress, spendAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when trying to approve with negative number', async () => {
      const allowance = new web3.utils.BN(-1);

      await truffleAssert.fails(
        tokenInstance.approve(spender, allowance, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when chain paused', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.approve(spender, spendAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('transferFrom', async () => {
    let tokenInstance;
    const spender = accounts[5];
    const recipient = accounts[6];
    const allowedAmount = new web3.utils.BN(web3.utils.toWei('1', 'ether'));

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('should succeed', async () => {
      await tokenInstance.approve(spender, allowedAmount, { from: owner });

      await tokenInstance.transferFrom(owner, recipient, allowedAmount, { from: spender });

      const balanceOfRecipient = await tokenInstance.balanceOf.call(recipient);
      balanceOfRecipient.should.be.bignumber.equal(allowedAmount);
    });

    it('should emit an event if succeeded', async () => {
      await tokenInstance.approve(spender, allowedAmount, { from: owner });

      const tx = await tokenInstance.transferFrom(owner, recipient, allowedAmount, { from: spender });

      truffleAssert.eventEmitted(tx, 'Transfer', (event) => {
        event.from.should.equal(owner);
        event.to.should.equal(recipient);
        event.value.should.bignumber.equal(allowedAmount);
        return true;
      }, 'Transfer Event should be emitted with correct params');
    });

    it('should fail when spender spends more than allowed amount', async () => {
      const moreThanAllowedAmount = allowedAmount.add(new web3.utils.BN(1));
      await tokenInstance.approve(spender, allowedAmount, { from: owner });

      await truffleAssert.fails(
        tokenInstance.transferFrom(owner, recipient, moreThanAllowedAmount, { from: spender }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when holder owns less than allowed amount', async () => {
      const oneEther = new web3.utils.BN(web3.utils.toWei('1', 'ether'));
      const holder = accounts[8];

      await tokenInstance.transfer(holder, oneEther, { from: owner });

      await tokenInstance.approve(spender, oneEther, { from: holder });

      await tokenInstance.transfer(accounts[9], oneEther, { from: holder });

      await truffleAssert.fails(
        tokenInstance.transferFrom(holder, recipient, oneEther, { from: spender }),
        truffleAssert.ErrorType.REVERT,
      );
    });
    it('should fail when chain paused', async () => {
      await tokenInstance.approve(spender, allowedAmount, { from: owner });

      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.transferFrom(owner, recipient, allowedAmount, { from: spender }),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('burn', async () => {
    const burnAmount = new web3.utils.BN(web3.utils.toWei('100', 'ether'));
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('balance of a sender should be decreased after burn', async () => {
      const previousSenderBalance = await tokenInstance.balanceOf.call(owner);

      await tokenInstance.burn(burnAmount);
      const balance = await tokenInstance.balanceOf.call(owner);
      balance.should.be.bignumber.equal(previousSenderBalance.sub(burnAmount));
    });

    it('should emit an event after burn', async () => {
      const tx = await tokenInstance.burn(burnAmount);
      truffleAssert.eventEmitted(tx, 'Transfer', (event) => {
        event.from.should.equal(owner);
        event.to.should.equal(zeroAddress);
        event.value.should.bignumber.equal(burnAmount);
        return true;
      }, 'Transfer Event should be emitted with correct params');
      truffleAssert.eventEmitted(tx, 'Burn', (event) => {
        event.from.should.equal(owner);
        event.value.should.bignumber.equal(burnAmount);
        return true;
      }, 'Burn Event should be emitted with correct params');
    });

    it('should pass when a user is trying to burn more than balance the user have ', async () => {
      const emptyOwner = accounts[2];
      const balance = await tokenInstance.balanceOf.call(emptyOwner);
      const moreThanBalance = balance.add(new web3.utils.BN(web3.utils.toWei('100', 'ether')));

      const balanceOfOwnerBefore = await tokenInstance.balanceOf.call(emptyOwner);
      await tokenInstance.burn(moreThanBalance, { from: emptyOwner });
      const balanceOfOwnerAfter = await tokenInstance.balanceOf.call(emptyOwner);
      balanceOfOwnerAfter.should.be.bignumber.equal(balanceOfOwnerBefore.sub(moreThanBalance));
    });

    it('should fail when chain paused', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.burn(burnAmount),
        truffleAssert.ErrorType.REVERT,
      );
    });

  });

  describe('burnFrom', async () => {
    let tokenInstance;
    const burner = accounts[5];
    const allowedAmount = new web3.utils.BN(web3.utils.toWei('1', 'ether'));

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
      await tokenInstance.transfer(burner, allowedAmount, { from: owner });
    });

    it('should succeed', async () => {
      const balanceOfOwnerBefore = await tokenInstance.balanceOf.call(burner);
      await tokenInstance.approve(owner, allowedAmount, { from: burner });
      await tokenInstance.burnFrom(burner, allowedAmount, { from: owner });

      const balanceOfOwnerAfter = await tokenInstance.balanceOf.call(burner);
      balanceOfOwnerAfter.should.be.bignumber.equal(balanceOfOwnerBefore.sub(allowedAmount));
    });

    it('should emit an event if succeeded', async () => {
      await tokenInstance.approve(owner, allowedAmount, { from: burner });

      const tx = await tokenInstance.burnFrom(burner, allowedAmount, { from: owner });

      truffleAssert.eventEmitted(tx, 'Transfer', (event) => {
        event.from.should.equal(burner);
        event.to.should.equal(zeroAddress);
        event.value.should.bignumber.equal(allowedAmount);
        return true;
      }, 'Transfer Event should be emitted with correct params');
      truffleAssert.eventEmitted(tx, 'Burn', (event) => {
        event.from.should.equal(burner);
        event.value.should.bignumber.equal(allowedAmount);
        return true;
      }, 'Burn Event should be emitted with correct params');
    });

    it('should fail when burner spends more than allowed amount', async () => {
      const moreThanAllowedAmount = allowedAmount.add(new web3.utils.BN(1));
      await tokenInstance.approve(owner, allowedAmount, { from: burner });

      await truffleAssert.fails(
        tokenInstance.burnFrom(burner, moreThanAllowedAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should pass when holder owns less than allowed amount', async () => {
      // it allows to be negative number
      const oneEther = new web3.utils.BN(web3.utils.toWei('1', 'ether'));
      const holder = accounts[8];

      await tokenInstance.transfer(holder, oneEther, { from: owner });
      await tokenInstance.approve(owner, oneEther, { from: holder });
      await tokenInstance.transfer(accounts[9], oneEther, { from: holder });

      const balanceOfOwnerBefore = await tokenInstance.balanceOf.call(holder);
      await tokenInstance.burnFrom(holder, oneEther, { from: owner });
      const balanceOfOwnerAfter = await tokenInstance.balanceOf.call(holder);
      balanceOfOwnerAfter.should.be.bignumber.equal(balanceOfOwnerBefore.sub(oneEther));

    });

    it('should fail when a user who is not owner is trying to execute burnFrom', async () => {
      const oneEther = new web3.utils.BN(web3.utils.toWei('1', 'ether'));
      const holder = accounts[8];

      await tokenInstance.transfer(holder, oneEther, { from: owner });
      await tokenInstance.approve(burner, oneEther, { from: holder });

      await truffleAssert.fails(
        tokenInstance.burnFrom(holder, oneEther, { from: burner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
    it('should fail when chain paused', async () => {
      await tokenInstance.approve(owner, allowedAmount, { from: burner });

      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.burnFrom(burner, allowedAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('recover', async () => {
    const holder = accounts[1];
    const transferAmount = new web3.utils.BN(web3.utils.toWei('100', 'ether'));
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
      await tokenInstance.transfer(holder, transferAmount, { from: owner });
    });

    it('the balance of owner should be increased after Recover', async () => {
      const balanceOfOwnerBefore = await tokenInstance.balanceOf.call(owner);
      await tokenInstance.recover(holder, transferAmount, { from: owner });
      const balanceOfOwnerAfter = await tokenInstance.balanceOf.call(owner);

      balanceOfOwnerAfter.should.be.bignumber.equal(balanceOfOwnerBefore.add(transferAmount));
    });

    it('the balance of holder should be decreased After Recover', async () => {
      const balanceOfHolderBefore = await tokenInstance.balanceOf.call(holder);
      await tokenInstance.recover(holder, transferAmount, { from: owner });
      const balanceOfHolderAfter = await tokenInstance.balanceOf.call(holder);

      balanceOfHolderAfter.should.be.bignumber.equal(balanceOfHolderBefore.sub(transferAmount));
    });

    it('should emit an event After Recover', async () => {
      const tx = await tokenInstance.recover(holder, transferAmount, { from: owner});
      truffleAssert.eventEmitted(tx, 'Transfer', (event) => {
        event.from.should.equal(holder);
        event.to.should.equal(owner);
        event.value.should.bignumber.equal(transferAmount);
        return true;
      }, 'Transfer Event should be emitted with correct params');

      truffleAssert.eventEmitted(tx, 'Recover', (event) => {
        event.from.should.equal(holder);
        event.to.should.equal(owner);
        event.value.should.bignumber.equal(transferAmount);
        return true;
      }, 'Recover Event should be emitted with correct params');
    });

    it('should pass even if the owner is trying to recover the much balance than holder have', async () => {
      const balanceBefore = await tokenInstance.balanceOf.call(holder);
      const moreThanBalance = balanceBefore.add(new web3.utils.BN(web3.utils.toWei('100', 'ether')));
      await tokenInstance.recover(holder, moreThanBalance, { from: owner });

      const balanceAfter = await tokenInstance.balanceOf.call(holder);

      balanceAfter.should.be.bignumber.equal(balanceBefore.sub(moreThanBalance));
      balanceAfter.should.be.bignumber.lessThan(new web3.utils.BN(0));
    });

    it('should fail for invalid holder(zero address)', async () => {
      await truffleAssert.fails(
        tokenInstance.recover(zeroAddress, transferAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when a user who is not owner is trying to execute recover', async () => {
      const recipient = accounts[9];
      await tokenInstance.transfer(recipient, transferAmount, { from: owner });

      await truffleAssert.fails(
        tokenInstance.recover(recipient, transferAmount, { from: holder }),
        truffleAssert.ErrorType.REVERT,
      );
    });

    it('should fail when chain paused', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;

      await truffleAssert.fails(
        tokenInstance.recover(holder, transferAmount, { from: owner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('pause', async () => {
    const notOwner = accounts[1];
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
    });

    it('should pass when owner trying to invoke', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.false;
      await tokenInstance.pause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.true;
    });
    it('should fail when a user not owner is tyring to invoke', async () => {
      await truffleAssert.fails(
        tokenInstance.pause({ from: notOwner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
    it('should fail when paused already', async () => {
      await tokenInstance.pause();
      await truffleAssert.fails(
        tokenInstance.pause(),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });

  describe('unpause', async () => {
    const notOwner = accounts[1];
    let tokenInstance;

    beforeEach(async () => {
      tokenInstance = await ERC20TokenNN.new('NAME', 'SYMBOL', decimals, initialSupply);
      await tokenInstance.pause();
    });

    it('should pass when owner trying to invoke', async () => {
      const pausedBefore = await tokenInstance.paused.call();
      pausedBefore.should.be.true;
      await tokenInstance.unpause();
      const pausedAfter = await tokenInstance.paused.call();
      pausedAfter.should.be.false;
    });
    it('should fail when a user not owner is tyring to invoke', async () => {
      await truffleAssert.fails(
        tokenInstance.unpause({ from: notOwner }),
        truffleAssert.ErrorType.REVERT,
      );
    });
    it('should fail when paused already', async () => {
      await tokenInstance.unpause();

      await truffleAssert.fails(
        tokenInstance.unpause(),
        truffleAssert.ErrorType.REVERT,
      );
    });
  });
});
