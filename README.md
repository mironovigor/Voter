# Crypton Test Task

Voter smart contract, allows to create multiple Ballots from owner's address for duration of 3 days, accepts votes from users for 0.01 ETH cost. User can participate only once in a Ballot. Payment split in two parts, 10% goes to admin fees and 90% into a Bullot bank. By the end of voting, Bullot can be finished from any address. The winner gets 100% from the Bullot bank. In case there are multiple winners, Admin gets the Bullot bank. Admin fees can be withdrawn in parts or fully at any time to any address.

# Bulding & testing locally

## Install depencies

```shell
npm install
```

Copy .env.example to .env, fill all appropriate fields with your values

```shell
cp .env.example .env
```

## Build the project

```shell
npm run build
```

## Tests

### Run tests locally

```shell
npm test
```

### Run tests coverage (also locally)

```shell
npm run test:coverage
```

### Run tests on Rinkeby

Fund deployer's address on Rinkeby. [Chainlink Rinkeby Faucet](https://faucets.chain.link/rinkeby)

```shell
npm run test:rinkeby
```

## Deployment

### Test local deployment

```shell
npm run deploy
```

### Rinkeby deployment

Note deployment address for next step

```shell
npm run deploy:rinkeby
```

## Etherscan verification

Verify deployed contract on Etherscan, paste deployent address in to replace 0x4f9882e85065847EADc7C26b84d1bc01c9B2b470 with value from previous step in this command:

```shell
npm run verify -- 0x4f9882e85065847EADc7C26b84d1bc01c9B2b470
```

[Voter.sol](https://rinkeby.etherscan.io/address/0x4f9882e85065847EADc7C26b84d1bc01c9B2b470#code) deployed and verified on Rinkeby

## Hardhat Tasks overview

### accounts

lists account addresses derived from mnemonic

```shell
npx hardhat accounts
```

### deploy

deploys Voter.sol contract

```shell
npx hardhat deploy
```

### createBallot

creates a Ballot

```shell
npx hardhat createBallot --createBallot '0 1 2'
```

where 0 1 2 - accounts[i] indexes derived from mnemonic

### vote

Votes Ballot

```shell
npx hardhat vote --ballot ballotId --candidate candidateId --account 0 --value 10000000000000000
```

### finishVote

Finishes Voting for a Ballot, can only be run in forked enviroment (advances a time to Ballot's deadline)

```shell
npx hardhat finishVote --ballot ballotId
```

### totalBallots

Returns total number of Ballots, view method

```shell
npx hardhat totalBallots
```

### ballot

Returns Ballot information, view method

```shell
npx hardhat ballot --ballot ballotId
```
