//SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

/**
 * @dev interface for Ballot contract
 */
interface IVoter {
    event BallotCreated(uint256 indexed id);
    event FeeWithdrawal(address indexed to, uint256 amount);
    event Voted(address indexed voter, uint256 ballotId, uint256 candidateId);
    event BallotFinished(
        uint256 indexed id,
        uint256 winnerId,
        address winner,
        uint256 amountPaid
    );

    function createBallot(address[] calldata candidateAddresses) external;

    function withdrawFees(address payable to, uint256 amount) external;

    function vote(uint256 ballotId, uint256 candidateId) external payable;

    function finishVote(uint256 ballotId) external;

    function currentWinner(uint256 ballotId)
        external
        view
        returns (uint256 winnerId, address winner);

    function totalVotes(uint256 ballotId)
        external
        view
        returns (uint256 votesCount);
}
