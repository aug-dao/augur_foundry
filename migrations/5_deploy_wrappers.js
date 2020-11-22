//TODO
// const Web3 = require("web3");
const fs = require("fs").promises;

const { BN, constants } = require("@openzeppelin/test-helpers");

//the goal here is to test all the function that will be available to the front end
const contracts = require("../contracts.json").contracts;
const addresses = require("../environments/environment-local.json").addresses;
const markets = require("../markets/markets-local.json");

// const timeControlled = new web3.eth.Contract(
//   contracts["TimeControlled.sol"].TimeControlled.abi,
//   addresses.TimeControlled
// );

const erc20 = new web3.eth.Contract(contracts["Cash.sol"].Cash.abi);
const repToken = erc20;

const shareToken = new web3.eth.Contract(
  contracts["reporting/ShareToken.sol"].ShareToken.abi
);
const market = new web3.eth.Contract(
  contracts["reporting/Market.sol"].Market.abi
);
const disputeWindow = new web3.eth.Contract(
  contracts["reporting/DisputeWindow.sol"].DisputeWindow.abi
);

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
//Deploy 4 markets
//And Right the info in a file
const ERC20Wrapper = artifacts.require("ERC20Wrapper");
const AugurFoundry = artifacts.require("AugurFoundry");

module.exports = async function (deployer) {
  let accounts = await web3.eth.getAccounts();
  //   console.log(accounts);
  //   console.log(markets);

  // //deploy the augur foundry

  //Now lets deploy erc20s for the yes/no of these marekts
  //Only thing that the UI has to know is the address of the augur foundry which will be available in the markets.json

  let augurFoundry = await AugurFoundry.at(markets[0].augurFoundryAddress);
  shareToken.options.address = await augurFoundry.shareToken();
  // console.log(augurFoundry.address);

  //deploy erc20wrappers
  //get tokenIds for YES/NO outcome for every market

  for (i in markets) {
    // let i = 1;
    let names = [markets[i].noName, markets[i].yesName];
    // console.log(names);
    let symbols = [markets[i].noSymbol, markets[i].yesSymbol];
    // console.log(symbols);
    if (!(names[0] && symbols[0])) {
      //When you are deploying on local
      names = ["NO", "YES"];
      symbols = ["NO", "YES"];
    }
    let tokenIds = await getYesNoTokenIds(markets[i].address);

    let numTicks = await getNumTicks(markets[i].address);
    let zeros = new BN(0);
    while (numTicks.toString() != "1") {
      numTicks = numTicks.div(new BN(10));
      zeros = zeros.add(new BN(1));
    }
    let decimals = new BN(18).sub(zeros);

    console.log("decimals: " + decimals);
    // console.log("creating new ERC20s");

    await augurFoundry.newERC20Wrappers(tokenIds, names, symbols, [
      decimals,
      decimals,
    ]);

    markets[i].noTokenId = tokenIds[0];
    markets[i].yesTokenId = tokenIds[1];
    //add these tokenAddresses to the markets json file
    markets[i].NoTokenAddress = await augurFoundry.wrappers(tokenIds[0]);
    markets[i].YesTokenAddress = await augurFoundry.wrappers(tokenIds[1]);

    // console.log(await augurFoundry.wrappers(tokenIds[1]));
  }

  await fs.writeFile("./markets/markets-local.json", JSON.stringify(markets));
  //This can be used by the UI

  //we can finalize the markets to test
};
