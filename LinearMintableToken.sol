pragma solidity ^0.4.24;

import "./ERC20Token.sol";
import "./Ownable.sol";

contract LinearMintableToken is ERC20Token, Ownable {
  event Minted(address recipient, uint256 mintingAmount, uint256 mintedAmount);

  uint256 private constant SECONDS_IN_A_DAY = 86400;

  bool public mintingStatus = false;

  uint256 public mintingSupply;
  uint256 public intervalPeriodInDays;
  uint256 public intervalCount;
  uint256 public mintAmountPerPeriod;
  uint256 public createdTimestamp;
  uint256 public mintedAmount;

  function registerLinearMint(
    uint256 _mintingSupply,
    uint256 _mintAmountPerPeriod,
    uint256 _intervalPeriodInDays
  ) external onlyOwner() {
    require(!mintingStatus , "LinearMintableToken: mintingStatus is already true");
    require(_mintingSupply > 0 , "LinearMintableToken: mintingSupply is 0");
    require(totalSupply.add(_mintingSupply) <= maxSupply , "LinearMintableToken: totalSupply exceeds maxSupply");
    require(_mintAmountPerPeriod > 0 , "LinearMintableToken: mintAmountPerPeriod is 0");
    require(_intervalPeriodInDays > 0 , "LinearMintableToken: intervalPeriodInDays is 0");

    mintingStatus = true;

    mintingSupply = _mintingSupply;
    mintAmountPerPeriod = _mintAmountPerPeriod;
    intervalPeriodInDays = _intervalPeriodInDays;
    createdTimestamp = block.timestamp;
    mintedAmount = 0;
  }

  function linearMint() external {
    mintInternal(block.timestamp);
  }

  function mintInternal(uint256 blockTimestamp) internal {
    require(mintingStatus, "LinearMintableToken: mintingStatus must be true try registerLinearMint first");

    address tokenOwner = owner();
    uint256 mintingAmount = calculateMintAmount(blockTimestamp);

    if ( mintingAmount == 0 )
      return;

    if ( mintingAmount >= mintingSupply ) {
      mintingAmount = mintingSupply.sub(mintedAmount);
      mintingStatus = false;
    } else {
      mintingAmount = mintingAmount.sub(mintedAmount);
    }

    totalSupply = totalSupply.add(mintingAmount);

    _balances[tokenOwner] = _balances[tokenOwner].add(mintingAmount);

    mintedAmount = mintedAmount.add(mintingAmount);

    emit Minted(tokenOwner, mintingAmount, mintedAmount);
  }

  function calculateMintAmount(uint256 blockTimestamp) public view returns (uint256 mintAmount) {
    uint256 pastDays = blockTimestamp.sub(createdTimestamp).div(SECONDS_IN_A_DAY);
    uint256 pastIntervals = pastDays / intervalPeriodInDays + 1;

    return pastIntervals * mintAmountPerPeriod;
  }
}
