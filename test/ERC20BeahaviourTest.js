const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
//for testing ERC20 permit function
const { EIP712Domain, domainSeparator } = require('./eip712');

const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

const MockShareToken = artifacts.require("MockShareToken");
const ERC20Wrapper = artifacts.require("ERC20Wrapper");
const MockCash = artifacts.require("MockCash");
const AugurFoundry = artifacts.require("AugurFoundry");

contract("Wrapper Behaves Like an ERC20", function (accounts) {
  const [initialHolder, recipient, spender, anotherAccount, mockAugur, mockTrustedForwarder] = accounts;
  const tokenId = 1;
  const decimals = 16;
  const uri = "";
  const name = "test";
  const symbol = "TST";
  const initialSupply = new BN(1000);
  const version = '1'; //ERC20 Permit related

  beforeEach(async function () {
    //create a new MockShareToken
    this.mockShareToken = await MockShareToken.new(uri, ZERO_ADDRESS);
    //create mockCash token
    this.mockCash = await MockCash.new();

    //deploy the augur foundry contract
    //We should deploy a mock augur foundry instead if we want to do the unit tests
    this.augurFoundry = await AugurFoundry.new(
      this.mockShareToken.address,
      this.mockCash.address,
      mockAugur,
      mockTrustedForwarder
    ); //no need to add cash address to test this functionalities

    //Create a new erc20 wrapper for a tokenId of the shareTOken
    await this.augurFoundry.newERC20Wrapper(tokenId, name, symbol, decimals);
    let erc20WrapperAddress = await this.augurFoundry.wrappers(tokenId);

    this.token = await ERC20Wrapper.at(erc20WrapperAddress);

    //mint initialHolder some ERC1155 of tokenId
    await this.mockShareToken.mint(initialHolder, tokenId, initialSupply);
    //mint some ERC20s
    await this.mockShareToken.setApprovalForAll(this.token.address, true, {
      from: initialHolder,
    });
    await this.token.wrapTokens(initialHolder, initialSupply, {
      from: initialHolder,
    });
    // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
    // from within the EVM as from the JSON RPC interface.
    // See https://github.com/trufflesuite/ganache-core/issues/515
    // this.chainId = this.token.getChainId();
    this.chainId = "1";
  });
  it("has a name", async function () {
    expect(await this.token.name()).to.equal(name);
  });
  it("has a symbol", async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it("has  decimals", async function () {
    expect(await this.token.decimals()).to.be.bignumber.equal(
      decimals.toString()
    );
  });
  describe("total supply", function () {
    it("returns the total amount of tokens", async function () {
      expect(await this.token.totalSupply()).to.be.bignumber.equal(
        initialSupply
      );
    });
  });

  describe("balanceOf", function () {
    describe("when the requested account has no tokens", function () {
      it("returns zero", async function () {
        expect(
          await this.token.balanceOf(anotherAccount)
        ).to.be.bignumber.equal("0");
      });
    });

    describe("when the requested account has some tokens", function () {
      it("returns the total amount of tokens", async function () {
        expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(
          initialSupply
        );
      });
    });
  });
  describe("transfer", function () {
    shouldBehaveLikeERC20Transfer(
      initialHolder,
      recipient,
      initialSupply,
      function (from, to, value) {
        return this.token.transfer(to, value, { from });
      }
    );
  });
  describe("transfer from", function () {
    const spender = recipient;

    describe("when the token owner is not the zero address", function () {
      const tokenOwner = initialHolder;

      describe("when the recipient is not the zero address", function () {
        const to = anotherAccount;

        describe("when the spender has enough approved balance", function () {
          var receipet;
          beforeEach(async function () {
            receipet = await this.token.approve(spender, initialSupply, {
              from: initialHolder,
            });
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("transfers the requested amount", async function () {
              await this.token.transferFrom(tokenOwner, to, amount, {
                from: spender,
              });

              expect(
                await this.token.balanceOf(tokenOwner)
              ).to.be.bignumber.equal("0");

              expect(await this.token.balanceOf(to)).to.be.bignumber.equal(
                amount
              );
            });

            it("decreases the spender allowance", async function () {
              await this.token.transferFrom(tokenOwner, to, amount, {
                from: spender,
              });

              expect(
                await this.token.allowance(tokenOwner, spender)
              ).to.be.bignumber.equal("0");
            });

            it("emits a transfer event", async function () {
              const { logs } = await this.token.transferFrom(
                tokenOwner,
                to,
                amount,
                { from: spender }
              );

              expectEvent.inLogs(logs, "Transfer", {
                from: tokenOwner,
                to: to,
                value: amount,
              });
            });

            it("emits an approval event", async function () {
              expectEvent.inLogs(receipet.logs, "Approval", {
                owner: tokenOwner,
                spender: spender,
                value: await this.token.allowance(tokenOwner, spender),
              });
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                "ERC20: transfer amount exceeds balance"
              );
            });
          });
        });

        describe("when the spender does not have enough approved balance", function () {
          beforeEach(async function () {
            await this.token.approve(spender, initialSupply.subn(1), {
              from: tokenOwner,
            });
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                "ERC20: transfer amount exceeds allowance"
              );
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply.addn(1);

            it("reverts", async function () {
              await expectRevert(
                this.token.transferFrom(tokenOwner, to, amount, {
                  from: spender,
                }),
                "ERC20: transfer amount exceeds balance"
              );
            });
          });
        });
      });

      describe("when the recipient is the zero address", function () {
        const amount = initialSupply;
        const to = ZERO_ADDRESS;

        beforeEach(async function () {
          await this.token.approve(spender, amount, { from: tokenOwner });
        });

        it("reverts", async function () {
          await expectRevert(
            this.token.transferFrom(tokenOwner, to, amount, { from: spender }),
            `ERC20: transfer to the zero address`
          );
        });
      });
    });

    describe("when the token owner is the zero address", function () {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;
      const to = recipient;

      it("reverts", async function () {
        await expectRevert(
          this.token.transferFrom(tokenOwner, to, amount, { from: spender }),
          `ERC20: transfer from the zero address`
        );
      });
    });
  });
  describe("approve", function () {
    shouldBehaveLikeERC20Approve(
      initialHolder,
      recipient,
      initialSupply,
      function (owner, spender, amount) {
        return this.token.approve(spender, amount, { from: owner });
      }
    );
  });

  describe("permit", function () {
    it('initial nonce is 0', async function () {
      expect(await this.token.nonces(initialHolder)).to.be.bignumber.equal('0');
    });
    it('domain separator', async function () {
      expect(
        await this.token.DOMAIN_SEPARATOR(),
      ).to.equal(
        await domainSeparator(name, version, this.chainId, this.token.address),
      );
    });

    describe('permit', function () {
      const wallet = Wallet.generate();

      const owner = wallet.getAddressString();
      const value = new BN(42);
      const nonce = 0;
      const maxDeadline = MAX_UINT256;

      const buildData = (chainId, verifyingContract, deadline = maxDeadline) => ({
        primaryType: 'Permit',
        types: { EIP712Domain, Permit },
        domain: { name, version, chainId, verifyingContract },
        message: { owner, spender, value, nonce, deadline },
      });

      it('accepts owner signature', async function () {
        const data = buildData(this.chainId, this.token.address);
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        const receipt = await this.token.permit(owner, spender, value, maxDeadline, v, r, s);

        expect(await this.token.nonces(owner)).to.be.bignumber.equal('1');
        expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(value);
      });

      it('rejects reused signature', async function () {
        const data = buildData(this.chainId, this.token.address);
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        await this.token.permit(owner, spender, value, maxDeadline, v, r, s);

        await expectRevert(
          this.token.permit(owner, spender, value, maxDeadline, v, r, s),
          'ERC20Permit: invalid signature',
        );
      });

      it('rejects other signature', async function () {
        const otherWallet = Wallet.generate();
        const data = buildData(this.chainId, this.token.address);
        const signature = ethSigUtil.signTypedMessage(otherWallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        await expectRevert(
          this.token.permit(owner, spender, value, maxDeadline, v, r, s),
          'ERC20Permit: invalid signature',
        );
      });

      it('rejects expired permit', async function () {
        const deadline = (await time.latest()) - time.duration.weeks(1);

        const data = buildData(this.chainId, this.token.address, deadline);
        const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
        const { v, r, s } = fromRpcSig(signature);

        await expectRevert(
          this.token.permit(owner, spender, value, deadline, v, r, s),
          'ERC20Permit: expired deadline',
        );
      });
    });
  });

  function shouldBehaveLikeERC20Transfer(from, to, balance, transfer) {
    describe("when the recipient is not the zero address", function () {
      describe("when the sender does not have enough balance", function () {
        const amount = balance.addn(1);

        it("reverts", async function () {
          //Becuase we assert that underflow does not happen instead of throwing an error
          await expectRevert(
            transfer.call(this, from, to, amount),
            "ERC20: transfer amount exceeds balance"
          );
        });
      });

      describe("when the sender transfers all balance", function () {
        const amount = balance;

        it("transfers the requested amount", async function () {
          await transfer.call(this, from, to, amount);

          expect(await this.token.balanceOf(from)).to.be.bignumber.equal("0");

          expect(await this.token.balanceOf(to)).to.be.bignumber.equal(amount);
        });

        it("emits a transfer event", async function () {
          const { logs } = await transfer.call(this, from, to, amount);

          expectEvent.inLogs(logs, "Transfer", {
            from,
            to,
            value: amount,
          });
        });
      });

      describe("when the sender transfers zero tokens", function () {
        const amount = new BN("0");

        it("transfers the requested amount", async function () {
          await transfer.call(this, from, to, amount);

          expect(await this.token.balanceOf(from)).to.be.bignumber.equal(
            balance
          );

          expect(await this.token.balanceOf(to)).to.be.bignumber.equal("0");
        });

        it("emits a transfer event", async function () {
          const { logs } = await transfer.call(this, from, to, amount);

          expectEvent.inLogs(logs, "Transfer", {
            from,
            to,
            value: amount,
          });
        });
      });
    });

    describe("when the recipient is the zero address", function () {
      it("reverts", async function () {
        await expectRevert(
          transfer.call(this, from, ZERO_ADDRESS, balance),
          `ERC20: transfer to the zero address`
        );
      });
    });
  }
  function shouldBehaveLikeERC20Approve(owner, spender, supply, approve) {
    describe("when the spender is not the zero address", function () {
      describe("when the sender has enough balance", function () {
        const amount = supply;

        it("emits an approval event", async function () {
          const { logs } = await approve.call(this, owner, spender, amount);

          expectEvent.inLogs(logs, "Approval", {
            owner: owner,
            spender: spender,
            value: amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await approve.call(this, owner, spender, amount);

            expect(
              await this.token.allowance(owner, spender)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await approve.call(this, owner, spender, new BN(1));
          });

          it("approves the requested amount and replaces the previous one", async function () {
            // To change the approve amount you first have to reduce the addresses`
            //  allowance to zero by calling `approve(_spender, 0)` if it is not
            //  already 0 to mitigate the race condition described here:
            //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

            await approve.call(this, owner, spender, 0);
            await approve.call(this, owner, spender, amount);

            expect(
              await this.token.allowance(owner, spender)
            ).to.be.bignumber.equal(amount);
          });
        });
      });

      describe("when the sender does not have enough balance", function () {
        const amount = supply.addn(1);

        it("emits an approval event", async function () {
          const { logs } = await approve.call(this, owner, spender, amount);

          expectEvent.inLogs(logs, "Approval", {
            owner: owner,
            spender: spender,
            value: amount,
          });
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await approve.call(this, owner, spender, amount);

            expect(
              await this.token.allowance(owner, spender)
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await approve.call(this, owner, spender, new BN(1));
          });

          it("approves the requested amount and replaces the previous one", async function () {
            // To change the approve amount you first have to reduce the addresses`
            //  allowance to zero by calling `approve(_spender, 0)` if it is not
            //  already 0 to mitigate the race condition described here:
            //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729

            await approve.call(this, owner, spender, 0);
            await approve.call(this, owner, spender, amount);

            expect(
              await this.token.allowance(owner, spender)
            ).to.be.bignumber.equal(amount);
          });
        });
      });
    });

    describe("when the spender is the zero address", function () {
      it("reverts", async function () {
        await expectRevert(
          approve.call(this, owner, ZERO_ADDRESS, supply),
          `ERC20: approve to the zero address`
        );
      });
    });
  }


});
