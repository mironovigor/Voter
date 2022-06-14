const {
  expectEvent,
  expectRevert,
  constants,
  balance,
  ether,
  time,
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { contract, web3, artifacts } = require('hardhat');
const { toBN } = require('web3-utils');

const BN = web3.utils.BN;
// uint256 private constant VOTING_LENGTH = 3 * 24 * 60 * 60; // 3 Days
//     uint256 private constant VOTE_COST = 1e16; // 0.01 ETH
//     uint256 private constant FEE = 1e16; // 0.001 ETH
//     uint256 private constant BANK = VOTE_COST - FEE;
const ZERO = toBN(0);
const VOTING_LENGTH = toBN(3 * 24 * 60 * 60);
const VOTE_COST = toBN(1e16);
const FEE = toBN(1e15);
const BANK = VOTE_COST.sub(FEE);

let voter, owner, user0, user1, user2;
contract('Voter', () => {
  before(async () => {
    [owner, user0, user1, user2] = await web3.eth.getAccounts();
    const Voter = artifacts.require('Voter');
    voter = await Voter.new();
  });

  async function createBallot(users) {
    const totalBallots = toBN(await voter.totalBallots());
    const ballotId = totalBallots.isZero() ? toBN(0) : totalBallots;
    const tx = await voter.createBallot(users);
    // console.log(JSON.stringify(tx, null, 2));
    expect(await voter.totalBallots()).to.be.bignumber.equal(
      totalBallots.add(toBN(1))
    );
    const ballot = await voter.ballots(ballotId);
    expect(ballot.candidatesCount).to.be.bignumber.equal(toBN(users.length));
    const timestamp = (await web3.eth.getBlock(tx.receipt.blockNumber))
      .timestamp;
    expect(ballot.deadline).to.be.bignumber.equal(
      toBN(timestamp).add(VOTING_LENGTH)
    );
    expect(ballot.bank).to.be.bignumber.zero;
    expect(ballot.winnerId).to.be.bignumber.equal(toBN(-1));
    for (let i = 0; i < users.length; i++) {
      const candidate = await voter.candidates(ballotId, i);
      expect(candidate.candidateAddress).to.eq(users[i]);
      expect(candidate.votesCount).to.be.bignumber.zero;
    }
    expectEvent(tx, 'BallotCreated', { id: ballotId });
  }

  async function vote(ballotId, candidateId, from, value) {
    const ballots = await voter.ballots(ballotId);
    const totalVotes = toBN(await voter.totalVotes(ballotId));
    const candidate = await voter.candidates(ballotId, candidateId);
    const feesAdmin = await voter.fees();
    const tracker = await balance.tracker(voter.address, (unit = 'wei'));
    const trackerFrom = await balance.tracker(from, (unit = 'wei'));
    const tx = await voter.vote(ballotId, candidateId, {
      from: from,
      value: value,
    });
    const ballotAfter = await voter.ballots(ballotId);
    const candidateAfter = await voter.candidates(ballotId, candidateId);
    expect(ballotAfter.bank).to.be.bignumber.equal(ballots.bank.add(BANK));
    expect(await voter.totalVotes(ballotId)).to.be.bignumber.equal(
      totalVotes.add(toBN(1))
    );
    expect(candidateAfter.votesCount).to.be.bignumber.equal(
      candidate.votesCount.add(toBN(1))
    );
    expect(await voter.fees()).to.be.bignumber.equal(feesAdmin.add(FEE));
    expect(await tracker.delta()).to.be.bignumber.equal(VOTE_COST);
    const { delta, fees } = await trackerFrom.deltaWithFees();
    expect(delta.add(fees)).to.be.bignumber.equal(VOTE_COST.neg());
    expectEvent(tx, 'Voted', {
      voter: from,
      ballotId: toBN(ballotId),
      candidateId: toBN(candidateId),
    });
  }

  async function finishVote(ballotId, from) {
    const ballot = await voter.ballots(ballotId);
    // console.log(JSON.stringify(ballot, null, 2));
    const currentWinner = await voter.currentWinner(ballotId);
    // console.log(JSON.stringify(currentWinner, null, 2));
    const tracker = await balance.tracker(voter.address, (unit = 'wei'));
    const trackerWinner = await balance.tracker(
      currentWinner.winner,
      (unit = 'wei')
    );
    const timestamp = toBN(
      (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp
    );
    if (timestamp.lt(ballot.deadline))
      await time.increaseTo(ballot.deadline.add(toBN(1)));
    const tx = await voter.finishVote(ballotId, { from: from });

    const ballotAfter = await voter.ballots(ballotId);
    // console.log(JSON.stringify(ballotAfter, null, 2));

    expect(ballotAfter.bank).to.be.bignumber.zero;
    expect(ballotAfter.winnerId).to.be.bignumber.not.equal(toBN(-1));
    expect(ballotAfter.winnerId).to.be.bignumber.equal(currentWinner.winnerId);

    expect(await tracker.delta()).to.be.bignumber.equal(ballot.bank.neg());
    if (currentWinner.winner.toLowerCase() === from.toLowerCase()) {
      const { delta, fees } = await trackerWinner.deltaWithFees();
      expect(delta.add(fees)).to.be.bignumber.equal(ballot.bank);
    } else {
      expect(await trackerWinner.delta()).to.be.bignumber.equal(ballot.bank);
    }
    if (currentWinner.winnerId.eq(ballot.candidatesCount)) {
      expect(currentWinner.winner).to.eq(owner);
    }
    expectEvent(tx, 'BallotFinished', {
      id: toBN(ballotId),
      winnerId: currentWinner.winnerId,
      winner: currentWinner.winner,
      amountPaid: ballot.bank,
    });
  }

  async function withdrawFees(to, amount) {
    const _to = to === constants.ZERO_ADDRESS ? owner : to;
    const feesAdmin = await voter.fees();
    const _amount = amount.isZero() ? feesAdmin : amount;
    const tracker = await balance.tracker(voter.address, (unit = 'wei'));
    const trackerTo = await balance.tracker(_to, (unit = 'wei'));
    const tx = await voter.withdrawFees(to, amount);
    expect(await tracker.delta()).to.be.bignumber.equal(_amount.neg());
    const { delta, fees } = await trackerTo.deltaWithFees();
    expect(delta.add(fees)).to.be.bignumber.equal(_amount);
    expectEvent(tx, 'FeeWithdrawal', { to: _to, amount: _amount });
  }

  describe("Check deployment & priviliged methods can't be called from non owner's address", () => {
    it('should check owner address is set correctly', async () => {
      expect(await voter.owner()).to.eq(owner);
    });
    it("should check createBallot can't be called from non-onwer address", async () => {
      await expectRevert(
        voter.createBallot([owner, user0, user0], { from: user0 }),
        'access denied'
      );
    });
    it("should check withdrawFees can't be called from non-onwer address", async () => {
      await expectRevert(
        voter.withdrawFees(user0, 0, { from: user0 }),
        'access denied'
      );
    });
  });

  describe('Check createBallot method', () => {
    it('should create Ballot 0', async () => {
      await createBallot([owner, user0, user1]);
    });
    it('should create Ballot 1', async () => {
      await createBallot([owner, user0, user1]);
    });
    it('should create Ballot 2', async () => {
      await createBallot([owner, user0, user1]);
    });
    it('should create Ballot 3', async () => {
      await createBallot([owner, voter.address]);
    });
  });

  describe('Check vote method', () => {
    it('should fail to vote non-existing ballot 4', async () => {
      await expectRevert(
        voter.vote(4, 0, { from: user0, value: VOTE_COST }),
        "vote can't be accepted"
      );
    });
    it('should fail to vote ballot 0 non-existing candidate 3', async () => {
      await expectRevert(
        voter.vote(0, 3, { from: user0, value: VOTE_COST }),
        'wrond candidate id'
      );
    });

    it('vote ballot 0 for candidate 0 from user0 address', async () => {
      await vote(0, 0, user0, VOTE_COST);
    });
    it('should fail to vote ballot 0 from already voted user0 address', async () => {
      await expectRevert(vote(0, 0, user0, VOTE_COST), 'already voted');
    });
    it('should fail to vote ballot 0 for candidate 1 from user1 address paying less VOTE_COST', async () => {
      await expectRevert(
        voter.vote(0, 1, { from: user1, value: VOTE_COST.sub(toBN(1)) }),
        'wrong vote value'
      );
    });
    it('vote ballot 0 for candidate 1 from user1 address paying more than VOTE_COST', async () => {
      await vote(0, 1, user1, VOTE_COST.add(toBN(1)));
    });
    it('vote ballot 0 for candidate 2 from user2 address', async () => {
      await vote(0, 2, user2, VOTE_COST);
    });

    it('vote ballot 1 for candidate 0 from user0 address', async () => {
      await vote(1, 0, user0, VOTE_COST);
    });
    it('vote ballot 1 for candidate 0 from user1 address', async () => {
      await vote(1, 0, user1, VOTE_COST);
    });
    it('vote ballot 1 for candidate 1 from user2 address', async () => {
      await vote(1, 1, user2, VOTE_COST);
    });

    it('vote ballot 3 for candidate 1 from user1 address', async () => {
      await vote(3, 1, user1, VOTE_COST);
    });
    it('should fail to vote ballot 3 for candidate 0 from smartcontract address paying more than VOTE_COST', async () => {
      VoterMock = artifacts.require('VoterMock');
      voterMock = await VoterMock.new(voter.address);
      await expectRevert(
        voterMock.vote(3, 0, { value: VOTE_COST.add(toBN(1)) }),
        'failed to refund'
      );
    });
  });

  describe('Check finishVote method', () => {
    it('should fail to finishVote non-existing ballot 4 from owner', async () => {
      await expectRevert(
        voter.finishVote(4, { from: owner }),
        'voting cannot be finished'
      );
    });
    it('should fail to finishVote ongoing ballot 0 from owner', async () => {
      await expectRevert(
        voter.finishVote(0, { from: owner }),
        'voting cannot be finished'
      );
    });
    it('finish voting for bulletin 0 from owner address', async () => {
      await finishVote(0, owner);
    });
    it('should fail to finishVote already finished ballot 0 from owner', async () => {
      await expectRevert(
        voter.finishVote(0, { from: owner }),
        'voting cannot be finished'
      );
    });
    it('finish voting for bulletin 1 from users0 address', async () => {
      await finishVote(1, user0);
    });
    it('finish voting for bulletin 2 from users0 address with no votes', async () => {
      await finishVote(2, user0);
    });
    it("should fail to finishVote 3 from owner with winner that doesn't accept payment", async () => {
      await expectRevert(
        voter.finishVote(3, { from: owner }),
        'failed to send prize'
      );
    });
  });

  describe('Check withdrawFees method', () => {
    it('should fail to withdrawFees to a contract address with no payable fallback', async () => {
      await expectRevert(
        voter.withdrawFees(voter.address, toBN(0)),
        'failed to withdraw'
      );
    });
    it("withdrawFees half of all fees to owner address providing 'to' zero address", async () => {
      const amount = (await voter.fees()).div(toBN(2));
      await withdrawFees(constants.ZERO_ADDRESS, amount);
    });
    it('withdrawFees half of all fees to user0 address', async () => {
      const amount = (await voter.fees()).div(toBN(2));
      await withdrawFees(user1, amount);
    });
    it("withdrawFees remaining all fees to owner address providing 'to' zero address", async () => {
      await withdrawFees(constants.ZERO_ADDRESS, toBN(0));
    });
    it('should fail to withdrawFees when no fees are available', async () => {
      await expectRevert(
        voter.withdrawFees(constants.ZERO_ADDRESS, toBN(0)),
        'nothing to withdraw'
      );
    });
  });
});
