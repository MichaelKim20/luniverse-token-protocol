"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ERC20Token = artifacts.require("./ERC20Token.sol");
const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");
contract("ERC20Token", (accounts) => {
    const owner = accounts[0];
    const initialSupply = new BigNumber(web3.toWei(1000, "ether"));
    const maxSupply = new BigNumber(web3.toWei(2000, "ether"));
    const decimals = new BigNumber(18);
    const name = "NAME";
    const symbol = "SYMBOL";
    describe("ERC20Token Construct test", async () => {
        let pureERC20Token;
        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
        });
        it("should not be created when initialSupply is greater than maxSupply", async () => {
            const lessThanInitialSupply = initialSupply.sub(web3.toWei(1, "ether"));
            await TestHelper.expectThrow2(ERC20Token.new(name, symbol, decimals, initialSupply, lessThanInitialSupply));
        });
        it("owner should have all the initialSupply", async () => {
            const balance = await pureERC20Token.balanceOf.call(owner);
            balance.should.be.bignumber.equal(initialSupply);
        });
        it("totalSupply should be equal to initialSupply", async () => {
            const totalSupply = await pureERC20Token.totalSupply.call();
            totalSupply.should.be.bignumber.equal(initialSupply);
        });
        it("should have the specified name", async () => {
            const tokenName = await pureERC20Token.name.call();
            tokenName.should.be.equal(name);
        });
        it("should have the specified symbol", async () => {
            const tokenSymbol = await pureERC20Token.symbol.call();
            tokenSymbol.should.be.equal(symbol);
        });
        it("should have the specified decimals", async () => {
            const tokenDecimals = await pureERC20Token.decimals.call();
            tokenDecimals.should.be.bignumber.equal(decimals);
        });
    });
    describe("transfer", async () => {
        const recipient = accounts[1];
        const transferAmount = new BigNumber(web3.toWei(100, "ether"));
        let pureERC20Token;
        let transferEvent;
        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
            transferEvent = pureERC20Token.Transfer();
        });
        it("Sender balance should be decreased after Transfer", async () => {
            const previousSenderBalance = await pureERC20Token.balanceOf.call(owner);
            await pureERC20Token.transfer(recipient, transferAmount);
            const balance = await pureERC20Token.balanceOf.call(owner);
            balance.should.be.bignumber.equal(previousSenderBalance.minus(transferAmount));
        });
        it("Recipient balance should be increased After Transfer", async () => {
            const previousRecipientBalance = await pureERC20Token.balanceOf.call(recipient);
            await pureERC20Token.transfer(recipient, transferAmount);
            const recipientBalance = await pureERC20Token.balanceOf.call(recipient);
            recipientBalance.should.be.bignumber.equal(previousRecipientBalance.plus(transferAmount));
        });
        it("should emit an event After Transfer", async () => {
            // transfer ${transferAmount} from owner to recipient. owner => recipient transction
            await pureERC20Token.transfer(recipient, transferAmount);
            const watcher = (err, event) => {
                transferEvent.stopWatching();
                event.event.should.be.equal("Transfer");
                event.args.from.should.be.equal(owner);
                event.args.to.should.be.equal(recipient);
                event.args.value.should.bignumber.equal(transferAmount);
            };
            await TestHelper.awaitEvent(transferEvent, watcher);
        });
        it("should fail when a user transfers more than balance", async () => {
            const brokenOwner = accounts[2];
            const balance = await pureERC20Token.balanceOf.call(brokenOwner);
            const moreThanBalance = balance.add(web3.toWei(100, "ether"));
            await TestHelper.expectThrow2(pureERC20Token.transfer(recipient, moreThanBalance, { from: brokenOwner }));
        });
        it("should fail for invalid recipient", async () => {
            await TestHelper.expectThrow2(pureERC20Token.transfer(0, transferAmount));
        });
    });
    describe("approve", async () => {
        let pureERC20Token;
        let spender = accounts[3];
        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
        });
        it("should succeed when valid approve request", async () => {
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            const previousApprovedAmount = await pureERC20Token.allowance.call(owner, spender);
            await pureERC20Token.approve(spender, spendAmount, { from: owner });
            const approvedAmount = await pureERC20Token.allowance.call(owner, spender);
            approvedAmount.should.be.bignumber.equal(previousApprovedAmount.add(spendAmount));
        });
        it("should add", async () => {
            const oneEther = new BigNumber(web3.toWei(1, "ether"));
            const twoEther = new BigNumber(web3.toWei(2, "ether"));
            await pureERC20Token.approve(spender, oneEther, { from: owner });
            await pureERC20Token.approve(spender, oneEther, { from: owner });
            const approvedAmount = await pureERC20Token.allowance.call(owner, spender);
            approvedAmount.should.be.bignumber.equal(twoEther);
        });
        it("to ZERO address should fail", async () => {
            let zeroAddress = 0;
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            await TestHelper.expectThrow2(pureERC20Token.approve(zeroAddress, spendAmount, { from: owner }));
        });
        it("from Broken Owner should fail", async () => {
            const brokenOwner = accounts[4];
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            const balanceOfBrokenOwner = await pureERC20Token.balanceOf.call(brokenOwner);
            balanceOfBrokenOwner.should.be.bignumber.equal(new BigNumber(0));
            await TestHelper.expectThrow2(pureERC20Token.approve(spender, spendAmount, { from: brokenOwner }));
        });
    });
    describe("transferFrom", async () => {
        let pureERC20Token;
        const spender = accounts[5];
        const recipient = accounts[6];
        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
        });
        it("should succeed", async () => {
            let allowedAmount = new BigNumber(web3.toWei(1, "ether"));
            await pureERC20Token.approve(spender, allowedAmount, { from: owner });
            await pureERC20Token.transferFrom(owner, recipient, allowedAmount, { from: spender });
            const balanceOfRecipient = await pureERC20Token.balanceOf.call(recipient);
            balanceOfRecipient.should.be.bignumber.equal(allowedAmount);
        });
        it("should emit an event if succeeded", async () => {
            let allowedAmount = new BigNumber(web3.toWei(1, "ether"));
            const transferEvent = pureERC20Token.Transfer();
            await pureERC20Token.approve(spender, allowedAmount, { from: owner });
            await pureERC20Token.transferFrom(owner, recipient, allowedAmount, { from: spender });
            const watcher = (err, event) => {
                transferEvent.stopWatching();
                event.event.should.be.equal("Transfer");
                event.args.from.should.be.equal(owner);
                event.args.to.should.be.equal(recipient);
                event.args.value.should.be.bignumber.equal(allowedAmount);
            };
            await TestHelper.awaitEvent(transferEvent, watcher);
        });
        it("should fail when spender spends more than allowed amount", async () => {
            let allowedAmount = new BigNumber(web3.toWei(1, "ether"));
            let moreThanAllowedAmount = allowedAmount.plus(1);
            await pureERC20Token.approve(spender, allowedAmount, { from: owner });
            await TestHelper.expectThrow2(pureERC20Token.transferFrom(owner, recipient, moreThanAllowedAmount, { from: spender }));
        });
        it("should fail when holder owns less than allowed amount", async () => {
            let oneEther = new BigNumber(web3.toWei(1, "ether"));
            let holder = accounts[8];
            await pureERC20Token.transfer(holder, oneEther, { from: owner });
            await pureERC20Token.approve(spender, oneEther, { from: holder });
            await pureERC20Token.transfer(accounts[9], oneEther, { from: holder });
            await TestHelper.expectThrow2(pureERC20Token.transferFrom(holder, recipient, oneEther, { from: spender }));
        });
    });
});
//# sourceMappingURL=ERC20Token.spec.js.map