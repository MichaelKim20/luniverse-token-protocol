const ERC20NN = artifacts.require("ERC20TokenWithNegativeNumber");

module.exports = async (deployer, network, accounts) => {
  const name = "TestNN";
  const symbol = "TNN";
  const decimals = 18;
  const initialSupply = 1000000000000;

  const instance = await deployer.deploy(ERC20NN, name, symbol, decimals, initialSupply);
}
