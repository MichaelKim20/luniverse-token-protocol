"use strict";
const MainToken = artifacts.require("./MainToken.sol");
const ContractProxy = artifacts.require("./ContractProxy.sol");
const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");
contract("Contract Proxy", (accounts) => {
    const owner = accounts[0];
    const initialSupply = new BigNumber(web3.toWei(1000, "ether"));
    const maxSupply = new BigNumber(web3.toWei(2000, "ether"));
    const decimals = new BigNumber(18);
    const name = "NAME";
    const symbol = "SYMBOL";
    const newInitialSupply = new BigNumber(web3.toWei(4000, "ether"));
    const newMaxSupply = new BigNumber(web3.toWei(8000, "ether"));
    const newName = "NAME2";
    const newSymbol = "SYMBOL2";
    describe("contract proxy test", async () => {
        let mainToken;
        let mainToken2;
        let contractProxy;
        before(async () => {
            mainToken = await MainToken.new(name, symbol, decimals, initialSupply, maxSupply);
            contractProxy = await ContractProxy.new(mainToken.address, { from: owner });
            mainToken2 = await MainToken.new(newName, newSymbol, decimals, newInitialSupply, newMaxSupply);
        });
        it("should change contract address", async () => {
            await contractProxy.UpdateContractAddress(mainToken2.address, { from: owner });
            const updatedContractEvent = contractProxy.ContractAddressUpdated({
                fromBlock: web3.eth.blockNumber,
                lastBlock: "latest",
            });
            const watcher = async (err, event) => {
                updatedContractEvent.stopWatching();
                event.event.should.be.equal("ContractAddressUpdated");
                event.args.previousAddress.should.be.equal(mainToken.address);
                event.args.newAddress.should.be.equal(mainToken2.address);
                const loadedContract = await MainToken.at(event.args.newAddress);
                const resultResponse = await loadedContract.totalSupply.call();
                resultResponse.should.to.eql(newInitialSupply);
            };
            await TestHelper.awaitEvent(updatedContractEvent, watcher);
        });
        it("should revert when address is invalid", async () => {
            const invalidAddress = 0x0;
            await TestHelper.expectThrow2(contractProxy.UpdateContractAddress(invalidAddress, { from: owner }));
        });
    });
});
//# sourceMappingURL=ContractProxy.spec.js.map