//TODO
// const Web3 = require("web3");
const fs = require("fs").promises;

const { BN, time, constants } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;

//the goal here is to test all the function that will be available to the front end
const contracts = require("../contracts.json").contracts;
const addresses = require("../environments/environment-local.json").addresses;
const markets = require("../markets/markets-local.json");

const paraDeployer = new web3.eth.Contract(
  contracts["para/ParaDeployer.sol"].ParaDeployer.abi,
  addresses.ParaDeployer
);
const wETH = new web3.eth.Contract(
  contracts["0x/erc20/contracts/src/WETH9.sol"].WETH9.abi,
  addresses.WETH9
);

const createParaAugurForAToken = async function (tokenAddress, account) {
  //first add token
  console.log("Deploying para augur");

  let tokenTradeIntervalModifier = 1;

  let paraDeployProgress = await paraDeployer.methods
    .paraDeployProgress(tokenAddress)
    .call();
  console.log("paraDeployProgress", paraDeployProgress);

  if (paraDeployProgress == 0) {
    console.log("adding token");
    await paraDeployer.methods
      .addToken(tokenAddress, tokenTradeIntervalModifier)
      .send({ from: account });
  }
  if (paraDeployProgress == 14) {
    console.log("para Augur Deployement done Already");
  }
  if (paraDeployProgress >= 1 && paraDeployProgress < 14) {
    paraDeployProgress = await paraDeployer.methods
      .paraDeployProgress(tokenAddress)
      .call();

    console.log("Deploying para augur contracts");
    for (let i = paraDeployProgress; i <= 13; i++) {
      await paraDeployer.methods
        .progressDeployment(tokenAddress)
        .send({ from: account });

      console.log(
        await paraDeployer.methods.paraDeployProgress(tokenAddress).call()
      );
    }
    console.log("Deployment of para augur contracts done");
  }
};
module.exports = async function (deployer, networks, accounts) {
  await createParaAugurForAToken(wETH.options.address, accounts[0]);
};
