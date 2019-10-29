const MainBridge = artifacts.require("MainBridge");
const SideBridge = artifacts.require("SideBridge");
const SideToken = artifacts.require("SideToken");
const TestTokenRecipient = artifacts.require("./TestTokenRecipient.sol");

const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");

type Address = string;

contract("SideBridge", (accounts: Address[]) => {
    const lambdaOperator = accounts[0];

    const mainChainId = new BigNumber(1000);
    const sideChainId = new BigNumber(2000);

    const sideTokenName = "SideToken";
    const sideTokenSymbol = "PT1";
    const decimals = new BigNumber(18);
    const conversionRate = 10;
    const conversionRateDecimals = 0;

    const requiredSignatures = new BigNumber(2);
    const authorities = [accounts[0], accounts[1], accounts[2]];

    const sampleTxHash = "0xc2e0b7fe5a880d25779b932fbe20e6e704dd8465f292f9a202b1cfb80433903a";

    let sideBridge: any;
    let sideToken: any;

    beforeEach(async () => {
        sideBridge = await SideBridge.new(mainChainId, MainBridge.address, sideChainId, requiredSignatures, authorities, { from: lambdaOperator });
        sideToken = await SideToken.new(sideTokenName, sideTokenSymbol, decimals, sideBridge.address);
    });

    describe("After construction", async () => {
        it("should be created", async () => {
            should.exist(sideBridge);
            should.exist(sideBridge.address);
        });

        it("should have the specified owner", async () => {
            const actualOwner = await sideBridge.owner.call();
            actualOwner.should.be.deep.eq(lambdaOperator);
        });

        it("should have the specified mainChainId", async () => {
            const actualChainId = await sideBridge.mainChainId.call();
            actualChainId.should.be.bignumber.equal(mainChainId);
        });

        it("should have the specified requiredSignatues", async () => {
            const actualRequiredSignatures = await sideBridge.requiredSignatures.call();
            actualRequiredSignatures.should.be.bignumber.equal(requiredSignatures);
        });

        it("should have the specified authorities", async () => {
            async function checkIsAuthority(authority: Address) {
                const isAuthority = await sideBridge.authorities.call(authority);
                isAuthority.should.be.equal(true);
            }

            for (let authority of authorities) {
                await checkIsAuthority(authority);
            }
        });
    });

    describe("transferOwnership", async () => {
        it("should change the owner to newOwner when it is called by the owner", async () => {
            const newOwner = accounts[9];

            await sideBridge.transferOwnership(newOwner, { from: lambdaOperator });

            const actualNewOwner = await sideBridge.owner.call();
            actualNewOwner.should.be.deep.eq(newOwner);
        });

        it("should not change the owner when it is not called by the owner", async () => {
            const newOwner = accounts[9];

            await TestHelper.expectThrow2(sideBridge.transferOwnership(newOwner, { from: accounts[1] }));
        });
    });

    describe("registerSideToken", async () => {
        it("should succeed", async () => {
            const sideTokenRegisteredEvent = sideBridge.SideTokenRegistered();

            const sideTokenId = await sideBridge.hashSideTokenId(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

            await sideBridge.registerSideToken(sideTokenId, sideToken.address, conversionRate, conversionRateDecimals);

            const watcher = (err: any, event: any) => {
                sideTokenRegisteredEvent.stopWatching();

                event.event.should.be.equal("SideTokenRegistered");
                event.args.sideTokenId.should.be.equal(sideTokenId);
                event.args.sideToken.should.be.equal(sideToken.address);
            };

            await TestHelper.awaitEvent(sideTokenRegisteredEvent, watcher);
        });

        it("should be reverted if sideToken address is invalid", async () => {
            const invalidTokenAddress = 0x0;

            const sideTokenId = await sideBridge.hashSideTokenId(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

            await TestHelper.expectThrow2(sideBridge.registerSideToken(sideTokenId, invalidTokenAddress, conversionRate, conversionRateDecimals));
        });

        it("should be reverted if sideTokenId address is invalid", async () => {
            const invalidTokenId = 0x0;

            await TestHelper.expectThrow2(sideBridge.registerSideToken(invalidTokenId, sideToken.address, conversionRate, conversionRateDecimals));
        });
    });

    describe("stake", async () => {
        it("should succeed", async () => {
            const sideTokenStakedEvent = sideBridge.SideTokenStaked();
            const stakeAmount = new BigNumber(123);

            const sideTokenId = await sideBridge.hashSideTokenId(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

            await sideBridge.registerSideToken(sideTokenId, sideToken.address, conversionRate, conversionRateDecimals);
            await sideBridge.acknowledgeSideToken(sideTokenId);

            const testTokenRecipient = await TestTokenRecipient.new();
            const depositId = await testTokenRecipient.returnHash.call(sideTokenId, sideTokenId, 1, accounts[0], 12345, 123456, sampleTxHash);

            await sideBridge.deposit(sideTokenId, depositId, 1, accounts[0], 12345, 123456, sampleTxHash, { from: accounts[0] });
            await sideBridge.deposit(sideTokenId, depositId, 1, accounts[0], 12345, 123456, sampleTxHash, { from: accounts[1] });

            await sideToken.stake(stakeAmount, { from: accounts[0] });

            const watcher = (err: any, event: any) => {
                sideTokenStakedEvent.stopWatching();

                event.event.should.be.equal("SideTokenStaked");
                event.args.sideTokenId.should.be.equal(sideTokenId);
                event.args.staker.should.be.equal(accounts[0]);
                event.args.amount.should.be.bignumber.equal(stakeAmount);
            };

            await TestHelper.awaitEvent(sideTokenStakedEvent, watcher);
        });

        it("should fail when sideBridge is paused", async () => {
            const stakeAmount = new BigNumber(123);

            const sideTokenId = await sideBridge.hashSideTokenId(sideChainId, sideTokenName, sideTokenSymbol, conversionRate, conversionRateDecimals);

            await sideBridge.registerSideToken(sideTokenId, sideToken.address, conversionRate, conversionRateDecimals);
            await sideBridge.acknowledgeSideToken(sideTokenId);

            const testTokenRecipient = await TestTokenRecipient.new();
            const depositId = await testTokenRecipient.returnHash.call(sideTokenId, sideTokenId, 1, accounts[0], 12345, 123456, sampleTxHash);

            await sideBridge.deposit(sideTokenId, depositId, 1, accounts[0], 12345, 123456, sampleTxHash, { from: accounts[0] });
            await sideBridge.deposit(sideTokenId, depositId, 1, accounts[0], 12345, 123456, sampleTxHash, { from: accounts[1] });

            for (let authority of authorities) {
                await sideBridge.pauseBridge(sampleTxHash, { from: authority });
            }

            await TestHelper.expectThrow2(sideToken.stake(stakeAmount, { from: accounts[0] }));
        });
    });

    describe("construction", async () => {
        it("should succeed when authorities.length is less than 256", async () => {
            const tooManyAuthorities = Array(255).fill(accounts[5]);

            await SideBridge.new(mainChainId, MainBridge.address, sideChainId, 200, tooManyAuthorities, { from: lambdaOperator })
                .catch((error: any) => {
                    assert.equal(error, "This case should succeed");
                });
        });

        it("should be reverted when authorities.length is greater than or equal to 256", async () => {
            const tooManyAuthorities = Array(256).fill(accounts[5]);

            await TestHelper.expectThrow2(SideBridge.new(mainChainId, MainBridge.address, sideChainId, 200, tooManyAuthorities, { from: lambdaOperator }));
        });
    });
});

// because of https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {};
