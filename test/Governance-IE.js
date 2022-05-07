const {
  BN,
  ether,
  expectRevert,
  time,
  balance
} = require('openzeppelin-test-helpers');

const { expect } = require('chai');

const Governance = artifacts.require('UnitTestGovernance');
const ProposalTemplates = artifacts.require('ProposalTemplates');
const UnitTestGovernable = artifacts.require('UnitTestGovernable');
const PlainTextProposal = artifacts.require('PlainTextProposal');
const ExplicitProposal = artifacts.require('ExplicitProposal');
const ExecLoggingProposal = artifacts.require('ExecLoggingProposal');
const PlainTextProposalFactory = artifacts.require('PlainTextProposalFactory');
const OwnableVerifier = artifacts.require('OwnableVerifier');
const SlashingRefundProposal = artifacts.require('SlashingRefundProposal');

const NonExecutableType = new BN('0');
const CallType = new BN('1');
const DelegatecallType = new BN('2');

function ratio(n) {
  return ether(n);
}

const emptyAddr = '0x0000000000000000000000000000000000000000';

contract(
  'Governance test',
  async ([
    defaultAcc,
    otherAcc,
    firstVoterAcc,
    secondVoterAcc,
    delegatorAcc
  ]) => {
    beforeEach(async () => {
      this.govable = await UnitTestGovernable.new();
      this.verifier = await ProposalTemplates.new();
      this.verifier.initialize();
      this.gov = await Governance.new();
      this.gov.initialize(this.govable.address, this.verifier.address);
      this.proposalFee = await this.gov.proposalFee();
    });

    const scales = [0, 2, 3, 4, 5];
    const option = web3.utils.fromAscii('option');

    it('checking deployment of a plaintext proposal contract', async () => {
      await this.verifier.addTemplate(
        //1,
        new BN(1),
        'plaintext',
        emptyAddr,
        NonExecutableType,
        ratio('0.4'),
        ratio('0.6'),
        [0, 1, 2, 3, 4],
        120,
        1200,
        0,
        60
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('0.6'),
          0,
          120,
          1201,
          this.verifier.address
        ),
        'voting duration too long'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('0.6'),
          0,
          119,
          1201,
          this.verifier.address
        ),
        'voting duration too short'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('0.6'),
          61,
          119,
          1201,
          this.verifier.address
        ),
        'voting duration too short'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('0.6'),
          0,
          501,
          500,
          this.verifier.address
        ),
        'min end greater than max end'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.399'),
          ratio('0.6'),
          0,
          501,
          500,
          this.verifier.address
        ),
        'min end greater than max end'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('1.01'),
          ratio('0.6'),
          0,
          501,
          500,
          this.verifier.address
        ),
        'min end greater than max end'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('0.599'),
          60,
          120,
          1200,
          this.verifier.address
        ),
        'quorum too small'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.4'),
          ratio('1.01'),
          60,
          120,
          1200,
          this.verifier.address
        ),
        'quorum bigger than 100%'
      );

      await expectRevert(
        PlainTextProposal.new(
          'plaintext',
          'plaintext-descr',
          [option],
          ratio('0.3'),
          ratio('0.6'),
          60,
          120,
          1200,
          this.verifier.address
        ),
        'turn out too small'
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.4'),
        ratio('0.6'),
        60,
        120,
        1200,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.4'),
        ratio('0.6'),
        0,
        1200,
        1200,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.4'),
        ratio('0.6'),
        0,
        120,
        120,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.4'),
        ratio('0.6'),
        0,
        120,
        1200,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('1.0'),
        ratio('0.6'),
        0,
        120,
        1200,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.5'),
        ratio('0.6'),
        30,
        121,
        1199,
        this.verifier.address
      );

      await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.5'),
        ratio('0.8'),
        30,
        121,
        1199,
        this.verifier.address
      );
    });

    it('checking creation of a plaintext proposal', async () => {
      const pType = new BN(1);
      const now = await time.latest();

      await this.verifier.addTemplate(
        pType,
        'plaintext',
        emptyAddr,
        NonExecutableType,
        ratio('0.4'),
        ratio('0.6'),
        [0, 1, 2, 3, 4],
        120,
        1200,
        0,
        60
      );

      const emptyOptions = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [],
        ratio('0.5'),
        ratio('0.6'),
        30,
        121,
        1199,
        this.verifier.address
      );

      const tooManyOptions = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option
        ],
        ratio('0.5'),
        ratio('0.6'),
        30,
        121,
        1199,
        this.verifier.address
      );
      const wrongVotes = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.3'),
        ratio('0.6'),
        30,
        121,
        1199,
        emptyAddr
      );
      const manyOptions = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option,
          option
        ],
        ratio('0.5'),
        ratio('0.6'),
        30,
        121,
        1199,
        this.verifier.address
      );
      const oneOption = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.51'),
        ratio('0.6'),
        30,
        122,
        1198,
        this.verifier.address
      );

      await expectRevert(
        this.gov.createProposal(emptyOptions.address, {
          value: this.proposalFee
        }),
        'proposal options are empty - nothing to vote for'
      );

      await expectRevert(
        this.gov.createProposal(tooManyOptions.address, {
          value: this.proposalFee
        }),
        'too many options'
      );

      await expectRevert(
        this.gov.createProposal(wrongVotes.address, {
          value: this.proposalFee
        }),
        'turn out too small'
      );
      await expectRevert(
        this.gov.createProposal(manyOptions.address),
        'paid proposal fee is wrong'
      );
      await expectRevert(
        this.gov.createProposal(manyOptions.address, {
          value: this.proposalFee.add(new BN(1))
        }),
        'paid proposal fee is wrong'
      );

      await this.gov.createProposal(manyOptions.address, {
        value: this.proposalFee
      });
      await this.gov.createProposal(oneOption.address, {
        value: this.proposalFee
      });

      const infoManyOptions = await this.gov.proposalParams(1);
      expect(infoManyOptions.pType).to.be.bignumber.equal(pType);
      expect(infoManyOptions.executable).to.be.bignumber.equal(
        NonExecutableType
      );
      expect(infoManyOptions.minVotes).to.be.bignumber.equal(ratio('0.5'));
      expect(infoManyOptions.minAgreement).to.be.bignumber.equal(ratio('0.6'));
      expect(infoManyOptions.proposalContract).to.equal(manyOptions.address);
      expect(infoManyOptions.options.length).to.equal(10);
      expect(infoManyOptions.options[0]).to.equal(
        '0x6f7074696f6e0000000000000000000000000000000000000000000000000000'
      );
      expect(infoManyOptions.votingStartTime).to.be.bignumber.least(now);
      expect(infoManyOptions.votingMinEndTime).to.be.bignumber.equal(
        infoManyOptions.votingStartTime.add(new BN(121))
      );
      expect(infoManyOptions.votingMaxEndTime).to.be.bignumber.equal(
        infoManyOptions.votingStartTime.add(new BN(1199))
      );
      //console.log(infoManyOptions.minAgreement.toString());

      const infoOneOption = await this.gov.proposalParams(2);
      expect(infoOneOption.pType).to.be.bignumber.equal(pType);
      expect(infoOneOption.executable).to.be.bignumber.equal(NonExecutableType);
      expect(infoOneOption.minVotes).to.be.bignumber.equal(ratio('0.51'));
      expect(infoOneOption.minAgreement).to.be.bignumber.equal(ratio('0.6'));
      expect(infoOneOption.proposalContract).to.equal(oneOption.address);
      expect(infoOneOption.options.length).to.equal(1);
      expect(infoOneOption.votingStartTime).to.be.bignumber.least(now);
      expect(infoOneOption.votingMinEndTime).to.be.bignumber.equal(
        infoOneOption.votingStartTime.add(new BN(122))
      );
      expect(infoOneOption.votingMaxEndTime).to.be.bignumber.equal(
        infoOneOption.votingStartTime.add(new BN(1198))
      );
    });

    it('checking creation with a factory', async () => {
      const pType = new BN(1);
      const plaintextFactory = await PlainTextProposalFactory.new(
        this.gov.address
      );

      await this.verifier.addTemplate(
        pType,
        'plaintext',
        plaintextFactory.address,
        NonExecutableType,
        ratio('0.4'),
        ratio('0.6'),
        [0, 1, 2, 3, 4],
        120,
        1200,
        30,
        30
      );

      await plaintextFactory.create(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.4'),
        ratio('0.6'),
        30,
        120,
        1200,
        { from: otherAcc, value: this.proposalFee }
      );

      const proposalID = await this.gov.lastProposalID();
      const proposalParams = await this.gov.proposalParams(proposalID);
      const proposal = await PlainTextProposal.at(
        proposalParams.proposalContract
      );

      expect(await proposal.owner()).to.equal(otherAcc);
      expect(await proposal.name()).to.equal('plaintext');
      expect(await proposal.description()).to.equal('plaintext-descr');

      const externalProposal = await PlainTextProposal.new(
        'plaintext',
        'plaintext-descr',
        [option],
        ratio('0.5'),
        ratio('0.6'),
        30,
        121,
        1199,
        this.verifier.address
      );

      /* await this.gov.createProposal(externalProposal.address, {
        value: this.proposalFee
      }); */

      await expectRevert(
        this.gov.createProposal(externalProposal.address, {
          value: this.proposalFee
        }),
        'proposal contract failed verification'
      );
    });
  }
);
