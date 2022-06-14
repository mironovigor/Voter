//SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;
import {IVoter} from "./IVoter.sol";

/**
 * @dev Voter contract
 */
contract Voter is IVoter {
    uint256 private constant VOTING_LENGTH = 3 * 24 * 60 * 60; // 3 Days
    uint256 private constant VOTE_COST = 1e16; // 0.01 ETH
    uint256 private constant FEE = 1e15; // 0.001 ETH
    uint256 private constant BANK = VOTE_COST - FEE;
    // address for restricting access to privileged methods
    address payable public immutable owner;
    struct Candidate {
        address candidateAddress;
        uint256 votesCount;
    }
    struct Ballot {
        uint256 candidatesCount;
        uint256 deadline;
        uint256 bank;
        int256 winnerId;
    }
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => Ballot) public ballots;
    mapping(uint256 => mapping(address => bool)) public seenVotes;
    uint256 public totalBallots;
    uint256 public fees;

    /**
     * @dev initialises owner with deployer's address
     */
    constructor() {
        owner = payable(msg.sender);
    }

    /**
     * @dev creates ballot
     * @param candidateAddresses[] array of candidate addresses
     * Requirements:
     * caller must be the owner
     */
    function createBallot(address[] calldata candidateAddresses) external {
        require(msg.sender == owner, "access denied");
        // this sanity check can be added, but since this is owner only method can be ommited
        // require(candidateAddresses.length > 1, "wrong candidates count");
        uint256 id = totalBallots++;
        Ballot memory ballot;
        ballot.candidatesCount = candidateAddresses.length;
        // solhint-disable-next-line not-rely-on-time
        ballot.deadline = block.timestamp + VOTING_LENGTH;
        ballot.winnerId = -1;
        ballots[id] = ballot;
        for (uint256 i = 0; i < candidateAddresses.length; i++)
            candidates[id][i].candidateAddress = candidateAddresses[i];
        emit BallotCreated(id);
    }

    /**
     * @dev withdraws admin fees
     * @param to beneficial address, if zero address provided will be substituted with owner's address
     * @param amount to withdraw, if zero amount provided will be substituted with current fee balance
     * Requirements:
     * caller must be the owner
     */
    function withdrawFees(address payable to, uint256 amount) external {
        address payable _owner = owner;
        require(msg.sender == _owner, "access denied");
        uint256 _fees = fees;
        require(_fees > 0, "nothing to withdraw");
        if (to == address(0)) to = _owner;
        if (amount == 0 || amount > _fees) amount = _fees;
        // solhint-disable-next-line avoid-low-level-calls
        (bool _sent, ) = to.call{value: amount}(new bytes(0));
        require(_sent, "failed to withdraw");
        fees -= amount;
        emit FeeWithdrawal(to, amount);
    }

    /**
     * @dev accepts votes from users
     * Requirements:
     * @param ballotId ballot id
     * @param candidateId candidate id
     * Requirements:
     * user votes didn't vote for current ballot
     * msg.value >= VOTE_COST
     * ballot exists and is not finished
     * candidate exists in ballot
     */
    function vote(uint256 ballotId, uint256 candidateId) external payable {
        require(!seenVotes[ballotId][msg.sender], "already voted");
        // early set seenVotes to prevent possible reentrancy
        seenVotes[ballotId][msg.sender] = true;
        require(msg.value >= VOTE_COST, "wrong vote value");
        Ballot memory ballot = ballots[ballotId];
        // solhint-disable-next-line not-rely-on-time
        require(ballot.deadline >= block.timestamp, "vote can't be accepted");
        Candidate memory candidate = candidates[ballotId][candidateId];
        require(candidate.candidateAddress != address(0), "wrond candidate id");
        if (msg.value > VOTE_COST) {
            // solhint-disable-next-line avoid-low-level-calls
            (bool _sent, ) = msg.sender.call{value: msg.value - VOTE_COST}(
                new bytes(0)
            );
            require(_sent, "failed to refund");
        }
        candidate.votesCount++;
        candidates[ballotId][candidateId] = candidate;
        fees += FEE;
        ballots[ballotId].bank += BANK;
        emit Voted(msg.sender, ballotId, candidateId);
    }

    /**
     * @dev Finish Vote for ballot
     * @param ballotId uint256 If of Ballot
     * Requirements:
     * Ballot deadline passed
     */
    function finishVote(uint256 ballotId) external {
        Ballot memory ballot = ballots[ballotId];
        require(
            // solhint-disable-next-line not-rely-on-time
            ballot.deadline > 0 &&
                // solhint-disable-next-line not-rely-on-time
                ballot.deadline < block.timestamp &&
                ballot.winnerId == -1,
            "voting cannot be finished"
        );
        uint256 winnerId = ballot.candidatesCount;
        address winner = owner;
        if (ballot.bank != 0) {
            winnerId = _currentWinner(ballotId, ballot.candidatesCount);
            if (winnerId != ballot.candidatesCount)
                winner = candidates[ballotId][winnerId].candidateAddress;
            // solhint-disable-next-line avoid-low-level-calls
            (bool _sent, ) = payable(winner).call{value: ballot.bank}(
                new bytes(0)
            );
            // here there is a possibility that winner address is a smart contract that doesn't accept
            // native tokens transfers, then Ballot cannot be finished and bank for it will stuck forewer on the contract
            require(_sent, "failed to send prize");
        }
        emit BallotFinished(ballotId, winnerId, winner, ballot.bank);
        ballot.bank = 0;
        ballot.winnerId = int256(winnerId);
        ballots[ballotId] = ballot;
    }

    /**
     * @dev returns winner's id
     * @param ballotId  ballot id
     * @param candidatesCount number of candidates in ballot
     * @return winnerId winner's id
     */
    function _currentWinner(uint256 ballotId, uint256 candidatesCount)
        private
        view
        returns (uint256 winnerId)
    {
        uint256 winningVotesCount = 0;
        for (uint256 i = 0; i < candidatesCount; i++) {
            Candidate memory candidate = candidates[ballotId][i];
            if (candidate.votesCount > winningVotesCount) {
                winningVotesCount = candidate.votesCount;
                winnerId = i;
            } else if (candidate.votesCount == winningVotesCount) {
                // Sanity check we don't have a case when candidates has the same winningVotesCount
                winnerId = candidatesCount;
            }
        }
    }

    /**
     * @dev Get winner  Vote for ballot
     * @param ballotId  Id of Ballot
     * @return winnerId , address winner
     */
    function currentWinner(uint256 ballotId)
        external
        view
        returns (uint256 winnerId, address winner)
    {
        Ballot memory ballot = ballots[ballotId];
        winnerId = ballot.winnerId == -1
            ? _currentWinner(ballotId, ballot.candidatesCount)
            : uint256(ballot.winnerId);
        winner = winnerId != ballot.candidatesCount
            ? candidates[ballotId][winnerId].candidateAddress
            : owner;
    }

    /**
     * @dev returns total votes for a ballot
     * @param ballotId  ballot id
     * @return votesCount
     */
    function totalVotes(uint256 ballotId)
        external
        view
        returns (uint256 votesCount)
    {
        for (uint256 i = 0; i < ballots[ballotId].candidatesCount; i++)
            votesCount += candidates[ballotId][i].votesCount;
    }
}
