"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MainBridge = artifacts.require("MainBridge");
const ProductBridge = artifacts.require("ProductBridge");
const ProductToken = artifacts.require("ProductToken");
const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");
contract("ProductBridge", (accounts) => {
    const lambdaOperator = accounts[0];
    const mainChainId = new BigNumber(1000);
    const productChainId = new BigNumber(2000);
    const productTokenName = "ProductToken";
    const productTokenSymbol = "PT1";
    const decimals = new BigNumber(18);
    const conversionRate = 10;
    const conversionRateDecimals = 0;
    const requiredSignatures = new BigNumber(2);
    const authorities = [accounts[0], accounts[1], accounts[2]];
    let productBridge;
    let productToken;
    beforeEach(async () => {
        productBridge = await ProductBridge.new(mainChainId, MainBridge.address, productChainId, requiredSignatures, authorities, { from: lambdaOperator });
        productToken = await ProductToken.new(productTokenName, productTokenSymbol, decimals, productBridge.address);
    });
    describe("After construction", async () => {
        it("should be created", async () => {
            should.exist(productBridge);
            should.exist(productBridge.address);
        });
        it("should have the specified owner", async () => {
            const actualOwner = await productBridge.owner.call();
            actualOwner.should.be.deep.eq(lambdaOperator);
        });
        it("should have the specified mainChainId", async () => {
            const actualChainId = await productBridge.mainChainId.call();
            actualChainId.should.be.bignumber.equal(mainChainId);
        });
        it("should have the specified requiredSignatues", async () => {
            const actualRequiredSignatures = await productBridge.requiredSignatures.call();
            actualRequiredSignatures.should.be.bignumber.equal(requiredSignatures);
        });
        it("should have the specified authorities", async () => {
            async function checkIsAuthority(authority) {
                const isAuthority = await productBridge.authorities.call(authority);
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
            await productBridge.transferOwnership(newOwner, { from: lambdaOperator });
            const actualNewOwner = await productBridge.owner.call();
            actualNewOwner.should.be.deep.eq(newOwner);
        });
        it("should not change the owner when it is not called by the owner", async () => {
            const newOwner = accounts[9];
            await TestHelper.expectThrow2(productBridge.transferOwnership(newOwner, { from: accounts[1] }));
        });
    });
    describe("registerProductToken", async () => {
        it("should succeed", async () => {
            const productTokenRegisteredEvent = productBridge.ProductTokenRegistered();
            const productTokenId = await productBridge.hashProductTokenId(productChainId, productTokenName, productTokenSymbol, conversionRate, conversionRateDecimals);
            await productBridge.registerProductToken(productTokenId, productToken.address, conversionRate, conversionRateDecimals);
            const watcher = (err, event) => {
                productTokenRegisteredEvent.stopWatching();
                event.event.should.be.equal("ProductTokenRegistered");
                event.args.productTokenId.should.be.equal(productTokenId);
                event.args.productToken.should.be.equal(productToken.address);
            };
            await TestHelper.awaitEvent(productTokenRegisteredEvent, watcher);
        });
        it("should be reverted if productToken address is invalid", async () => {
            const invalidTokenAddress = 0x0;
            const productTokenId = await productBridge.hashProductTokenId(productChainId, productTokenName, productTokenSymbol, conversionRate, conversionRateDecimals);
            await TestHelper.expectThrow2(productBridge.registerProductToken(productTokenId, invalidTokenAddress, conversionRate, conversionRateDecimals));
        });
        it("should be reverted if productTokenId address is invalid", async () => {
            const invalidTokenId = 0x0;
            await TestHelper.expectThrow2(productBridge.registerProductToken(invalidTokenId, productToken.address, conversionRate, conversionRateDecimals));
        });
    });
    describe("stake", async () => {
        it("should succeed", async () => {
            const productTokenRegisteredEvent = productBridge.ProductTokenRegistered();
            const productTokenId = await productBridge.hashProductTokenId(productChainId, productTokenName, productTokenSymbol, conversionRate, conversionRateDecimals);
            await productBridge.registerProductToken(productTokenId, productToken.address, conversionRate, conversionRateDecimals);
            const watcher = (err, event) => {
                productTokenRegisteredEvent.stopWatching();
                event.event.should.be.equal("ProductTokenRegistered");
                event.args.productTokenId.should.be.equal(productTokenId);
                event.args.productToken.should.be.equal(productToken.address);
            };
            await TestHelper.awaitEvent(productTokenRegisteredEvent, watcher);
        });
    });
    describe("construction", async () => {
        it("should succeed when authorities.length is less than 256", async () => {
            const tooManyAuthorities = Array(255).fill(accounts[5]);
            await ProductBridge.new(mainChainId, MainBridge.address, productChainId, 200, tooManyAuthorities, { from: lambdaOperator })
                .catch((error) => {
                assert.equal(error, "This case should succeed");
            });
        });
        it("should be reverted when authorities.length is greater than or equal to 256", async () => {
            const tooManyAuthorities = Array(256).fill(accounts[5]);
            await TestHelper.expectThrow2(ProductBridge.new(mainChainId, MainBridge.address, productChainId, 200, tooManyAuthorities, { from: lambdaOperator }));
        });
    });
});
//# sourceMappingURL=ProductBridge.spec.js.map