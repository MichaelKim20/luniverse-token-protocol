const MainTokenProxy = artifacts.require('./MainTokenProxy.sol');
const MainToken = artifacts.require('./MainToken.sol');

const { BigNumber } = web3;
const should = require("chai")
    .use(require("chai-as-promised"))
    .use(require("chai-bignumber")(BigNumber))
    .should();
const TestHelper = require("./helpers");

type Address = string;

contract("MainTokenProxy", (accounts: Address[]) => {
    let mainTokenProxy: any;
    const owner: Address = accounts[0];
    const newContractAddress = '0x1111000022220000333300004444000055550000';
    const revertMessage = 'VM Exception while processing transaction: revert';

    beforeEach(async () => {
        const decimals = 18;
        const initialSupply = 10000;
        const maximumSupply = initialSupply * 2;
        const mainToken = await MainToken.new('MainToken', 'MT', decimals, initialSupply, maximumSupply);
        mainTokenProxy = await MainTokenProxy.new(mainToken.address);
    });

    it('should be created', async () => {
        should.exist(mainTokenProxy);
        should.exist(mainTokenProxy.owner);
        should.exist(mainTokenProxy.address);
    });

    it('should have correct owner', async () => {
        const actualOwner = await mainTokenProxy.owner();
        actualOwner.should.be.eq(owner);
    });

    it('should update contract address', async () => {
        await mainTokenProxy.UpdateContractAddress.sendTransaction(newContractAddress);

        const contractAddress = await mainTokenProxy.contractAddress();
        contractAddress.should.equal(newContractAddress);
    });

    it('should not update from users other than the owner', async () => {
        await TestHelper.expectThrow2(mainTokenProxy.UpdateContractAddress(newContractAddress, { from: accounts[1] }));
    });
});

// because of https://stackoverflow.com/questions/40900791/cannot-redeclare-block-scoped-variable-in-unrelated-files
export {};
