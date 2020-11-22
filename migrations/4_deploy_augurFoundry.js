//TODO
// const Web3 = require("web3");
const fs = require("fs").promises;

const { BN, constants } = require("@openzeppelin/test-helpers");

//the goal here is to test all the function that will be available to the front end
const contracts = require("../contracts.json").contracts;
const addresses = require("../environments/environment-local.json").addresses;
const markets = require("../markets/markets-local.json");
const { shareToken } = require("../scripts/utils");

// const timeControlled = new web3.eth.Contract(
//   contracts["TimeControlled.sol"].TimeControlled.abi,
//   addresses.TimeControlled
// );

const erc20 = new web3.eth.Contract(contracts["Cash.sol"].Cash.abi);
const repToken = erc20;
//This is the DAI token
const wETH = new web3.eth.Contract(
  contracts["0x/erc20/contracts/src/WETH9.sol"].WETH9.abi,
  addresses.WETH9
);
const paraDeployer = new web3.eth.Contract(
  contracts["para/ParaDeployer.sol"].ParaDeployer.abi,
  addresses.ParaDeployer
);
const augur = new web3.eth.Contract(contracts["Augur.sol"].Augur.abi);

const with18Decimals = function (amount) {
  return amount.mul(new BN(10).pow(new BN(18)));
};
const THOUSAND = with18Decimals(new BN(1000));

//For A YES/No market the outcomes will be three
const OUTCOMES = { INVALID: 0, NO: 1, YES: 2 };
const outComes = [0, 1, 2];
// Object.freeze(outComes);

//NOTE: figure out a way to do this wothout making a call to the blockchain
const getTokenId = async function (marketAddress, outcome) {
  return await shareToken.methods.getTokenId(marketAddress, outcome).call();
};
const getYesNoTokenIds = async function (yesNoMarketAddress) {
  let tokenIds = [];
  tokenIds.push(await getTokenId(yesNoMarketAddress, OUTCOMES.NO));
  tokenIds.push(await getTokenId(yesNoMarketAddress, OUTCOMES.YES));
  return tokenIds;
};
const getNumTicks = async function (marketAddress) {
  market.options.address = marketAddress;
  return new BN(await market.methods.getNumTicks().call());
};
const getBytes32FromString = function (someString) {
  return web3.utils.fromAscii(someString);
};
///Deploy Augur Foundry
const ERC20Wrapper = artifacts.require("ERC20Wrapper");
const AugurFoundry = artifacts.require("AugurFoundry");

module.exports = async function (deployer) {
  let accounts = await web3.eth.getAccounts();
  // console.log(accounts);
  //   console.log(markets);

  // //deploy the augur foundry

  //Now lets deploy erc20s for the yes/no of these marekts
  //Only thing that the UI has to know is the address of the augur foundry which will be available in the markets.json
  let augurAddress = await paraDeployer.methods
    .paraAugurs(wETH.options.address)
    .call();
  augur.options.address = augurAddress;

  let shareTokenAddress = await augur.methods
    .lookup(getBytes32FromString("ShareToken"))
    .call();
  console.log("shareTokenAddress", shareTokenAddress);
  await deployer.deploy(
    AugurFoundry,
    shareTokenAddress,
    wETH.options.address,
    augurAddress
  );
  let augurFoundry = await AugurFoundry.deployed();
  // console.log(augurFoundry.address);

  markets[0].augurFoundryAddress = augurFoundry.address;
  // await deployer.deploy(AugurFoundry);

  await fs.writeFile("./markets/markets-local.json", JSON.stringify(markets));
  //This can be used by the UI
};
