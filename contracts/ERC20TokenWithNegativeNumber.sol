pragma solidity ^0.4.24;

import "./SignedSafeMath.sol";
import "./Ownable.sol";
import "./Pausable.sol";

contract ERC20TokenWithNegativeNumber is Ownable, Pausable{
  using SignedSafeMath for int256;

  string private _name;
  string private _symbol;
  int256 private _totalSupply;
  uint8 private _decimals;

  mapping(address => int256) _balances;
  mapping(address => mapping (address => int256)) private _allowances;

  event Transfer(address indexed from, address indexed to, int256 value);
  event Approval(address indexed owner, address indexed spender, int256 value);
  event Mint(address indexed from, int256 value);
  event Burn(address indexed from, int256 value);
  event Recover(address indexed from, address indexed to, int256 value);

  constructor(string name, string symbol, uint8 decimals, int256 initialSupply) public {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;

    _balances[msg.sender] = initialSupply;
    _totalSupply = initialSupply;
    emit Transfer(address(0), msg.sender, initialSupply);
    emit Mint(msg.sender, initialSupply);
  }

  /**
   * @dev Returns the name of the token.
   */
  function name() public view returns (string memory) {
    return _name;
  }

  /**
   * @dev Returns the symbol of the token, usually a shorter version of the
   * name.
   */
  function symbol() public view returns (string memory) {
    return _symbol;
  }

  /**
   * @dev See {IERC20-totalSupply}.
   */
  function totalSupply() public view returns (int256) {
    return _totalSupply;
  }

  /**
   * @dev Returns the number of decimals used to get its user representation.
   * For example, if `decimals` equals `2`, a balance of `505` tokens should
   * be displayed to a user as `5,05` (`505 / 10 ** 2`).
   *
   * Tokens usually opt for a value of 18, imitating the relationship between
   * Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
   * called.
   *
   * NOTE: This information is only used for _display_ purposes: it in
   * no way affects any of the arithmetic of the contract, including
   * {IERC20-balanceOf} and {IERC20-transfer}.
   */
  function decimals() public view returns (uint8) {
    return _decimals;
  }

  /**
     * @dev Transfer token to a specified address.
     * @param to The address to transfer to.
     * @param value The amount to be transferred.
     */
  function transfer(address to, int256 value) public whenNotPaused returns (bool success) {
    _transfer(msg.sender, to, value);
    return true;
  }

  function balanceOf(address account) public view returns (int256 balance) {
    return _balances[account];
  }

  function allowance(address owner, address spender) public view returns (int256 remaining) {
    return _allowances[owner][spender];
  }

  /**
     * @dev Transfer tokens from one address to another.
     * Note that while this function emits an Approval event, this is not required as per the specification,
     * and other compliant implementations may not emit the event.
     * @param from address The address which you want to send tokens from
     * @param to address The address which you want to transfer to
     * @param value int256 the amount of tokens to be transferred
     */
  function transferFrom(address from, address to, int256 value) public whenNotPaused returns (bool success) {
    _transfer(from, to, value);
    _approve(from, msg.sender, _allowances[from][msg.sender].sub(value));
    return true;
  }

  /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
  function approve(address spender, int256 value) public whenNotPaused returns (bool success) {
    _approve(msg.sender, spender, value);
    return true;
  }

  /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     * approve should be called when _allowed[msg.sender][spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * Emits an Approval event.
     * @param spender The address which will spend the funds.
     * @param addedValue The amount of tokens to increase the allowance by.
     */
  function increaseAllowance(address spender, int256 addedValue) public whenNotPaused returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
    return true;
  }

  /**
   * @dev Decrease the amount of tokens that an owner allowed to a spender.
   * approve should be called when _allowed[msg.sender][spender] == 0. To decrement
   * allowed value is better to use this function to avoid 2 calls (and wait until
   * the first transaction is mined)
   * From MonolithDAO Token.sol
   * Emits an Approval event.
   * @param spender The address which will spend the funds.
   * @param subtractedValue The amount of tokens to decrease the allowance by.
   */
  function decreaseAllowance(address spender, int256 subtractedValue) public whenNotPaused returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue));
    return true;
  }

  /**
     * @dev Approve an address to spend another addresses' tokens.
     * @param owner The address that owns the tokens.
     * @param spender The address that will spend the tokens.
     * @param value The number of tokens that can be spent.
     */
  function _approve(address owner, address spender, int256 value) internal {
    require(spender != address(0));
    require(owner != address(0));
    require(value >= 0);

    _allowances[owner][spender] = value;
    emit Approval(owner, spender, value);
  }

  /**
     * @dev Transfer token for a specified addresses.
     * @param from The address to transfer from.
     * @param to The address to transfer to.
     * @param value The amount to be transferred.
     */
  function _transfer(address from, address to, int256 value) internal {
    require(to != address(0));
    require(_balances[from].sub(value) >= 0);

    _balances[from] = _balances[from].sub(value);
    _balances[to] = _balances[to].add(value);
    emit Transfer(from, to, value);
  }

  function _mint(address account, int256 value) internal {
    require(account != address(0));

    _totalSupply = _totalSupply.add(value);
    _balances[account] = _balances[account].add(value);

    emit Transfer(address(0), account, value);
    emit Mint(account, value);
  }

  function mint(int256 value) onlyOwner whenNotPaused public {
    _mint(msg.sender, value);
  }
  /**
   * @dev Destroys `value` tokens from `account`, reducing the
   * total supply.
   *
   * Emits a {Transfer} event with `to` set to the zero address.
   *
   * Requirements
   *
   * - `account` cannot be the zero address.
   * - `account` must have at least `value` tokens.
   */
  function _burn(address account, int256 value) internal {
    require(account != address(0));

    _balances[account] = _balances[account].sub(value);
    _totalSupply = _totalSupply.sub(value);

    require(_totalSupply >= 0, "totalSupply could not be negative");
    emit Transfer(account, address(0), value);
    emit Burn(account, value);
  }
  /**
   * @dev Destroys `value` tokens from the caller.
   *
   * See {ERC20-_burn}.
   */
  function burn(int256 value) whenNotPaused public {
    _burn(msg.sender, value);
  }

  /**
   * @dev Destroys `value` tokens from `account`, deducting from the caller's
   * allowance.
   *
   * See {ERC20-_burn} and {ERC20-allowance}.
   *
   * Requirements:
   *
   * - the caller must have allowance for ``accounts``'s tokens of at least
   * `value`.
   */
  function burnFrom(address account, int256 value) onlyOwner whenNotPaused public {
    int256 decreasedAllowance = allowance(account, msg.sender).sub(value);
    _approve(account, msg.sender, decreasedAllowance);
    _burn(account, value);
  }

  function recover(address from, int256 value) onlyOwner whenNotPaused public {
    _recover(from, msg.sender, value);
  }

  function recoverTo(address from, address to, int256 value) onlyOwner whenNotPaused public {
    _recover(from, to, value);
  }

  function _recover(address from, address to, int256 value) internal {
    require(from != address(0));
    require(to != address(0));

    _balances[from] = _balances[from].sub(value);
    _balances[to] = _balances[to].add(value);
    emit Transfer(from, to, value);
    emit Recover(from, to, value);
  }
  /**
   * @dev Called by a owner to pause, triggers stopped state.
   */
  function pause() public onlyOwner whenNotPaused {
    _pause();
  }

  function unpause() public onlyOwner whenPaused {
    _unpause();
  }

}
