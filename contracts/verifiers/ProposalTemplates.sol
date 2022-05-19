pragma solidity ^0.5.0;

import "../common/Decimal.sol";
import "../proposal/base/IProposal.sol";
import "./IProposalVerifier.sol";
import "../ownership/Ownable.sol";
import "../version/Version.sol";
import "../common/Initializable.sol";

/**
 * @dev A storage of current proposal templates. Any new proposal will be verified against the stored template of its type.
 *      Verification checks for parameters and calls additional verifier (if any).
 *      Supposed to be owned by the governance contract
 */
contract ProposalTemplates is
    Initializable,
    IProposalVerifier,
    Ownable,
    Version
{
    function initialize() public initializer {
        Ownable.initialize(msg.sender);
    }

    event AddedTemplate(uint256 pType);
    event ErasedTemplate(uint256 pType);

    // Stored data for a proposal template
    struct ProposalTemplate {
        string name;
        address verifier; // used as additional verifier
        Proposal.ExecType executable; // proposal execution type when proposal gets resolved
        uint256 minVotes; // minimum voting turnout (ratio)
        uint256 minAgreement; // minimum allowed minAgreement
        uint256[] opinionScales; // Each opinion scale defines an exact measure of agreement which voter may choose
        uint256 minVotingDuration; // minimum duration of the voting
        uint256 maxVotingDuration; // maximum duration of the voting
        uint256 minStartDelay; // minimum delay of the voting (i.e. must start with a delay)
        uint256 maxStartDelay; // maximum delay of the voting (i.e. must start sooner)
    }

    // templates library
    mapping(uint256 => ProposalTemplate) proposalTemplates; // proposal type -> ProposalTemplate

    // exists returns true if proposal template is present
    function exists(uint256 pType) public view returns (bool) {
        return bytes(proposalTemplates[pType].name).length != 0;
    }

    // get returns proposal template
    function get(uint256 pType)
        public
        view
        returns (
            string memory name,
            address verifier,
            Proposal.ExecType executable,
            uint256 minVotes,
            uint256 minAgreement,
            uint256[] memory opinionScales,
            uint256 minVotingDuration,
            uint256 maxVotingDuration,
            uint256 minStartDelay,
            uint256 maxStartDelay
        )
    {
        ProposalTemplate storage t = proposalTemplates[pType];
        return (
            t.name,
            t.verifier,
            t.executable,
            t.minVotes,
            t.minAgreement,
            t.opinionScales,
            t.minVotingDuration,
            t.maxVotingDuration,
            t.minStartDelay,
            t.maxStartDelay
        );
    }

    // addTemplate adds a template into the library
    // template must have unique type
    function addTemplate(
        uint256 pType,
        string calldata name,
        address verifier,
        Proposal.ExecType executable,
        uint256 minVotes,
        uint256 minAgreement,
        uint256[] calldata opinionScales,
        uint256 minVotingDuration,
        uint256 maxVotingDuration,
        uint256 minStartDelay,
        uint256 maxStartDelay
    ) external onlyOwner {
        ProposalTemplate storage template = proposalTemplates[pType];
        // empty name is a marker of non-existing template
        require(bytes(name).length != 0, "empty name");
        require(!exists(pType), "template already exists");
        require(opinionScales.length != 0, "empty opinions");
        require(checkNonDecreasing(opinionScales), "wrong order of opinions");
        require(
            opinionScales[opinionScales.length - 1] != 0,
            "all opinions are zero"
        );
        require(minVotes <= Decimal.unit(), "minVotes > 1.0");
        require(minAgreement <= Decimal.unit(), "minAgreement > 1.0");
        template.verifier = verifier;
        template.name = name;
        template.executable = executable;
        template.minVotes = minVotes;
        template.minAgreement = minAgreement;
        template.opinionScales = opinionScales;
        template.minVotingDuration = minVotingDuration;
        template.maxVotingDuration = maxVotingDuration;
        template.minStartDelay = minStartDelay;
        template.maxStartDelay = maxStartDelay;

        emit AddedTemplate(pType);
    }

    // eraseTemplate removes the template of specified type from the library
    function eraseTemplate(uint256 pType) external onlyOwner {
        require(exists(pType), "template doesn't exist");
        delete (proposalTemplates[pType]);

        emit ErasedTemplate(pType);
    }

    // verifyProposalParams checks proposal parameters
    function verifyProposalParams(
        uint256 pType,
        Proposal.ExecType executable,
        uint256 minVotes,
        uint256 minAgreement,
        uint256[] calldata opinionScales,
        uint256 start,
        uint256 minEnd,
        uint256 maxEnd
    ) external view returns (string memory) {
        if (start < block.timestamp) {
            return ("starts in the past");
        }
        if (minEnd > maxEnd) {
            return ("min end greater than max end");
        }
        if (start > minEnd) {
            return ("start greater than min end");
        }
        uint256 minDuration = minEnd - start;
        uint256 maxDuration = maxEnd - start;
        uint256 startDelay_ = start - block.timestamp;

        if (!exists(pType)) {
            return ("non-existing template");
        }

        ProposalTemplate memory template = proposalTemplates[pType];
        if (executable != template.executable) {
            return ("inconsistent executable flag");
        }

        if (minVotes < template.minVotes) {
            return ("turnout too small");
        }
        if (minVotes > Decimal.unit()) {
            return ("turnout bigger than 100%");
        }
        if (minAgreement < template.minAgreement) {
            return ("quorum too small");
        }
        if (minAgreement > Decimal.unit()) {
            return ("quorum bigger than 100%");
        }
        if (opinionScales.length != template.opinionScales.length) {
            return ("wrong opinion scales length");
        }
        for (uint256 i = 0; i < opinionScales.length; i++) {
            if (opinionScales[i] != template.opinionScales[i]) {
                return ("wrong opinion scales");
            }
        }
        if (minDuration < template.minVotingDuration) {
            return ("min voting duration too short");
        }
        if (maxDuration > template.maxVotingDuration) {
            return ("max voting duration too long");
        }
        if (startDelay_ < template.minStartDelay) {
            return ("voting must start later");
        }
        if (startDelay_ > template.maxStartDelay) {
            return ("voting too distant in future");
        }
        if (template.verifier == address(0)) {
            return ("");
        }
        return
            IProposalVerifier(template.verifier).verifyProposalParams(
                pType,
                executable,
                minVotes,
                minAgreement,
                opinionScales,
                start,
                minEnd,
                maxEnd
            );
    }

    // verifyProposalContract verifies proposal using the additional verifier
    function verifyProposalContract(uint256 pType, address propAddr)
        external
        view
        returns (string memory)
    {
        if (!exists(pType)) {
            // non-existing template
            return ("non-existing template");
        }
        ProposalTemplate memory template = proposalTemplates[pType];
        if (template.verifier == address(0)) {
            // template with no additional verifier
            return ("");
        }
        return
            IProposalVerifier(template.verifier).verifyProposalContract(
                pType,
                propAddr
            );
    }

    // checkNonDecreasing returns true if array values are monotonically nondecreasing
    function checkNonDecreasing(uint256[] memory arr)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 1; i < arr.length; i++) {
            if (arr[i - 1] > arr[i]) {
                return false;
            }
        }
        return true;
    }
}
