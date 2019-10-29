const MainBridge = artifacts.require('./MainBridge.sol');
const SideBridge = artifacts.require('./SideBridge.sol');
const ERC20Token = artifacts.require('./ERC20Token.sol');
const TestHelper = require('./helpers');

const { BigNumber } = web3;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('MainBridge', (accounts) => {
  const sideChainId = 1024;
  const sideTokenName = 'Side Token';
  const sideTokenSymbol = 'PTKs';
  const conversionRate = 10;
  const conversionRateDecimals = 0;
  const mainAdmin = accounts[8];

  async function getNewMainBridge(isSideBridgeRegistered = false) {
    const mainChainId = 1000;
    const lambdaOperator = accounts[1];
    const authorities = [accounts[5], accounts[6], accounts[7]];
    const owner = accounts[0];
    const ERC20Deployed = await ERC20Token.deployed();
    const newMainBridge = await MainBridge.new(mainChainId, ERC20Deployed.address, mainAdmin, { from: owner });

    if (isSideBridgeRegistered) {
      const newSideBridge = await SideBridge.new(mainChainId, newMainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

      const requiredSignatures = 2;
      await newMainBridge.registerSideBridge(newSideBridge.address, requiredSignatures, authorities);
    }

    return newMainBridge;
  }

  describe('registerSideBridge', async () => {
    const authorities = [accounts[5], accounts[6], accounts[7]];

    describe('when register a valid sideBridge', async () => {
      const mainChainId = 1000;
      // const sideChainId = 2000;
      const lambdaOperator = accounts[1];

      it('should pass if owner register a valid SideBridge', async () => {
        const mainBridge = await MainBridge.deployed();
        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });
        const sideBridgeRegisteredEvent = mainBridge.SideBridgeRegistered({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest',
        });

        const requiredSignatures = 2;
        await mainBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities);

        const watcher = (err, event) => {
          sideBridgeRegisteredEvent.stopWatching();

          event.event.should.be.equal('SideBridgeRegistered');
        };

        await TestHelper.awaitEvent(sideBridgeRegisteredEvent, watcher);
      });

      it('should pass if owner register a valid SideBridge1', async () => {
        const mainBridge = await getNewMainBridge();

        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });
        const sideBridgeRegisteredEvent = mainBridge.SideBridgeRegistered({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest',
        });

        const requiredSignatures = 2;
        await mainBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities);

        const watcher = (err, event) => {
          sideBridgeRegisteredEvent.stopWatching();

          event.event.should.be.equal('SideBridgeRegistered');
        };

        await TestHelper.awaitEvent(sideBridgeRegisteredEvent, watcher);
      });

      it('should be reverted if registered by notOwner', async () => {
        const mainBridge = await getNewMainBridge();
        const noneOwnerAddress = accounts[2];
        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, 2, authorities, { from: noneOwnerAddress }));
      });

      it('should be reverted when authorities.length is greater than or equal to 256', async () => {
        const mainBridge = await getNewMainBridge();
        const tooManyAuthorities = Array(256).fill(accounts[5]);

        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, 150, tooManyAuthorities));
      });

      it('should be reverted if requiredSignatures is 0', async () => {
        const mainBridge = await getNewMainBridge();
        const requiredSignatures = 0;

        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities));
      });

      it('should be reverted if requiredSignatures is less than or equal to authorities.length / 2', async () => {
        const mainBridge = await getNewMainBridge();
        const requiredSignatures = authorities.length / 2;

        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });
        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities));
      });

      it('should be reverted if requiredSignatures is greater than or equal to authorities.length', async () => {
        const mainBridge = await getNewMainBridge();

        const sideBridge = await SideBridge.new(mainChainId, mainBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, authorities.length, authorities));
        await TestHelper.expectThrow2(mainBridge.registerSideBridge(sideBridge.address, authorities.length + 1, authorities));
      });
    });

    it('should be reverted if sideBridge address is invalid', async () => {
      const mainBridge = await getNewMainBridge();
      const invalidBridgeAddress = 0x0;

      await TestHelper.expectThrow2(mainBridge.registerSideBridge(invalidBridgeAddress, 2, authorities));
    });
  });

  describe('registerSideToken', async () => {
    let mainBridge;
    beforeEach(async () => {
      mainBridge = await getNewMainBridge(true);
    });

    it('should emit SideTokenRegistered event when registered', async () => {
      const currentBlock = web3.eth.getBlock('latest').number;
      const sideTokenRegisteredEvent = mainBridge.SideTokenRegistered({ fromBlock: currentBlock, toBlock: 'latest' });
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      const watcher = async (err, event) => {
        sideTokenRegisteredEvent.stopWatching();

        event.event.should.be.equal('SideTokenRegistered');
        event.args.sideTokenId.should.be.equal(sideTokenId);
        event.args.sideChainId.should.be.bignumber.equal(new BigNumber(sideChainId));
        event.args.name.should.be.equal(sideTokenName);
        event.args.symbol.should.be.equal(sideTokenSymbol);
        event.args.conversionRate.should.be.bignumber.equal(new BigNumber(conversionRate));
        event.args.conversionRateDecimals.should.be.bignumber.equal(new BigNumber(conversionRateDecimals));
        event.args.decimals.should.be.bignumber.equal(new BigNumber(18));
      };

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      await TestHelper.awaitEvent(sideTokenRegisteredEvent, watcher);
    });

    it('should not add a Side Token when the transaction is not from the owner', async () => {
      const differentTokenName = `${sideTokenName}DIFF`;

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, differentTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      const resultPromise = mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId, { from: accounts[1] });
      await TestHelper.expectThrow2(resultPromise);
    });

    it('should not add a Side Token when sideTokenId not matched', async () => {
      const differentTokenName = `${sideTokenName}DIFF`;

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, differentTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await TestHelper.expectThrow2(mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId));
    });

    it('should not add a Side Token when name is empty', async () => {
      const emptyTokenName = '';
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, emptyTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      const resultPromise = mainBridge.registerSideToken(sideChainId, emptyTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);
      await TestHelper.expectThrow2(resultPromise);
    });

    it('should not add a Side Token when symbol is empty', async () => {
      const emptyTokenSymbol = '';
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, emptyTokenSymbol, conversionRate, conversionRateDecimals);

      const resultPromise = mainBridge.registerSideToken(sideChainId, sideTokenName, emptyTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);
      await TestHelper.expectThrow2(resultPromise);
    });

    it('should not add a Side Token when symbol is too long', async () => {
      const tooLongTokenSymbol = '12345678';
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, tooLongTokenSymbol, conversionRate, conversionRateDecimals);

      const resultPromise = mainBridge.registerSideToken(sideChainId, sideTokenName, tooLongTokenSymbol, conversionRate, sideTokenId, conversionRateDecimals);
      await TestHelper.expectThrow2(resultPromise);
    });

    it('should not add a Side Token when symbol is too long2', async () => {
      const tooLongTokenSymbol = '12345678';
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, tooLongTokenSymbol, conversionRate, conversionRateDecimals);

      const resultPromise = mainBridge.registerSideToken(sideChainId, sideTokenName, tooLongTokenSymbol, conversionRate, sideTokenId, conversionRateDecimals);
      await TestHelper.expectThrow2(resultPromise);
    });
  });

  describe('deposit', async () => {
    let mainBridge;
    let mainToken;
    beforeEach(async () => {
      mainBridge = await getNewMainBridge();
      mainToken = await ERC20Token.deployed();
    });
    const DEPOSIT_AMOUNT = 100;

    it('should deposit successfully', async () => {
      const depositEvent = mainBridge.Deposited();

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      const watcher = async (err, event) => {
        depositEvent.stopWatching();

        if (err) { throw err; }

        const depositedParams = event.args;

        event.event.should.be.equal('Deposited');
        depositedParams.beneficiary.should.be.equal(accounts[0]);
        depositedParams.amountST.should.be.bignumber.equal(new BigNumber(DEPOSIT_AMOUNT).mul(conversionRate));
      };

      await mainToken.approve(mainBridge.address, DEPOSIT_AMOUNT);

      await mainBridge.deposit(sideTokenId, DEPOSIT_AMOUNT);
      await TestHelper.awaitEvent(depositEvent, watcher);
    });

    it('should deposit successfully with approveAndCall', async () => {
      const depositEvent = mainBridge.Deposited();

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      const watcher = async (err, event) => {
        depositEvent.stopWatching();

        if (err) { throw err; }

        const depositedParams = event.args;

        event.event.should.be.equal('Deposited');
        depositedParams.beneficiary.should.be.equal(accounts[0]);
        depositedParams.amountST.should.be.bignumber.equal(new BigNumber(DEPOSIT_AMOUNT).mul(conversionRate));
      };

      await mainToken.approveAndCall(mainBridge.address, DEPOSIT_AMOUNT, sideTokenId, { from: accounts[0] });

      await TestHelper.awaitEvent(depositEvent, watcher);
    });

    it('should deposit successfully with ownerDeposit', async () => {
      const depositEvent = mainBridge.Deposited();

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      const watcher = async (err, event) => {
        depositEvent.stopWatching();

        if (err) { throw err; }

        const depositedParams = event.args;

        event.event.should.be.equal('Deposited');
        depositedParams.beneficiary.should.be.equal(accounts[1]);
        depositedParams.amountST.should.be.bignumber.equal(new BigNumber(DEPOSIT_AMOUNT).mul(conversionRate));
      };

      await mainToken.transfer(accounts[1], DEPOSIT_AMOUNT);
      await mainToken.approve(mainBridge.address, DEPOSIT_AMOUNT, { from: accounts[1] });

      await mainBridge.ownerDeposit(accounts[1], sideTokenId, DEPOSIT_AMOUNT, { from: accounts[0] });
      // await mainBridge.deposit(sideTokenId, DEPOSIT_AMOUNT);
      await TestHelper.awaitEvent(depositEvent, watcher);
    });

    it('should fail when approved amount is less than requested amount', async () => {
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      await mainToken.approve(mainBridge.address, DEPOSIT_AMOUNT - 1);

      const depositPromise = mainBridge.deposit(sideTokenId, DEPOSIT_AMOUNT);

      await TestHelper.expectThrow2(depositPromise);
    });

    it('should be reverted for invalid side token', async () => {
      const ZERO_PRODUCT_TOKEN_ID = 0;
      const depositPromise = mainBridge.deposit(ZERO_PRODUCT_TOKEN_ID, DEPOSIT_AMOUNT);

      await TestHelper.expectThrow2(depositPromise);
    });

    it('should be reverted for zero amount', async () => {
      const ZERO_AMOUNT = 0;

      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      const depositPromise = mainBridge.deposit(sideTokenId, ZERO_AMOUNT);

      await TestHelper.expectThrow2(depositPromise);
    });

    it('should be reverted for not registered', async () => {
      const tokenNameNotRegistered = `${sideTokenName}_NOT_REGISTERED`;
      const sideTokenIdNotRegistered = await mainBridge.hashSideTokenId.call(sideChainId, tokenNameNotRegistered, sideTokenSymbol, conversionRate, conversionRateDecimals);

      const depositPromise = mainBridge.deposit(sideTokenIdNotRegistered, 100);

      await TestHelper.expectThrow2(depositPromise);
    });

    it('should be reverted if nonOwner calls ownerDeposit', async () => {
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

      await mainToken.transfer(accounts[1], DEPOSIT_AMOUNT);
      await mainToken.approve(mainBridge.address, DEPOSIT_AMOUNT, { from: accounts[1] });

      await TestHelper.expectThrow2( mainBridge.ownerDeposit(accounts[1], sideTokenId, DEPOSIT_AMOUNT, { from: accounts[2] }));
    });

    it('should be reverted if bridge is paused and deposit is called', async () => {
      const sideTokenId = await mainBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

      await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);
      await mainToken.approve(mainBridge.address, DEPOSIT_AMOUNT);

      await mainBridge.pauseBridge({ from: mainAdmin });

      await TestHelper.expectThrow2(mainBridge.deposit(sideTokenId, DEPOSIT_AMOUNT));
      await TestHelper.expectThrow2(mainBridge.ownerDeposit(accounts[5], sideTokenId, 100));
    });
  });

  describe('stake', async () => {
    let mainBridge;
    let mainToken;
    beforeEach(async () => {
      mainBridge = await getNewMainBridge();
      mainToken = await ERC20Token.deployed();
    });

    const staker = accounts[0];

    it('should succeed when a user stake token equal to the approved amount', async () => {
      const stakingAmount = new BigNumber(100);
      const previousBalanceOfMainBridge = await mainToken.balanceOf(mainBridge.address);
      const previousBalanceOfStaker = await mainToken.balanceOf(staker);

      await mainToken.approve(mainBridge.address, stakingAmount, { from: staker });

      await mainBridge.stake(stakingAmount, { from: staker });

      const balanceOfMainBridge = await mainToken.balanceOf(mainBridge.address);
      const balanceOfStaker = await mainToken.balanceOf(staker);
      balanceOfMainBridge.should.be.bignumber.equal(previousBalanceOfMainBridge.add(stakingAmount));
      balanceOfStaker.should.be.bignumber.equal(previousBalanceOfStaker.sub(stakingAmount));

      const stakedAmount = await mainBridge.stakedAmount.call(staker);
      stakedAmount.should.be.bignumber.equal(stakingAmount);
    });

    it('should fail when a user stake the amount of zero', async () => {
      const stakingAmount = new BigNumber(0);

      TestHelper.expectThrow(mainBridge.stake(stakingAmount, { from: staker }));
    });

    it('should fail when a user stake more than the approved amount', async () => {
      const approvingAmount = new BigNumber(100);

      await mainToken.approve(mainBridge.address, approvingAmount, { from: staker });
      const approvedAmount = await mainToken.allowance.call(staker, mainBridge.address);

      const stakingAmount = approvedAmount.plus(1);

      TestHelper.expectThrow(mainBridge.stake(stakingAmount, { from: staker }));
    });
  });

  describe('unstake', async () => {
    let mainBridge;
    let mainToken;
    beforeEach(async () => {
      mainBridge = await getNewMainBridge();
      mainToken = await ERC20Token.deployed();
    });
    const staker = accounts[0];

    it('should succeed when unstaking amount is less than or equal to the staked amount', async () => {
      const unstakedEvent = mainBridge.Unstaked();
      const stakingAmount = new BigNumber(100);

      await mainToken.approve(mainBridge.address, stakingAmount, { from: staker });
      await mainBridge.stake(stakingAmount, { from: staker });

      const afterStakedAmount = await mainBridge.stakedAmount.call(staker);

      await mainBridge.unstake(afterStakedAmount, { from: staker });

      const watcher = async (error, event) => {
        unstakedEvent.stopWatching();

        const afterUnstakedAmount = await mainBridge.stakedAmount.call(staker);

        event.event.should.be.equal('Unstaked');
        event.args.amount.should.be.bignumber.equal(afterStakedAmount);
        event.args.owner.should.be.equal(staker);
        afterUnstakedAmount.should.be.bignumber.equal(new BigNumber(0));
      };

      TestHelper.awaitEvent(unstakedEvent, watcher);
    });

    it('should fail when unstaking amount is larger than the staked amount', async () => {
      const stakedAmount = await mainBridge.stakedAmount.call(staker);

      const moreAmount = stakedAmount.add(1);
      TestHelper.expectThrow2(mainBridge.unstake(moreAmount, { from: staker }));
    });

    it('should fail when unstaking amount is 0', async () => {
      const zeroAmount = new BigNumber(0);

      TestHelper.expectThrow2(mainBridge.unstake(zeroAmount, { from: staker }));
    });
  });

  describe('Pause/Resume', async () => {
    let mainBridge;
    let mainToken;
    let pausedBridge;
    beforeEach(async () => {
      mainBridge = await getNewMainBridge();
      mainToken = await ERC20Token.deployed();
      pausedBridge = await getNewMainBridge();
      pausedBridge.pauseBridge({ from: mainAdmin });
    });
    const operator = accounts[0];

    it('should pause when isPaused == false and mainAdmin calls pauseBridge', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await mainBridge.pauseBridge({ from: mainAdmin });

      const postPauseValue = await mainBridge.isPaused.call();
      postPauseValue.should.be.equal(true);
    });

    it('should pause when isPaused == false and operator(owner) calls pauseBridge', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await mainBridge.pauseBridge({ from: operator });

      const postPauseValue = await mainBridge.isPaused.call();
      postPauseValue.should.be.equal(true);
    });

    it('should resume when isPaused == true and mainAdmin calls resumeBridge', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await mainBridge.pauseBridge({ from: mainAdmin });

      const postPauseValue = await mainBridge.isPaused.call();
      postPauseValue.should.be.equal(true);

      await mainBridge.resumeBridge({ from: mainAdmin });

      const post2PauseValue = await mainBridge.isPaused.call();
      post2PauseValue.should.be.equal(false);
    });

    it('should resume when isPaused == true and operator(owner) calls resumeBridge', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await mainBridge.pauseBridge({ from: operator });

      const postPauseValue = await mainBridge.isPaused.call();
      postPauseValue.should.be.equal(true);

      await mainBridge.resumeBridge({ from: operator });

      const post2PauseValue = await mainBridge.isPaused.call();
      post2PauseValue.should.be.equal(false);
    });

    it('should fail when isPaused == false and mainAdmin calls resumeBridge', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await TestHelper.expectThrow2(mainBridge.resumeBridge({ from: mainAdmin }));
    });

    it('should fail when mainAdmin calls pauseBridge eventhough mainBridge is already paused', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await mainBridge.pauseBridge({ from: mainAdmin });

      const postPauseValue = await mainBridge.isPaused.call();
      postPauseValue.should.be.equal(true);

      await TestHelper.expectThrow2(mainBridge.pauseBridge({ from: mainAdmin }));
    });

    it('should fail when msg.sender is not mainAdmin and owner', async () => {
      const prevPauseValue = await mainBridge.isPaused.call();

      prevPauseValue.should.be.equal(false);
      await TestHelper.expectThrow2(mainBridge.pauseBridge({ from: accounts[1] }));
      await TestHelper.expectThrow2(mainBridge.pauseBridge({ from: accounts[2] }));
    });

    describe('Paused', async () => {
      it('should fail when isPaused == true && other contract functions called', async () => {
        const authorities = [accounts[5], accounts[6], accounts[7]];
        const mainChainId = 1000;
        // const sideChainId = 2000;
        const lambdaOperator = accounts[1];
        const sideBridge = await SideBridge.new(mainChainId, pausedBridge.address, sideChainId, 2, authorities, { from: lambdaOperator });

        const requiredSignatures = 2;
        await TestHelper.expectThrow2(pausedBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities));
      });
    });

  });
});
