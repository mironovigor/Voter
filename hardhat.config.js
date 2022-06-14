const { time } = require('@openzeppelin/test-helpers');
const { task } = require('hardhat/config');

require('dotenv').config();
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-ethers');
require('solidity-coverage');

const voterAddress = '0x4f9882e85065847EADc7C26b84d1bc01c9B2b470';

task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await web3.eth.getAccounts();
  for (const account of accounts) {
    console.log(account);
  }
});
task('deploy', 'Deploys Voter contract', async (taskArgs, hre) => {
  const deploy = require('./scripts/deploy');
  await deploy.main();
});
task('createBallot', 'Creates a Ballot')
  .addParam(
    'candidates',
    "The candidates addresses array, string with account indexes separated by space like '0 1 2'"
  )
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    const indexes = taskArgs.candidates.split(' ');
    let candidates = [];
    for (let i = 0; i < indexes.length; i++) {
      candidates.push(accounts[Number(indexes[i])].address);
    }
    console.log(`candidates: ${candidates}`);
    const voter = await hre.ethers.getContractAt('Voter', voterAddress);
    const tx = await (
      await voter.connect(accounts[0]).createBallot(candidates)
    ).wait();
    console.log(`txHash: ${tx.transactionHash}`);
  });

task('vote', 'Votes Ballot')
  .addParam('ballot', 'ballot id')
  .addParam('candidate', 'candidate id')
  .addParam('account', 'account index')
  .addParam('value', 'value to send along with vote')
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    const voter = await hre.ethers.getContractAt('Voter', voterAddress);
    const tx = await (
      await voter
        .connect(accounts[taskArgs.account])
        .vote(taskArgs.ballot, taskArgs.candidate, { value: taskArgs.value })
    ).wait();
    console.log(`txHash: ${tx.transactionHash}`);
  });

task('finishVote', 'Finishes Voting for a Ballot')
  .addParam('ballot', 'ballot id')
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    const voter = await hre.ethers.getContractAt('Voter', voterAddress);
    const ballot = await voter.ballots(taskArgs.ballot);
    const timestamp = (
      await hre.ethers.provider.getBlock(
        await hre.ethers.provider.getBlockNumber()
      )
    ).timestamp;
    if (Number(ballot[1]) > timestamp) {
      await network.provider.send('evm_setNextBlockTimestamp', [
        Number(ballot[1]),
      ]);
      await network.provider.send('evm_mine');
    }
    const tx = await (
      await voter.connect(accounts[0]).finishVote(taskArgs.ballot)
    ).wait();
    console.log(`txHash: ${tx.transactionHash}`);
  });

task('totalBallots', 'Returns total number of Ballots').setAction(
  async (taskArgs, hre) => {
    const voter = await hre.ethers.getContractAt('Voter', voterAddress);
    console.log(`totalBallots: ${await voter.totalBallots()}`);
  }
);

task('ballot', 'Returns Ballot information')
  .addParam('ballot', 'ballot id')
  .setAction(async (taskArgs, hre) => {
    const voter = await hre.ethers.getContractAt('Voter', voterAddress);
    const result = await voter.ballots(taskArgs.ballot);
    console.log(`candidatesCount: ${result[0]}`);
    console.log(`deadline: ${result[1]}`);
    console.log(`bank: ${result[2]}`);
    console.log(`winnerId: ${result[3]}`);
  });

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || '',
      accounts: { mnemonic: process.env.MNEMONIC },
    },
    hardhat: {
      // forking: {
      //   url: process.env.RINKEBY_URL || '',
      // },
      accounts: { mnemonic: process.env.MNEMONIC },
    },
    forked: {
      url: 'http://127.0.0.1:8545/',
      accounts: { mnemonic: process.env.MNEMONIC },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
