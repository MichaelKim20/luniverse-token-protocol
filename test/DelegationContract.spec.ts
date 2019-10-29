const GasDelegationWhitelist = artifacts.require("./GasDelegationWhitelist.sol");

const { BigNumber } = web3;

const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");
type Address = string;

contract("Gas Delegation Whitelist Contract", (accounts: Address[]) => {
    const owner = accounts[0];
    const initialGas = new BigNumber(web3.toWei(100, "ether"));
    const superWhitelistArray = [accounts[1], accounts[2], accounts[3]];
    const whitelistArray = [accounts[4], accounts[5], accounts[6]];

    describe("Delegation Contract Test", async () => {
        let delegationContractInstance: any;

        beforeEach(async () => {
            delegationContractInstance = await GasDelegationWhitelist.new(superWhitelistArray, whitelistArray, accounts[0], { from: accounts[0], value: initialGas });
        });

        it("should check superWhitelists", async () => {
            superWhitelistArray.forEach(async (account) => {
                const isSuperWhitelist = await delegationContractInstance.isSuperWhitelist(account);
                assert.isTrue(isSuperWhitelist);
            });
        });

        it("should check whitelists", async () => {
            whitelistArray.forEach(async (account) => {
                const isWhitelist = await delegationContractInstance.isWhitelist(account);
                assert.isTrue(isWhitelist);
            });
        });

        it("should remove & add superWhitelist and check", async () => {
            await delegationContractInstance.removeSuperWhitelistEntry(accounts[1]);
            const isSuperWhitelist = await delegationContractInstance.isSuperWhitelist(accounts[1]);
            assert.isFalse(isSuperWhitelist);

            await delegationContractInstance.addSuperWhitelistEntry(accounts[1]);
            const isSuperWhitelist2 = await delegationContractInstance.isSuperWhitelist(accounts[1]);
            assert.isTrue(isSuperWhitelist2);
        });

        it("should remove & add whitelist and check", async () => {
            await delegationContractInstance.removeWhitelistEntry(accounts[4]);
            const isWhitelist = await delegationContractInstance.isWhitelist(accounts[4]);
            assert.isFalse(isWhitelist);

            await delegationContractInstance.addWhitelistEntry(accounts[4], 0);
            const isWhitelist2 = await delegationContractInstance.isWhitelist(accounts[4]);
            assert.isTrue(isWhitelist2);
        });

        it("should revert for adding address(0) for whitelist & superWhitelist", async () => {
            await TestHelper.expectThrow2(delegationContractInstance.addSuperWhitelistEntry(0));
            await TestHelper.expectThrow2(delegationContractInstance.addWhitelistEntry(0, 0));
        });

        it("should test substitute whitelist entry", async () => {
            await TestHelper.expectThrow2(delegationContractInstance.substituteWhitelistEntry(0, accounts[1], 0));
            await TestHelper.expectThrow2(delegationContractInstance.substituteWhitelistEntry(accounts[5], 0, 0));
            await TestHelper.expectThrow2(delegationContractInstance.substituteWhitelistEntry(accounts[5], accounts[5], 0));

            await delegationContractInstance.substituteWhitelistEntry(accounts[5], accounts[7], 0);
            assert.isFalse(await delegationContractInstance.isWhitelist(accounts[5]));
            assert.isTrue(await delegationContractInstance.isWhitelist(accounts[7]));

            await delegationContractInstance.substituteWhitelistEntry(accounts[7], accounts[5], 0);
            assert.isFalse(await delegationContractInstance.isWhitelist(accounts[7]));
            assert.isTrue(await delegationContractInstance.isWhitelist(accounts[5]));
        });

        it("should revert when refundAmount exceeds contract.balance", async () => {
            await TestHelper.expectThrow2(delegationContractInstance.refundAmount(initialGas.plus(new BigNumber(100))));
        });

        it("should be refunded when refundAmount is valid", async () => {
            const currentBalance = web3.eth.getBalance(delegationContractInstance.address);
            await delegationContractInstance.refundAmount(currentBalance.div(3));
        });

        it("should be refunded when refundAll is called", async () => {
            await delegationContractInstance.refundAll();
        });

        it("should change fundOwner when setFundOwner called", async () => {
            const oldFundOwner = accounts[0];
            const newFundOwner = accounts[1];
            await delegationContractInstance.setFundOwner(newFundOwner);

            const fundOwnerChangedEvent = delegationContractInstance.FundOwnerChanged({
                fromBlock: web3.eth.blockNumber,
                lastBlock: "latest",
            });

            const watcher = async (err: any, event: Truffle.TransactionLog) => {
                fundOwnerChangedEvent.stopWatching();

                // console.log(event);

                event.event.should.be.equal("FundOwnerChanged");
                event.args.oldFundOwner.should.be.equal(oldFundOwner);
                event.args.newFundOwner.should.be.equal(newFundOwner);
            };

            await TestHelper.awaitEvent(fundOwnerChangedEvent, watcher);
        });
    });
});

export {};
