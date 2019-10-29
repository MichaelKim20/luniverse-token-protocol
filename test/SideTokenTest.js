var MainBridge = artifacts.require('./MainBridge.sol');
var SideBridge = artifacts.require('./SideBridge.sol');
var ERC20Token = artifacts.require('./ERC20Token.sol');
var TokenVesting = artifacts.require('./TokenVesting.sol');
var SideToken = artifacts.require('./SideToken.sol');

var TestHelper = require("./helpers");

var should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

var BigNumber = web3.BigNumber;

contract('Between MainBridge to SideBridge', (accounts) => {
  let homeChainId = 1000;
  let sideChainId = 2000;
  let authorities = [accounts[4], accounts[5], accounts[6]];

  let consortiumPartner = accounts[1];
  let lambdaOperator = accounts[0];
  let sideDeveloper;

  var sideTokenId;

  var fromBlock;

  let mainToken;
  let mainBridge;
  let sideBridge;
  let sideToken;

  const zeroEther = new BigNumber(0);
  const oneEther = new BigNumber(web3.toWei(1, 'ether'));
  const twoEther = new BigNumber(web3.toWei(2, 'ether'));
  const threeEther = new BigNumber(web3.toWei(3, 'ether'));

  var sideTokenName = "SideToken1";
  var sideTokenSymbol = "PT1";

  describe("For conversionRateDecimals is 0", async function() {
    let conversionRateDecimals = 0;
    let conversionRate = 3;

    before(async function () {
      await initSideBridge(conversionRate, conversionRateDecimals);
    });

    beforeEach(function () {
      /**
       * TODO: Test Code 를 동기로 작성
       * Test Code 를 async 하게 만들면 Truffle 이 test case 간 간섭을 일으켜서, 테스트 슈트가 일관성이 없이 불안정하게 동작한다.
       * 테스트 코드를 모두 동기로 작성해야 불안정성을 줄일 수 있다.
       * 테스트 코드들이 비동기로 실행되면서 서로 간섭을 일으키는 문제를 임시로 해결하기 위해서, 테스트 케이스 실행 간에 시간 간격을 두어서 임시로 문제를 해결했다.
       * 비동기로 작성된 테스트 케이스를 동기로 변경한 후에 sleep 을 삭제해야 한다.
       */
      console.log('beforEach: This should be removed after changing every test case synchronous')
      sleep(1000);
    });

    describe("SideToken", function () {
      it("should not created for zero SideBridge address", async function () {
        let zeroSideBridgeAddress = 0;

        SideToken.new(sideTokenName, sideTokenSymbol, 18, zeroSideBridgeAddress)
          .then(() => {
            should.fail(0, 1, 'This must not be run', '')
          })
          .catch((error) => {
            error.message.should.contain('revert');
          })
          .catch((error) => {
            const gethRevertMessage = 'The contract code couldn\\\'t be stored, please check your gas amount';
            error.message.should.contain(gethRevertMessage)
          });
      });

      describe("TxApi", function () {

        sideDeveloper = accounts[5];
        const user = accounts[9];
        const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
        const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

        beforeEach(async function () {
          const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

          await depositToSideBridge(authorities[0], sideDeveloper, depositResult);
          await depositToSideBridge(authorities[1], sideDeveloper, depositResult);

          const previousBalance = await sideToken.balanceOf.call(user);
          await sideToken.transfer(user, depositAmountInPT, {from: sideDeveloper});

          const balance = await sideToken.balanceOf.call(user);
          balance.should.be.bignumber.equal(depositAmountInPT.add(previousBalance));
        });

        it("Stake", async function () {
          await sideToken.stake(oneEther, {from: user});

          const sideTokenStakedEvent = sideBridge.SideTokenStaked();

          let watcher = function (err, event) {
            sideTokenStakedEvent.stopWatching();

            event.event.should.be.equal('SideTokenStaked');
            event.args.staker.should.be.equal(user);
            event.args.sideTokenId.should.be.equal(sideTokenId);
            event.args.amount.should.be.bignumber.equal(oneEther);

          }
          await TestHelper.awaitEvent(sideTokenStakedEvent, watcher);
        });

        it("Unstake", async function () {
          await sideToken.stake(oneEther, {from: user});

          const sideTokenUnstakedEvent = sideBridge.SideTokenUnstaked({
            fromBlock: web3.eth.blockNumber,
            lastBlock: 'latest'
          });

          await sideToken.unstake(oneEther, {from: user});

          let watcher = function (err, event) {
            sideTokenUnstakedEvent.stopWatching();

            event.event.should.be.equal('SideTokenUnstaked');
            event.args.recipient.should.be.equal(user);
            event.args.sideTokenId.should.be.equal(sideTokenId);
            event.args.amount.should.be.bignumber.equal(oneEther);

          }

          await TestHelper.awaitEvent(sideTokenUnstakedEvent, watcher);
        });

        it("Vest", async function () {
          const cliff = 10;
          const duration = 20;
          const interval = 1;

          const sideTokenVestedEvent = sideBridge.SideTokenVested({
            fromBlock: web3.eth.blockNumber,
            toBlock: 'latest'
          });

          await sideToken.vest(oneEther, cliff, duration, interval, {from: user});

          let watcher = function (err, event) {
            sideTokenVestedEvent.stopWatching();

            event.event.should.be.equal('SideTokenVested');
            event.args.tokenVest.should.be.not.equal(0);
            event.args.recipient.should.be.equal(user);
            event.args.sideTokenId.should.be.equal(sideTokenId);
            event.args.amount.should.be.bignumber.equal(oneEther);
          }

          await TestHelper.awaitEvent(sideTokenVestedEvent, watcher);
        });

      });
    });

    describe("Deposit", function () {
      sideDeveloper = accounts[2];
      const depositAmount = new BigNumber(web3.toWei(1, "ether"));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      it("should mint to sideDeveloper on sideBridge when enough signers sign to mint", async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);
        const previousTotalSupply = await sideToken.totalSupply.call();

        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        // if signedCount >= 2, mint the deposit
        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);
        await depositToSideBridge(authorities[1], sideDeveloper, depositResult);

        await assertMainTokenDeposited(depositAmount, depositAmountInPT);

        const balance = await sideToken.balanceOf.call(sideDeveloper);
        balance.should.be.bignumber.equal(depositAmountInPT.add(previousBalance));

        const totalSupply = await sideToken.totalSupply.call();
        totalSupply.should.be.bignumber.equal(depositAmountInPT.add(previousTotalSupply));
      });

      it("should not minted when signedCount is less than requiredSignatures", async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        const events = await sideBridge.SideTokenMinted({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});

        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);

        const logCount = await TestHelper.countEvent(events);
        logCount.should.be.equal(0);
      });

      it("should not minted when beneficiary is invalid", async function () {
        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        TestHelper.expectThrow(depositWithInvalidBeneficiaryTo(sideBridge, authorities[0], sideDeveloper, depositResult))
      });
    });

    describe("confirmDeposit", async function () {
      it("should emit DepositConfirmed", async function () {
        // given
        const depositId = await getDepositId_AfterDeposit(oneEther);

        // when
        const depositConfirmedEvent = mainBridge.DepositConfirmed({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});
        await mainBridge.confirmDeposit(depositId, {from: authorities[0]});
        await mainBridge.confirmDeposit(depositId, {from: authorities[1]});

        // then
        const watcher = function (err, event) {
          depositConfirmedEvent.stopWatching();

          event.event.should.be.equal('DepositConfirmed');
          event.args.sideTokenId.should.be.equal(sideTokenId);
          event.args.amountMT.should.bignumber.equal(oneEther);
          event.args.amountST.should.bignumber.equal(oneEther.mul(conversionRate));
          event.args.beneficiary.should.be.equal(accounts[0]);
        }

        await TestHelper.awaitEvent(depositConfirmedEvent, watcher);
      })

      it("should be reverted, if called by non-authority", async function () {
        const noneAuthority = accounts[1];

        const depositId = await getDepositId_AfterDeposit(oneEther);

        // when - then
        TestHelper.expectThrow(mainBridge.confirmDeposit(depositId, {from: noneAuthority}));
      })

      it("should be reverted for invalid depositId", async function () {
        const noneAuthority = accounts[1];

        const depositId = await getDepositId_AfterDeposit(oneEther);

        const invalidDepositId = '0x0123';

        // when - then
        TestHelper.expectThrow(mainBridge.confirmDeposit(invalidDepositId, {from: noneAuthority}));
      })

      async function getDepositId_AfterDeposit(depositAmount) {
        const sideTokenDepositedEvent = mainBridge.Deposited({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});
        await mainToken.approve(mainBridge.address, depositAmount);
        await mainBridge.deposit(sideTokenId, depositAmount);
        const depositId = await getDepositId(sideTokenDepositedEvent);
        return depositId;
      }

      async function getDepositId(sideTokenDepositedEvent) {
        let depositId;

        const watcher = function (err, event) {
          sideTokenDepositedEvent.stopWatching();

          event.event.should.be.equal('Deposited');
          depositId = event.args.depositId;
        }

        await TestHelper.awaitEvent(sideTokenDepositedEvent, watcher);

        return depositId;
      }
    });

    describe("transferWithFee", function () {
      sideDeveloper = accounts[5];
      const user = accounts[9];
      const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      beforeEach(async function () {
        const previousBalance = await sideToken.balanceOf.call(user);

        await depositAndConfirm(sideDeveloper, depositAmount, depositAmountInPT, authorities);

        await sideToken.transfer(user, depositAmountInPT, {from: sideDeveloper});

        const balance = await sideToken.balanceOf.call(user);
        balance.should.be.bignumber.equal(depositAmountInPT.add(previousBalance));
      });

      it("should fail when amount + fee is less than the balance", async function () {
        const recipient = accounts[6];

        const amount = new BigNumber(web3.toWei(1, 'ether'));
        const fee = new BigNumber(web3.toWei(0.5, 'ether'));

        const transferredWithFeeEvent = sideToken.TransferredWithFee({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest'
        });

        const brokerPreviousBalance = await sideToken.balanceOf.call(sideDeveloper);

        // when

        await sideToken.transferWithFee(recipient, amount, sideDeveloper, fee, {from: user});

        // then

        let watcher = function (err, event) {
          transferredWithFeeEvent.stopWatching();

          event.event.should.be.equal('TransferredWithFee');
          event.args.to.should.be.equal(recipient);
          event.args.amount.should.be.bignumber.equal(amount);
          event.args.feeCollector.should.be.equal(sideDeveloper);
          event.args.fee.should.be.bignumber.equal(fee);
        }

        await TestHelper.awaitEvent(transferredWithFeeEvent, watcher);
        const brokerBalance = await sideToken.balanceOf.call(sideDeveloper);
        brokerBalance.should.be.bignumber.equal(brokerPreviousBalance.add(fee));

        const recipientBalance = await sideToken.balanceOf.call(recipient);
        recipientBalance.should.be.bignumber.equal(amount);
      });

      it("should succeed when amount + fee is more than the balance", async function () {
        const recipient = accounts[6];

        const balance = await sideToken.balanceOf.call(user);
        const fee = balance.minus(1);
        const amount = balance.minus(fee).plus(1);

        // when
        TestHelper.expectThrow(sideToken.transferWithFee(recipient, amount, sideDeveloper, fee, {from: user}));
      });
    });

    describe("Stake", function () {
      sideDeveloper = accounts[5];
      const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      beforeEach(async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);
        const previousBalance2 = await sideToken.balanceOf.call(sideDeveloper);
        await depositToSideBridge(authorities[1], sideDeveloper, depositResult);

        const balance = await sideToken.balanceOf.call(sideDeveloper);
        balance.should.be.bignumber.equal(depositAmountInPT.add(previousBalance));
      });

      it("sould not be called directly", async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);
        await sideToken.approve(sideBridge.address, oneEther, {from: sideDeveloper});

        TestHelper.expectThrow(sideBridge.stake(sideTokenId, sideDeveloper, oneEther, {from: sideDeveloper}));
      });

      it("staked amount should be equal to staking amount", async function () {
        const sideTokenStakedEvent = sideBridge.SideTokenStaked({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest'
        });

        const previousBalance = await sideToken.balanceOf.call(sideBridge.address);

        // When
        await sideToken.stake(oneEther, {from: sideDeveloper});

        // Then
        await assertSideTokenStaked(oneEther, sideTokenStakedEvent);

        const balance = await sideToken.balanceOf.call(sideBridge.address);
        balance.should.be.bignumber.equal(oneEther.add(previousBalance));

        const stakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);
        stakedAmount.should.be.bignumber.equal(oneEther);
      });

      it("staked amount should be accumulated", async function () {
        const sideTokenStakedEvent = sideBridge.SideTokenStaked({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest'
        });

        const previousBalance = await sideToken.balanceOf.call(sideBridge.address);
        const previousStakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);

        // When
        await sideToken.stake(oneEther, {from: sideDeveloper});
        await sideToken.stake(oneEther, {from: sideDeveloper});

        // Then
        await assertSideTokenStaked(oneEther, sideTokenStakedEvent);

        const balance = await sideToken.balanceOf.call(sideBridge.address);
        balance.should.be.bignumber.equal(twoEther.add(previousBalance));

        const stakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);
        stakedAmount.should.be.bignumber.equal(twoEther.add(previousStakedAmount));
      });

      it("should fail if user stakes more than he has", async function () {
        const balance = await sideToken.balanceOf.call(sideDeveloper);

        const moreThanBalance = balance.add(1);

        TestHelper.expectThrow(sideToken.stake(moreThanBalance, {from: sideDeveloper}));
      });

      async function assertSideTokenStaked(stakingAmount, sideTokenStakedEvent) {
        let watcher = function (err, event) {
          sideTokenStakedEvent.stopWatching();

          event.event.should.be.equal('SideTokenStaked');
          event.args.sideTokenId.should.be.equal(sideTokenId);
          event.args.amount.should.be.bignumber.equal(stakingAmount);
        }

        await TestHelper.awaitEvent(sideTokenStakedEvent, watcher);
      }
    });

    describe("Unstake", function () {
      sideDeveloper = accounts[6];
      const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      beforeEach(async function () {
        sleep(1000);
        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);

        await depositToSideBridge(authorities[1], sideDeveloper, depositResult);
      });

      it("should pass when a user unstakes equal to the Staked Amount", async function () {
        // Given
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        await sideToken.stake(twoEther, {from: sideDeveloper});

        const previousBalance2 = await sideToken.balanceOf.call(sideDeveloper);

        // When
        await sideToken.unstake(twoEther, {from: sideDeveloper});

        // Then
        const balance = await sideToken.balanceOf.call(sideDeveloper);
        balance.should.be.bignumber.equal(previousBalance);
      });

      it("stakedAmount should not be zero when a user unstakes less than Staked Amount", async function () {
        // Given
        const previousStakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        await sideToken.stake(twoEther, {from: sideDeveloper});
        const balanceAfterStake = await sideToken.balanceOf.call(sideDeveloper);

        // When sideDeveloper unstakes less than staked amount
        await sideToken.unstake(oneEther, {from: sideDeveloper});

        // Then sideDeveloper's balance should be increased by one ether
        const balance = await sideToken.balanceOf.call(sideDeveloper);
        const stakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);
        balance.should.be.bignumber.equal(previousBalance.minus(oneEther));

        // Then staked amount must be oneEther
        stakedAmount.should.be.bignumber.equal(oneEther.add(previousStakedAmount));
      });

      it("should fail when a user unstakes more than Staked Amount", async function () {
        // Given
        const stakingAmount = new BigNumber(web3.toWei(2, 'ether'));

        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        await sideToken.stake(stakingAmount, {from: sideDeveloper});

        const stakedAmount = await sideBridge.stakedAmount.call(sideTokenId, sideDeveloper);
        const moreThanStakedAmount = stakedAmount.plus(1);

        // When - Then
        TestHelper.expectThrow(sideToken.unstake(moreThanStakedAmount, {from: sideDeveloper}));
      });

      it("should fail when a user unstakes without staking", async function () {
        const unstakingAmount = new BigNumber(web3.toWei(1, 'ether'));

        TestHelper.expectThrow(sideBridge.unstake(sideTokenId, sideDeveloper, unstakingAmount));
      });
    });

    describe("Vest", function () {
      sideDeveloper = accounts[7];
      const depositAmount = new BigNumber(web3.toWei(100, 'ether'));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      const fiveEther = new BigNumber(web3.toWei(5, 'ether'));

      let lastBlock;
      let midBlock
      let start;
      let cliffInDays;
      let durationInDays;
      let intervalInDays;

      beforeEach(async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);

        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);
        await depositToSideBridge(authorities[1], sideDeveloper, depositResult);

        lastBlock = await web3.eth.getBlock('latest');
        const midBlockNumber = Math.max(0, Math.floor(lastBlock.number / 2));

        midBlock = await web3.eth.getBlock(midBlockNumber);

        start = new BigNumber(midBlock.timestamp);
      });

      describe("Vesting", function () {

        cliffInDays = new BigNumber(10);
        durationInDays = new BigNumber(10);
        intervalInDays = new BigNumber(1);

        it("should succeed when user vesting less than approved amount", async function () {
          // Whenit
          await sideToken.vest(fiveEther, cliffInDays, durationInDays, intervalInDays, {from: sideDeveloper});

          // Then
          const sideTokenVested = sideBridge.SideTokenVested();

          const watcher = function (err, event) {
            sideTokenVested.stopWatching();

            event.event.should.be.equal('SideTokenVested');
            event.args.tokenVest.should.be.not.equal(0);
            event.args.recipient.should.be.equal(sideDeveloper);
            event.args.amount.should.be.bignumber.equal(fiveEther);
            event.args.duration.should.be.bignumber.equal(durationInDays);
            event.args.cliff.should.be.bignumber.equal(cliffInDays);
          };

          await TestHelper.awaitEvent(sideTokenVested, watcher);
          const vestCount = await sideBridge.vestCount.call(sideDeveloper);
          vestCount.should.be.bignumber.equal(new BigNumber(1));

          const tokenVestingContractAddress = await sideBridge.vestInfo.call(sideDeveloper, 0);

          const tokenVesting = TokenVesting.at(tokenVestingContractAddress);

          const recipient = await tokenVesting.recipient.call();
          recipient.should.be.equal(sideDeveloper);

          const vestedAmount = await tokenVesting.vestedAmount.call();
          vestedAmount.should.be.bignumber.equal(fiveEther);
        });

        it("Request must be stored separately", async function () {
          const previousVestCount = await sideBridge.vestCount.call(sideDeveloper);

          // When
          await sideToken.vest(oneEther, cliffInDays, durationInDays, intervalInDays, {from: sideDeveloper});
          await sideToken.vest(twoEther, cliffInDays, durationInDays, intervalInDays, {from: sideDeveloper});

          // Then
          const vestCount = await sideBridge.vestCount.call(sideDeveloper);
          vestCount.should.be.bignumber.equal(new BigNumber(2).add(previousVestCount));
        });

        it("should fail when vesting more than approved amount", async function () {
          approvedAmount = await sideToken.allowance.call(sideDeveloper, sideBridge.address);

          // When
          moreThanApprovedAmount = approvedAmount.plus(1);
          TestHelper.expectThrow(sideBridge.vest(sideTokenId, sideDeveloper, moreThanApprovedAmount, cliffInDays, durationInDays, intervalInDays, {from: sideDeveloper}));
        });
      });

      describe("Releasing", function () {
        const SECONDS_IN_A_DAY = 86400;

        const tenEther = new BigNumber(web3.toWei(10, 'ether'));
        const nineEther = new BigNumber(web3.toWei(9, 'ether'));
        const sixEther = new BigNumber(web3.toWei(6, 'ether'));

        const testDataSet = [
          {
            cliffInDays: 0,
            durationInDays: 1,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 0,
            releaseAmountADay: tenEther,
            releaseAmount: tenEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 1,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 1 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: tenEther,
            releaseAmount: tenEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 1,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 1 * SECONDS_IN_A_DAY,
            releaseAmountADay: tenEther,
            releaseAmount: tenEther,
            exception: false
          },

          {
            cliffInDays: 0,
            durationInDays: 2,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 1 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: fiveEther,
            releaseAmount: fiveEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 2,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 2 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: fiveEther,
            releaseAmount: tenEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 2,
            intervalInDays: 1,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 2 * SECONDS_IN_A_DAY,
            releaseAmountADay: fiveEther,
            releaseAmount: tenEther,
            exception: false
          },

          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 0,
            releaseAmountADay: oneEther,
            releaseAmount: threeEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 3 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: threeEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 3 * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: sixEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 6 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: sixEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 6 * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: nineEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: 9 * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: nineEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 9 * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: tenEther,
            exception: false
          },
          {
            cliffInDays: 0,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: 10 * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: tenEther,
            exception: false
          },

          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: (2 + 0) * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: zeroEther,
            exception: true
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: (2 + 0) * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: threeEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: (2 + 3) * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: threeEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: (2 + 3) * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: sixEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: (2 + 6) * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: sixEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: (2 + 6) * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: nineEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 10,
            daysPast: (2 + 9) * SECONDS_IN_A_DAY - 1,
            releaseAmountADay: oneEther,
            releaseAmount: nineEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: (2 + 9) * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: tenEther,
            exception: false
          },
          {
            cliffInDays: 2,
            durationInDays: 10,
            intervalInDays: 3,
            vestedAmount: tenEther,
            offset: 0,
            daysPast: (2 + 10) * SECONDS_IN_A_DAY,
            releaseAmountADay: oneEther,
            releaseAmount: tenEther,
            exception: false
          },
        ];

        testDataSet.forEach(function (data) {
          it(`Calculation should be ${data.releaseAmount} when ${data.daysPast / 86400} days passed and  ${JSON.stringify(data)}`, async function () {
            start = new BigNumber(lastBlock.timestamp);
            cliffInDays = new BigNumber(data.cliffInDays);
            durationInDays = new BigNumber(data.durationInDays);
            intervalInDays = new BigNumber(data.intervalInDays);

            const tokenVesting = await TokenVesting.new(sideToken.address, sideDeveloper, data.vestedAmount, start, cliffInDays, durationInDays, intervalInDays);
            await sideToken.transfer(tokenVesting.address, data.vestedAmount, {from: sideDeveloper});

            const releaseAmountADay = await tokenVesting.releaseAmountADay.call();
            releaseAmountADay.should.be.bignumber.equal(data.releaseAmountADay);

            const blockTimestamp = start.add(data.daysPast);

            const releaseAmount = await tokenVesting.calculateReleaseAmount.call(blockTimestamp);
            releaseAmount.should.be.bignumber.equal(data.releaseAmount);
          });
        });

        testDataSet.filter(data => (data.exception != true)).forEach(function (data) {
          it(`should really release ${data.releaseAmount} when ${data.daysPast / 86400} days passed and  ${JSON.stringify(data)}`, async function () {
            lastBlock = web3.eth.getBlock('latest');

            // Around ending boundary of an interval, a block can not be mined exactly before the ending boundary,
            // because block mining takes time.
            // By delaying the start time by the offset, it makes sure that the block is mined before the ending boundary
            // ( Starting boundary doesn matter. so offset is always 0 for starting boundary )
            start = new BigNumber(lastBlock.timestamp - data.daysPast + data.offset);
            cliffInDays = new BigNumber(data.cliffInDays);
            durationInDays = new BigNumber(data.durationInDays);
            intervalInDays = new BigNumber(data.intervalInDays);

            const tokenVesting = await TokenVesting.new(sideToken.address, sideDeveloper, data.vestedAmount, start, cliffInDays, durationInDays, intervalInDays);
            await sideToken.transfer(tokenVesting.address, data.vestedAmount, {from: sideDeveloper});

            const releasedEvent = tokenVesting.Released({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});

            await tokenVesting.release();

            let watcher = function (err, event) {
              releasedEvent.stopWatching();

              event.event.should.be.equal('Released');
              event.args.releasedAmount.should.be.bignumber.equal(data.releaseAmount);
            }

            await TestHelper.awaitEvent(releasedEvent, watcher);
          });
        });

        const exceptionalTestSet = testDataSet.filter(data => (data.exception != undefined && data.exception == true));

        exceptionalTestSet.forEach(function (data) {
          it(`Nothing should not be released ${data.releaseAmount} when ${data.daysPast / 86400} days passed and  ${JSON.stringify(data)}`, async function () {
            lastBlock = web3.eth.getBlock('latest');

            start = new BigNumber(lastBlock.timestamp - data.daysPast + data.offset);
            cliffInDays = new BigNumber(data.cliffInDays);
            durationInDays = new BigNumber(data.durationInDays);
            intervalInDays = new BigNumber(data.intervalInDays);

            const tokenVesting = await TokenVesting.new(sideToken.address, sideDeveloper, data.vestedAmount, start, cliffInDays, durationInDays, intervalInDays);
            await sideToken.transfer(tokenVesting.address, data.vestedAmount, {from: sideDeveloper});

            //TestHelper.expectThrow(tokenVesting.release());
          });
        });
      });
    });

    describe('Redeem', async function () {
      const user = accounts[7];
      const redeemingAmountInPT = threeEther;
      const withdrawedAmountInMT = redeemingAmountInPT.div(conversionRate).mul(10 ** conversionRateDecimals);
      let redeemTransaction;
      let previousBalanceOfUserInPT;
      let previousBalanceOfSideBridgeInPT;

      beforeEach(async function () {
        const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
        const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

        await depositAndConfirm(user, depositAmount, depositAmountInPT, authorities);

        previousBalanceOfUserInPT = await sideToken.balanceOf(user);
        previousBalanceOfSideBridgeInPT = await sideToken.balanceOf(sideBridge.address);

        redeemTransaction = await redeemSideTokenByOwner(user, sideToken, redeemingAmountInPT);
      });

      it("SideToken of user should be transfered to sideBridge by redeeming amount", async function () {
        const balanceInPT = await sideToken.balanceOf(user);
        const balanceOfSideBridgeInPT = await sideToken.balanceOf(sideBridge.address);

        balanceInPT.should.be.bignumber.equal(previousBalanceOfUserInPT.sub(redeemingAmountInPT));
        balanceOfSideBridgeInPT.should.be.bignumber.equal(previousBalanceOfSideBridgeInPT.add(redeemingAmountInPT));
      });

      it("should not be withdrawed if only one signes.", async function () {
        // Given
        const previousBalance = await mainToken.balanceOf(user);

        // When
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);

        // Then
        const notWithdrawed = false;
        const signedCount = 1;
        await assertWithdrawInfo(redeemTransaction, signedCount, notWithdrawed, withdrawedAmountInMT);

        const balance = await mainToken.balanceOf(user);
        balance.should.be.bignumber.equal(previousBalance);
      });

      it("should be withdrawed when more than half signes.", async function () {
        const previousBalance = await mainToken.balanceOf(user);

        // When
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[1]);

        // Then
        let moreThanHalfOfSigners = 2;
        const signedCount = moreThanHalfOfSigners;
        const withdrawed = true;

        await assertWithdrawInfo(redeemTransaction, signedCount, withdrawed, withdrawedAmountInMT);

        const balance = await mainToken.balanceOf(user);
        balance.should.be.bignumber.equal(previousBalance.add(withdrawedAmountInMT));
      });

      it("should emit mainTokenWithdrawed event when withdraw succeeded.", async function () {
        const previousBalance = await mainToken.balanceOf(user);

        const mainTokenWithdrawedEvent = mainBridge.MainTokenWithdrawed({
          fromBlock: web3.eth.blockNumber,
          toBlock: 'latest'
        });

        // When
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[1]);

        // Then
        await assertMainTokenWithdrawedEvent(user, redeemTransaction, mainTokenWithdrawedEvent, redeemingAmountInPT, withdrawedAmountInMT);
      });

      it("SideToken should be redeemed when confirmRedeem", async function () {
        // When
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[1]);

        const previousBalanceOfSideBridge = await sideToken.balanceOf(sideBridge.address);
        const previousTotalSupply = await sideToken.totalSupply();

        // when
        await sideBridge.confirmRedeem(redeemTransaction.redeemParams.redeemId, {from: authorities[0]});
        await sideBridge.confirmRedeem(redeemTransaction.redeemParams.redeemId, {from: authorities[1]});

        // then
        const balanceOfSideBridge = await sideToken.balanceOf(sideBridge.address);
        balanceOfSideBridge.should.be.bignumber.equal(previousBalanceOfSideBridge.sub(redeemingAmountInPT));

        const totalSupply = await sideToken.totalSupply();
        totalSupply.should.be.bignumber.equal(previousTotalSupply.sub(redeemingAmountInPT));
      });


      it("should not be withdrawed when a signer signes more than once.", async function () {
        const previousBalance = await mainToken.balanceOf(user);

        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);

        const signedCount = 1;
        const withdrawed = false;
        await assertWithdrawInfo(redeemTransaction, signedCount, withdrawed, withdrawedAmountInMT);

        const balance = await mainToken.balanceOf(user);
        balance.should.be.bignumber.equal(previousBalance);
      });

      it("should not be withdrawed when already withdrawed.", async function () {
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[1]);

        const previousBalance = await mainToken.balanceOf(user);

        // when
        await signWithdrawByAuthority(redeemTransaction, authorities[2]);

        const signedCount = 2;
        const withdrawed = true;
        await assertWithdrawInfo(redeemTransaction, signedCount, withdrawed, withdrawedAmountInMT);

        const balance = await mainToken.balanceOf(user);
        balance.should.be.bignumber.equal(previousBalance);
      });

      // it("should test requestRedeemCancel", async function () {
      //   // When
      //   // await signWithdrawByAuthority(redeemTransaction, authorities[0]);
      //   // await signWithdrawByAuthority(redeemTransaction, authorities[1]);
      //
      //   const previousBalanceOfSideBridge = await sideToken.balanceOf(sideBridge.address);
      //   const previousTotalSupply = await sideToken.totalSupply();
      //
      //   // when
      //   await sideBridge.confirmRedeem(redeemTransaction.redeemParams.redeemId, {from: authorities[0]});
      //
      //   // then
      //   const balanceOfSideBridge = await sideToken.balanceOf(sideBridge.address);
      //   balanceOfSideBridge.should.be.bignumber.equal(previousBalanceOfSideBridge.sub(redeemingAmountInPT));
      //
      //   const totalSupply = await sideToken.totalSupply();
      //   totalSupply.should.be.bignumber.equal(previousTotalSupply.sub(redeemingAmountInPT));
      // });
    });

    describe('Redeem with money Loss', async function () {
      const user = accounts[8];

      it("should fail when redeem with money loss", async function () {
        const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
        const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

        await depositAndConfirm(user, depositAmount, depositAmountInPT, authorities);

        const previousBalanceOfUserInPT = await sideToken.balanceOf(user);
        const previousBalanceOfSideBridgeInPT = await sideToken.balanceOf(sideBridge.address);

        const redeemPromise = sideToken.redeem(oneEther, {from: user});

        TestHelper.expectThrow(redeemPromise);
      });
    });
  });

  describe("For conversionRateDecimals is non-0", async function() {
    let conversionRate = 12345;
    let conversionRateDecimals = 3;

    before(async function () {
      await initSideBridge(conversionRate, conversionRateDecimals);
    });

    describe("Deposit", function () {
      sideDeveloper = accounts[2];
      const depositAmount = new BigNumber(web3.toWei(1, "ether"));
      const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

      it("should mint to sideDeveloper on sideBridge when enough signers sign to mint", async function () {
        const previousBalance = await sideToken.balanceOf.call(sideDeveloper);
        const previousTotalSupply = await sideToken.totalSupply.call();

        const depositResult = await depositMainToken(sideDeveloper, depositAmount, depositAmountInPT);

        // if signedCount >= 2, mint the deposit
        await depositToSideBridge(authorities[0], sideDeveloper, depositResult);
        await depositToSideBridge(authorities[1], sideDeveloper, depositResult);

        await assertMainTokenDeposited(depositAmount, depositAmountInPT);

        const balance = await sideToken.balanceOf.call(sideDeveloper);
        balance.should.be.bignumber.equal(depositAmountInPT.add(previousBalance));

        const totalSupply = await sideToken.totalSupply.call();
        totalSupply.should.be.bignumber.equal(depositAmountInPT.add(previousTotalSupply));
      });
    });

    describe('Redeem', async function () {
      const user = accounts[7];
      const redeemingAmountInPT = new BigNumber(web3.toWei(12345, 'ether')).div(10000);
      const withdrawedAmountInMT = redeemingAmountInPT.div(conversionRate).mul(10 ** conversionRateDecimals);
      let redeemTransaction;
      let previousBalanceOfUserInPT;
      let previousBalanceOfSideBridgeInPT;

      beforeEach(async function () {
        const depositAmount = new BigNumber(web3.toWei(10, 'ether'));
        const depositAmountInPT = getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals);

        await depositAndConfirm(user, depositAmount, depositAmountInPT, authorities);

        previousBalanceOfUserInPT = await sideToken.balanceOf(user);
        previousBalanceOfSideBridgeInPT = await sideToken.balanceOf(sideBridge.address);

        redeemTransaction = await redeemSideTokenByOwner(user, sideToken, redeemingAmountInPT);
      });

      it("should be withdrawed when more than half signes.", async function () {
        const previousBalance = await mainToken.balanceOf(user);

        // When
        await signWithdrawByAuthority(redeemTransaction, authorities[0]);
        await signWithdrawByAuthority(redeemTransaction, authorities[1]);

        // Then
        let moreThanHalfOfSigners = 2;
        const signedCount = moreThanHalfOfSigners;
        const withdrawed = true;

        await assertWithdrawInfo(redeemTransaction, signedCount, withdrawed, withdrawedAmountInMT);

        const balance = await mainToken.balanceOf(user);
        balance.should.be.bignumber.equal(previousBalance.add(withdrawedAmountInMT));
      });
    });
  });

  describe("changeAuthority", async function () {
    let changeId;

    it("should change authority", async function () {

      const authorityChangeRequestEvent = mainBridge.ChangeAuthorityRequest({
        fromBlock: web3.eth.blockNumber,
        toBlock: 'latest'
      });

      await mainBridge.changeAuthorityRequest(authorities[0], accounts[8]);

      await TestHelper.awaitEvent(authorityChangeRequestEvent, function (err, event) {
        changeId = event.args.changeId;
      });

      const authorityChangedEventOnMain = mainBridge.AuthorityChanged({
        fromBlock: web3.eth.blockNumber,
        toBlock: 'latest'
      });

      const authorityChangedEventOnSide = sideBridge.AuthorityChanged({
        fromBlock: web3.eth.blockNumber,
        toBlock: 'latest'
      });

      await mainBridge.changeAuthority(changeId, authorities[0], accounts[8], {from: authorities[1]});
      await mainBridge.changeAuthority(changeId, authorities[0], accounts[8], {from: authorities[2]});
      await sideBridge.changeAuthority(changeId, authorities[0], accounts[8], {from: authorities[1]});
      await sideBridge.changeAuthority(changeId, authorities[0], accounts[8], {from: authorities[2]});

      const watcher1 = function (err, event) {
        authorityChangedEventOnMain.stopWatching();

        event.event.should.be.equal('AuthorityChanged');
      };

      await TestHelper.awaitEvent(authorityChangedEventOnMain, watcher1);

      const watcher2 = function (err, event) {
        authorityChangedEventOnSide.stopWatching();

        event.event.should.be.equal('AuthorityChanged');
      };

      await TestHelper.awaitEvent(authorityChangedEventOnSide, watcher2);
    });
  });

  async function initSideBridge(conversionRate,conversionRateDecimals) {
    fromBlock = web3.eth.blockNumber;
    let mainTokenName = "MainToken";
    let mainTokenSymbol = "MT1";
    let mainTokenDecimals = new BigNumber(18);
    let initialSupply = new BigNumber(web3.toWei(100000, "ether"));
    let maximumSupply = new BigNumber(web3.toWei(200000, "ether"));
    let requiredSignatures = 2;

    mainToken = await ERC20Token.new(mainTokenName, mainTokenSymbol, mainTokenDecimals, initialSupply, maximumSupply, {from: lambdaOperator});

    mainBridge = await MainBridge.new(homeChainId, mainToken.address, accounts[8], {from: lambdaOperator});
    sideBridge = await SideBridge.new(homeChainId, mainBridge.address, sideChainId, requiredSignatures, authorities, {from: lambdaOperator});

    await mainBridge.registerSideBridge(sideBridge.address, requiredSignatures, authorities);

    sideTokenId = await sideBridge.hashSideTokenId.call(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

    sideToken = await SideToken.new(sideTokenName, sideTokenSymbol, 18, sideBridge.address);

    await sideBridge.registerSideToken(sideTokenId, sideToken.address, conversionRate, conversionRateDecimals);

    await mainBridge.registerSideToken(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals, sideTokenId);

    await sideBridge.acknowledgeSideToken(sideTokenId, {from: lambdaOperator});
  }

  async function depositAndConfirm(depositor, depositAmount, depositAmountInPT, authorities) {
    const depositResult = await depositMainToken(depositor, depositAmount, depositAmountInPT);

    await depositToSideBridge(authorities[0], depositor, depositResult);
    await depositToSideBridge(authorities[1], depositor, depositResult);
  }

  async function depositMainToken(sideDeveloper, depositAmount, depositAmountInPT) {
    await mainToken.transfer(sideDeveloper, depositAmount, {from: lambdaOperator});

    await mainToken.approve(mainBridge.address, depositAmount, {from: sideDeveloper});

    const depositedEvent = mainBridge.Deposited({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});

    await mainBridge.deposit(sideTokenId, depositAmount, {from: sideDeveloper});

    let depositTxHash;
    let depositInfo;

    let handleDeposit = function (err, event) {
      depositedEvent.stopWatching();

      event.args.amountST.should.be.bignumber.equal(depositAmountInPT);

      depositTxHash = event.transactionHash;
      depositInfo = event.args;
    }

    await TestHelper.awaitEvent(depositedEvent, handleDeposit);

    return { depositTxHash: depositTxHash, depositInfo: depositInfo} ;
  }

  async function assertMainTokenDeposited(depositAmount, depositAmountInPT) {
    const sideBridgeMintedEvent = sideBridge.SideTokenMinted({
      fromBlock: web3.eth.blockNumber,
      toBlock: 'latest'
    });
    const sideTokenMintedEvent = sideToken.Minted({fromBlock: web3.eth.blockNumber, toBlock: 'latest'});
    let depositId;

    let watcher = function (err, event) {
      sideBridgeMintedEvent.stopWatching();

      event.event.should.be.equal('SideTokenMinted');
      event.args.beneficiary.should.be.equal(sideDeveloper);
      event.args.amountST.should.be.bignumber.equal(depositAmountInPT);
      depositId = event.args.depositId;
    }

    await TestHelper.awaitEvent(sideBridgeMintedEvent, watcher);

    let sideTokenWatcher = function (err, event) {
      sideTokenMintedEvent.stopWatching();

      event.event.should.be.equal('Minted');
      event.args.beneficiary.should.be.equal(sideDeveloper);
      event.args.amount.should.be.bignumber.equal(depositAmountInPT);
    }

    await TestHelper.awaitEvent(sideTokenMintedEvent, sideTokenWatcher);

    await mainBridge.confirmDeposit(depositId, {from: authorities[0]});
    await mainBridge.confirmDeposit(depositId, {from: authorities[1]});
  }


  async function depositToSideBridge(authority, sideDeveloper, depositResult) {
    const depositInfo = depositResult.depositInfo;

    await sideBridge.deposit(sideTokenId,
      depositInfo.depositId,
      depositInfo.depositCount,
      depositInfo.beneficiary,
      depositInfo.amountMT,
      depositInfo.amountST,
      depositResult.depositTxHash,
      {from: authority});
  }

  async function depositWithInvalidBeneficiaryTo(sideBridge, authority, sideDeveloper, depositResult) {
    const depositInfo = depositResult.depositInfo;
    const invalidBeneficiaryAddress = 0x0;

    await sideBridge.deposit(sideTokenId,
      depositInfo.depositId,
      depositInfo.depositCount,
      invalidBeneficiaryAddress,
      depositInfo.amountMT,
      depositInfo.amountST,
      depositResult.depositTxHash,
      {from: authority});
  }

  function getDepositAmountInPT(depositAmount, conversionRate, conversionRateDecimals) {
    return depositAmount.mul(conversionRate).div(10**conversionRateDecimals);
  }

  async function signWithdrawByAuthority(redeemTransaction, authority) {
    const redeemTxHash = redeemTransaction.txHash;
    const redeemParams = redeemTransaction.redeemParams;

    await mainBridge.withdraw(redeemParams.redeemId,
      redeemParams.sideTokenId,
      redeemParams.owner,
      redeemParams.amount, redeemTxHash, {from: authority});
  }

  async function redeemSideTokenByOwner(user, sideToken, redeemingAmountInPT) {
    const sideTokenRedeemedEvent = sideBridge.SideTokenRedeemed({
      fromBlock: web3.eth.blockNumber,
      toBlock: 'latest'
    });
    let redeemParams;

    await sideToken.redeem(redeemingAmountInPT, {from: user});

    const watcher = function (err, event) {
      sideTokenRedeemedEvent.stopWatching();

      event.event.should.be.equal('SideTokenRedeemed');

      redeemTxHash = event.transactionHash;
      redeemParams = event.args;

      event.args.redeemId.should.not.be.equal(0);
      event.args.sideTokenId.should.be.equal(sideTokenId);
      event.args.owner.should.be.equal(user);
      event.args.amount.should.be.bignumber.equal(redeemingAmountInPT);
    };

    await TestHelper.awaitEvent(sideTokenRedeemedEvent, watcher);

    return {txHash: redeemTxHash, redeemParams: redeemParams};
  }

  async function assertMainTokenWithdrawedEvent(user, redeemTransaction, mainTokenWithdrawedEvent, redeemingAmountInPT, withdrawedAmountInMT) {
    const watcher = function (err, event) {
      mainTokenWithdrawedEvent.stopWatching();

      event.event.should.be.equal('MainTokenWithdrawed');
      event.args.redeemId.should.be.equal(redeemTransaction.redeemParams.redeemId);
      event.args.amountMT.should.be.bignumber.equal(withdrawedAmountInMT);
      event.args.amountST.should.be.bignumber.equal(redeemingAmountInPT);
      event.args.beneficiary.should.be.equal(user);
      event.args.sideTokenId.should.be.equal(sideTokenId);
    };

    await TestHelper.awaitEvent(mainTokenWithdrawedEvent, watcher);
  }

  async function assertWithdrawInfo(redeemTransaction, signedCount, withdrawed, withdrawedAmountInMT) {
    const withdrawInfo = await mainBridge.withdraws(redeemTransaction.redeemParams.redeemId);

    withdrawInfo[0].should.be.equal(redeemTransaction.txHash);
    withdrawInfo[1].should.be.equal(sideTokenId);
    withdrawInfo[2].should.be.equal(redeemTransaction.redeemParams.owner);
    withdrawInfo[3].should.be.bignumber.equal(withdrawedAmountInMT);
    withdrawInfo[4].should.be.bignumber.equal(redeemTransaction.redeemParams.amount);
    withdrawInfo[5].should.be.bignumber.equal(new BigNumber(signedCount));
    withdrawInfo[6].should.be.equal(withdrawed);
  }

  function sleep(milliseconds) {
    console.log("Sleeping for ", milliseconds, " ms");

    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds) {
        break;
      }
    }
  }
});
