const hre = require('hardhat');
async function main() {
  const Voter = artifacts.require('Voter');
  const voter = await Voter.new();
  console.log('Voter deployed to:', voter.address);
  return voter;
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
module.exports = {
  main,
};
