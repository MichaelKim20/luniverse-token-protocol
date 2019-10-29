import {ERC20TokenContract, ERC20TokenInstance} from "../types/truffle-contracts";

const ERC20Token = artifacts.require("./ERC20Token.sol");
const TestTokenRecipient = artifacts.require("./TestTokenRecipient.sol");

const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");
type Address = string;

contract("ERC20Token", (accounts: Address[]) => {
    const owner = accounts[0];
    const initialSupply = new BigNumber(web3.toWei(1000, "ether"));
    const maxSupply = new BigNumber(web3.toWei(2000, "ether"));
    const decimals = new BigNumber(18);
    const name = "NAME";
    const symbol = "SYMBOL";

    describe("ERC20Token Construct test", async () => {
        let pureERC20Token: any;

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
        let pureERC20Token: any;
        let transferEvent: any;

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

            const watcher = (err: any, event: any) => {
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

            await TestHelper.expectThrow2(pureERC20Token.transfer(recipient, moreThanBalance, {from: brokenOwner}));
        });

        it("should fail for invalid recipient", async () => {
            await TestHelper.expectThrow2(pureERC20Token.transfer(0, transferAmount));
        });
    });

    describe("approve", async () => {
        let pureERC20Token: any;
        let spender = accounts[3];

        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
        });

        it("should succeed when valid approve request", async () => {
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            const previousApprovedAmount = await pureERC20Token.allowance.call(owner, spender);

            await pureERC20Token.approve(spender, spendAmount, {from: owner});

            const approvedAmount = await pureERC20Token.allowance.call(owner, spender);
            approvedAmount.should.be.bignumber.equal(previousApprovedAmount.add(spendAmount));
        });

        it("should add", async () => {
            const oneEther = new BigNumber(web3.toWei(1, "ether"));
            const twoEther = new BigNumber(web3.toWei(2, "ether"));

            await pureERC20Token.approve(spender, oneEther, {from: owner});
            await pureERC20Token.increaseAllowance(spender, oneEther, {from: owner});

            const approvedAmount = await pureERC20Token.allowance.call(owner, spender);
            approvedAmount.should.be.bignumber.equal(twoEther);
        });

        it("to ZERO address should fail", async () => {
            let zeroAddress = 0;
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));

            await TestHelper.expectThrow2(pureERC20Token.approve(zeroAddress, spendAmount, {from: owner}));
        });

        // it("from Broken Owner should fail", async () => {
        //     const brokenOwner = accounts[4];
        //     const spendAmount = new BigNumber(web3.toWei(1, "ether"));
        //
        //     const balanceOfBrokenOwner = await pureERC20Token.balanceOf.call(brokenOwner);
        //     balanceOfBrokenOwner.should.be.bignumber.equal(new BigNumber(0));
        //
        //     await TestHelper.expectThrow2(pureERC20Token.approve(spender, spendAmount, {from: brokenOwner}));
        // });
    });

    describe("transferFrom", async () => {
        let pureERC20Token: any;
        const spender = accounts[5];
        const recipient = accounts[6];

        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
        });

        it("should succeed", async () => {
            let allowedAmount = new BigNumber(web3.toWei(1, "ether"));
            await pureERC20Token.approve(spender, allowedAmount, {from: owner});

            await pureERC20Token.transferFrom(owner, recipient, allowedAmount, {from: spender});

            const balanceOfRecipient = await pureERC20Token.balanceOf.call(recipient);
            balanceOfRecipient.should.be.bignumber.equal(allowedAmount);
        });

        it("should emit an event if succeeded", async () => {
            let allowedAmount = new BigNumber(web3.toWei(1, "ether"));
            const transferEvent = pureERC20Token.Transfer();

            await pureERC20Token.approve(spender, allowedAmount, {from: owner});

            await pureERC20Token.transferFrom(owner, recipient, allowedAmount, {from: spender});

            const watcher = (err: any, event: Truffle.TransactionLog) => {
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
            await pureERC20Token.approve(spender, allowedAmount, {from: owner});

            await TestHelper.expectThrow2(pureERC20Token.transferFrom(owner, recipient, moreThanAllowedAmount, {from: spender}));
        });

        it("should fail when holder owns less than allowed amount", async () => {
            let oneEther = new BigNumber(web3.toWei(1, "ether"));
            let holder = accounts[8];

            await pureERC20Token.transfer(holder, oneEther, {from: owner});

            await pureERC20Token.approve(spender, oneEther, {from: holder});

            await pureERC20Token.transfer(accounts[9], oneEther, {from: holder});

            await TestHelper.expectThrow2(pureERC20Token.transferFrom(holder, recipient, oneEther, {from: spender}));
        });

    });

    describe("approveAndCall", async () => {
        let pureERC20Token: any;
        let tokenRecipientContract: any;
        const transferAmount = new BigNumber(web3.toWei(100, "ether"));
        let spender = accounts[7];

        beforeEach(async () => {
            pureERC20Token = await ERC20Token.new("NAME", "SYMBOL", decimals, initialSupply, maxSupply);
            tokenRecipientContract = await TestTokenRecipient.new();
        });

        it("should succeed when valid approve request", async () => {
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            const beforeTokenCount = await pureERC20Token.balanceOf.call(tokenRecipientContract.address);

            await pureERC20Token.transfer(spender, transferAmount, {from: owner});
            await pureERC20Token.approveAndCall(tokenRecipientContract.address, spendAmount, 'abcde', {from: owner});

            const afterTokenCount = await pureERC20Token.balanceOf.call(tokenRecipientContract.address);
            const bytes = await tokenRecipientContract.extraData.call();
            const asciiBytes = web3.toAscii(bytes);
            asciiBytes.should.be.equal('abcde');
            afterTokenCount.should.be.bignumber.equal(beforeTokenCount.add(spendAmount));
        });

        it("should revert when spender is invalid(null)", async () => {
            const invalidAddress = 0x0;
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));
            const beforeTokenCount = await pureERC20Token.balanceOf.call(tokenRecipientContract.address);

            await pureERC20Token.transfer(spender, transferAmount, {from: owner});
            await TestHelper.expectThrow2(pureERC20Token.approveAndCall(invalidAddress, spendAmount, 'abcde', {from: owner}));
        });

        it("should revert when approve(approveAndCall) fails", async () => {
            const spendAmount = new BigNumber(web3.toWei(1, "ether"));

            await TestHelper.expectThrow2(pureERC20Token.approveAndCall(tokenRecipientContract.address, spendAmount, 'abcde', {from: accounts[1]}));
        });

    });

});

// because of https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {};
