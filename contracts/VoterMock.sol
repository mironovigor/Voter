//SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;
import {IVoter} from "./IVoter.sol";

/**
 * @dev Voter contract
 */
contract VoterMock {
    uint256 private constant VOTE_COST = 1e16 + 1;
    IVoter private immutable voter;

    constructor(address _voter) {        
        voter = IVoter(_voter);
    }

    function vote(uint256 ballotId, uint256 candidateId) external payable {
        voter.vote{value: VOTE_COST}(ballotId, candidateId);
    }
}
