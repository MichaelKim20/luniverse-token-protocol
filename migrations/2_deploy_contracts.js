var MainBridge = artifacts.require('./MainBridge.sol');
var SideBridge = artifacts.require('./SideBridge.sol');
var MainToken = artifacts.require('./MainToken.sol');
var MainTokenProxy = artifacts.require('./MainTokenProxy.sol');
var ERC20Token = artifacts.require('./ERC20Token.sol');
var HashUtils = artifacts.require('./HashUtils.sol');

const BigNumber = web3.BigNumber;

module.exports = function(deployer, network, accounts) {
  let decimals = new BigNumber(18);
  let initialSupply = new BigNumber(10000);
  let maxSupply = new BigNumber(800000000);
  let mainChainId = 1000;
  let sideChainId = 2000;

  deployer.deploy(MainToken, "MainToken", "MTKS", decimals, initialSupply, maxSupply).then(function() {
    return deployer.deploy(MainTokenProxy, MainToken.address);
  });

  deployer.deploy(ERC20Token, "MainToken", "MTKS", decimals, initialSupply, maxSupply).then(function() {
    return deployer.deploy(MainBridge, mainChainId, ERC20Token.address, accounts[8]).then(function() {
      const authorities = [accounts[0],accounts[1],accounts[2]];
      deployer.deploy(SideBridge, mainChainId, MainBridge.address, sideChainId, 2, authorities);
    })
  });

}
