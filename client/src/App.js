import React, { PureComponent } from 'react';

import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Col from 'react-bootstrap/Col';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover from 'react-bootstrap/Popover';
import { Modal, Tooltip } from 'react-bootstrap';

import metaMaskStore from './components/metaMask';
import { BN, constants } from '@openzeppelin/test-helpers';
import NumberFormat from 'react-number-format';

import markets from './configs/markets/markets-mainnet';
import contracts from './configs/contracts.json';
import environment from './configs/environments/environment-mainnet.json';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { notification } from 'antd';
import 'antd/dist/antd.css';
export default class App extends PureComponent {
    constructor(props) {
        super(props);
        this.mintDaiForm = this.mintDaiForm.bind(this);
        this.setMarket = this.setMarket.bind(this);
        this.onModalSubmit = this.onModalSubmit.bind(this);
        this.showToolTip = this.showToolTip.bind(this);
        this.hideToolTip = this.hideToolTip.bind(this);
        //this.parseDate = this.parseDate.bind(this);
        this.state = {
            web3Provider: {
                web3: null,
                metaMaskInstalled: false,
                isLogin: false,
                netWorkId: 0,
                accounts: [],
            },
            listData: null,
            show: false,
            isWrapping: true,
            marketId: null,
            yesAmount: 0,
            noAmount: 0,
            invalidAmount: 0,
            selectedMarket: null,
            isShowPools: false,
            isShowToolTip: false,
        };
    }

    componentWillMount() {
        metaMaskStore.checkWeb3(true);
        metaMaskStore.on(
            'META_MASK_CONNECTED',
            this.metaMaskConnected.bind(this)
        );
        metaMaskStore.on(
            'META_MASK_ADDRESS_CHANGED',
            this.metaAddressChange.bind(this)
        );
        metaMaskStore.on(
            'META_MASK_NETWORK_CHANGED',
            this.metaNetwrokChange.bind(this)
        );
    }
    componentWillUnmount() {
        metaMaskStore.removeListener(
            'META_MASK_CONNECTED',
            this.metaMaskConnected.bind(this)
        );
        metaMaskStore.removeListener(
            'META_MASK_ADDRESS_CHANGED',
            this.metaAddressChange.bind(this)
        );
        metaMaskStore.removeListener(
            'META_MASK_NETWORK_CHANGED',
            this.metaNetwrokChange.bind(this)
        );
    }

    setMarket(e) {
        if (e.target.value == 0) {
            this.setState({ selectedMarket: null });
        } else {
            let currentMarket = markets.find(
                (item) => item.address === e.target.value
            );
            this.setState({
                selectedMarket: currentMarket,
            });
        }
    }

    // parseDate(params) {
    //   let unix_timestamp = parseInt(params);
    //   let a = new Date(unix_timestamp * 1000);
    //   let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    //   let year = a.getFullYear();
    //   let month = months[a.getMonth()];
    //   let date = a.getDate();
    //   let time = date + ' ' + month + ' ' + year;
    //   return time;
    // }

    metaMaskConnected() {
        this.setState({ web3Provider: metaMaskStore.getWeb3() }, () => {
            this.initData();
        });
    }

    metaAddressChange() {
        this.setState({ web3Provider: metaMaskStore.getWeb3() }, () => {
            this.initData();
        });
    }

    metaNetwrokChange() {
        this.setState({ web3Provider: metaMaskStore.getWeb3() }, () => {
            // this.initData();
        });
    }

    async initData() {
        console.log('initData');
        // notification.open({
        //   message: "Please Wait",
        // });

        const { web3 } = this.state.web3Provider;

        let chainId = await web3.eth.net.getId();
        console.log('chainId: ' + chainId);

        if (chainId !== 1) {
            this.openNotification(
                'error',
                'Wrong Network',
                'Please connect to Ethereum mainnet'
            );
            return;
        }

        const OUTCOMES = { INVALID: 0, NO: 1, YES: 2 };

        const cash = new web3.eth.Contract(
            contracts.contracts['Cash.sol'].Cash.abi,
            environment.addresses.Cash
        );
        const erc20 = new web3.eth.Contract(
            contracts.contracts['Cash.sol'].Cash.abi
        );

        const shareToken = new web3.eth.Contract(
            contracts.contracts['reporting/ShareToken.sol'].ShareToken.abi,
            environment.addresses.ShareToken
        );

        const market = new web3.eth.Contract(
            contracts.contracts['reporting/Market.sol'].Market.abi
        );

        const augurFoundry = new web3.eth.Contract(
            contracts.contracts['AugurFoundry.sol'].AugurFoundry.abi,
            markets[0].augurFoundryAddress
        );

        const universe = new web3.eth.Contract(
            contracts.contracts['reporting/Universe.sol'].Universe.abi,
            environment.addresses.Universe
        );

        const augur = new web3.eth.Contract(
            contracts.contracts['Augur.sol'].Augur.abi,
            environment.addresses.Augur
        );
        const erc20Wrapper = new web3.eth.Contract(
            contracts.contracts['ERC20Wrapper.sol'].ERC20Wrapper.abi
        );
        let totalOIWei = new BN(
            await universe.methods.getOpenInterestInAttoCash().call()
        );

        // let totalOIEth = web3.utils.fromWei(totalOIWei);
        // //This is a hack for precision when dealing with bignumber
        // let n = totalOIEth.indexOf(".");
        // let totalOI = totalOIEth.substring(0, n != -1 ? n + 3 : totalOIEth.length);
        console.log(web3.utils.fromWei(totalOIWei).toString());
        let foundryTVLWei = new BN(0);
        for (let i = 0; i < markets.length; i++) {
            market.options.address = markets[i].address;
            foundryTVLWei = foundryTVLWei.add(
                new BN(await market.methods.getOpenInterest().call())
            );
        }
        let foundryTVLEth = web3.utils.fromWei(foundryTVLWei);
        //This is a hack for precision when dealing with bignumber
        let n = foundryTVLEth.indexOf('.');
        let foundryTVL = foundryTVLEth.substring(
            0,
            n !== -1 ? n + 3 : foundryTVLEth.length
        );
        let foundryPecentageWei = foundryTVLWei
            .mul(new BN(10).pow(new BN(20)))
            .div(totalOIWei);

        let foundryPecentageEth = web3.utils.fromWei(foundryPecentageWei);
        //This is a hack for precision when dealing with bignumber
        n = foundryPecentageEth.indexOf('.');
        let foundryPecentage = foundryPecentageEth.substring(
            0,
            n !== -1 ? n + 3 : foundryPecentageEth.length
        );

        this.setState(
            {
                cash: cash,
                shareToken: shareToken,
                market: market,
                universe: universe,
                augur: augur,
                augurFoundry: augurFoundry,
                erc20: erc20,
                erc20Wrapper: erc20Wrapper,
                OUTCOMES: OUTCOMES,
                tokenIds: null,
                // totalOI: totalOI,
                foundryTVL: foundryTVL,
                foundryPecentage: foundryPecentage.toString(),
                chainId: chainId,
            },
            () => {
                this.invetoryInit();
            }
        );
        // notification.destroy();
    }
    showModal = async (marketAddress, isWrapping, balances, outcomeNames) => {
        const { web3 } = this.state.web3Provider;
        const { markets } = this.state;
        console.log('showModal');

        const tokenIds = await this.getTokenIds(marketAddress);

        let defaultInputAmounts = [];
        let inputAmountKeys = [];

        let someData = [];
        for (let i = 0; i < tokenIds.length; i++) {
            defaultInputAmounts.push(web3.utils.fromWei(balances[i]));
            inputAmountKeys.push('inputAmount' + i);

            someData.push(
                <Row
                    className="justify-content-md-center"
                    style={
                        i === 0
                            ? { marginTop: '1em' }
                            : {} /* apply margin-top to only the first row so that there is some space between the top of the modal and the first row */
                    }
                >
                    <Col md="auto">
                        <Form.Group
                            controlId={'inputAmountModal.ControlInput' + i}
                        >
                            <Form.Label style={{ color: '#040404' }}>
                                {outcomeNames[i]}:&nbsp;
                            </Form.Label>
                            <Form.Control
                                type="text"
                                name={'inputAmount' + i}
                                placeholder={
                                    'Amount of ' + outcomeNames[i] + ' Shares'
                                }
                                defaultValue={web3.utils.fromWei(balances[i])}
                                onChange={this.handleChange}
                                style={{ display: 'inline' }}
                            />
                        </Form.Group>
                    </Col>
                </Row>
            );
        }

        this.setState({
            marketAddress: marketAddress,
            isWrapping: isWrapping,
            someData: someData,
            show: true,
        });
    };

    hideModal = () => {
        this.setState({ show: false });
    };

    hidePoolsModal = () => {
        this.setState({ isShowPools: false });
    };

    showPoolsModal = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isShowPools: true });
    };

    async invetoryInit() {
        const { web3 } = this.state.web3Provider;
        const { OUTCOMES, erc20, show, chainId } = this.state;
        let listData = [];
        // let yesTokenAddresses = [];
        // let noTokenAddress = [];
        // console.log(markets);
        this.openNotification('info', 'Updating Markets...', '', 5);
        for (let x = 0; x < markets.length; x++) {
            // for (let x = 0; x < 1; x++) {
            // for (let x = markets.length - 1; x < markets.length; x++) {
            // let x = 0;
            const wrappedBalances = await this.getBalancesMarketERC20(
                markets[x].address
            );

            const tokenAddresses = await this.getTokenAddresses(
                markets[x].address
            );

            let decimals = new BN(15);
            let multiplier = new BN(3);

            // if (chainId == 42) {
            //     multiplier = new BN(2)
            // }
            for (let i = 0; i < wrappedBalances.length; i++) {
                wrappedBalances[i] = wrappedBalances[i].mul(
                    new BN(10).pow(multiplier)
                );
            }
            // wrappedBalances.invalidTokenBalance = wrappedBalances.invalidTokenBalance.mul(
            //     new BN(10).pow(multiplier)
            // )
            // wrappedBalances.yesTokenBalance = wrappedBalances.yesTokenBalance.mul(
            //     new BN(10).pow(multiplier)
            // )
            // wrappedBalances.noTokenBalance = wrappedBalances.noTokenBalance.mul(
            //     new BN(10).pow(multiplier)
            // )

            let shareTokenBalances = await this.getBalancesMarketShareToken(
                markets[x].address
            );
            let isMoreThanZeroShares = await this.checkIfMoreThanZeroShares(
                shareTokenBalances
            );
            let isMoreThanZeroERC20s = await this.checkIfMoreThanZeroERC20s(
                wrappedBalances
            );
            let marketFinalized = await this.isMarketFinalized(
                markets[x].address
            );

            let erc20Symbols = await this.getERC20Symbols(markets[x].address);
            // console.log(isMoreThanZeroShares);
            // console.log(isMoreThanZeroERC20s);
            // console.log(x);
            let isMarketsToBeDisplayed =
                isMoreThanZeroERC20s || isMoreThanZeroShares;
            console.log('displayOfMarket', x, isMarketsToBeDisplayed);

            const outcomeNames = markets[x].outcomeStrings;
            if (isMarketsToBeDisplayed) {
                // if (true) {
                listData.push(
                    <tr>
                        <OverlayTrigger
                            placement="right"
                            overlay={this.showMarketInfoOnHover(x)}
                        >
                            <td
                            // onMouseEnter={() => this.showMarketInfoOnHover(x, true)}
                            // onMouseLeave={() => this.showMarketInfoOnHover(x, false)}
                            >
                                {markets[x].extraInfo.description}
                            </td>
                        </OverlayTrigger>
                        <td>
                            {outcomeNames.map((outcomeName, index) => (
                                <span key={`${outcomeName}-${index}`}>
                                    {outcomeName}:{' '}
                                    {web3.utils
                                        .fromWei(shareTokenBalances[index])
                                        .toString()}
                                    <br />
                                </span>
                            ))}
                        </td>
                        <td>
                            {erc20Symbols.map((erc20Symbol, index) => (
                                <span key={`${erc20Symbol}-${index}`}>
                                    {erc20Symbol}:{' '}
                                    {web3.utils
                                        .fromWei(wrappedBalances[index])
                                        .toString()}{' '}
                                    (
                                    <span
                                        style={{
                                            color: '#ffd790',
                                            cursor: 'pointer',
                                        }}
                                        onClick={async (event) =>
                                            this.addTokenToMetamask(
                                                tokenAddresses[index],
                                                x, //market index
                                                index //outcome array index (would be same as other indexes)
                                            )
                                        }
                                    >
                                        Show in wallet
                                    </span>
                                    )
                                    <br />
                                </span>
                            ))}
                        </td>

                        <td>
                            {isMoreThanZeroShares || isMoreThanZeroERC20s ? (
                                marketFinalized ? (
                                    <span>
                                        <Button
                                            variant="secondary"
                                            className="m-left"
                                            type="submit"
                                            onClick={(e) =>
                                                this.claimWinningsWhenWrapped(
                                                    markets[x].address
                                                )
                                            }
                                        >
                                            REDEEM DAI
                                        </Button>
                                    </span>
                                ) : isMoreThanZeroShares &&
                                    isMoreThanZeroERC20s ? (
                                            <span>
                                                <Button
                                                    variant="success"
                                                    className="m-left"
                                                    type="submit"
                                                    onClick={(e) =>
                                                        this.showModal(
                                                            markets[x].address,
                                                            false,
                                                            wrappedBalances,
                                                            outcomeNames
                                                        )
                                                    }
                                                >
                                                    UNWRAP
                                        </Button>
                                                <Button
                                                    variant="danger"
                                                    type="submit"
                                                    onClick={(e) =>
                                                        this.showModal(
                                                            markets[x].address,
                                                            true,
                                                            shareTokenBalances,
                                                            outcomeNames
                                                        )
                                                    }
                                                >
                                                    WRAP SHARES
                                        </Button>

                                                <Button
                                                    variant="secondary"
                                                    className="m-left"
                                                    type="submit"
                                                    onClick={(e) =>
                                                        this.redeemDAI(
                                                            markets[x].address
                                                        )
                                                    }
                                                >
                                                    REDEEM DAI
                                        </Button>
                                            </span>
                                        ) : isMoreThanZeroERC20s ? (
                                            <Button
                                                variant="success"
                                                type="submit"
                                                onClick={(e) =>
                                                    this.showModal(
                                                        markets[x].address,
                                                        false,
                                                        wrappedBalances,
                                                        outcomeNames
                                                    )
                                                }
                                            >
                                                UNWRAP
                                            </Button>
                                        ) : (
                                                <span>
                                                    <Button
                                                        variant="danger"
                                                        type="submit"
                                                        onClick={(e) =>
                                                            this.showModal(
                                                                markets[x].address,
                                                                true,
                                                                shareTokenBalances,
                                                                outcomeNames
                                                            )
                                                        }
                                                    >
                                                        WRAP SHARES
                                        </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="m-left"
                                                        type="submit"
                                                        onClick={(e) =>
                                                            this.redeemDAI(
                                                                markets[x].address,
                                                                true
                                                            )
                                                        }
                                                    >
                                                        REDEEM DAI
                                        </Button>
                                                </span>
                                            )
                            ) : (
                                    <span></span>
                                )}
                        </td>
                    </tr>
                );
            }
        }
        //console.log(listData)
        this.setState({ listData: listData });
    }

    async addTokenToMetamask(tokenAddress, index, outcome) {
        const { erc20 } = this.state;
        erc20.options.address = tokenAddress;

        let tokenSymbol = await erc20.methods.symbol().call();

        let decimals = await erc20.methods.decimals().call();
        let tokenImage = markets[index].tokenIcons[outcome];

        const provider = window.ethereum;
        provider.sendAsync(
            {
                method: 'metamask_watchAsset',
                params: {
                    type: 'ERC20',
                    options: {
                        address: tokenAddress,
                        symbol: tokenSymbol,
                        decimals: decimals,
                        image: tokenImage,
                    },
                },
                id: Math.round(Math.random() * 100000),
            },
            (err, added) => {
                console.log('provider returned', err, added);
                if (err || 'error' in added) {
                    // this.setState({
                    //   errorMessage: "There was a problem adding the token.",
                    //   message: "",
                    // });
                    this.openNotification(
                        'error',
                        'There was an error in adding the custom token in metamask',
                        ''
                    );
                    return;
                }
                // this.setState({
                //   message: "Token added!",
                //   errorMessage: "",
                // });
                console.log('suceesfull');
            }
        );
    }

    async mintDaiForm(e) {
        e.preventDefault();
        const { web3, accounts } = this.state.web3Provider;

        const { cash, shareToken, market, augur } = this.state;

        const marketAddress = e.target.elements.marketIds.value;
        //Here the amount is the amoun of DAI users wants to spend to buy shares
        let amount = e.target.elements.amount.value;

        // const daiBalance = await daiInstance.methods.balanceOf(accounts[0]).call();

        //NOTE : remove inconsitencies in new BN
        if (web3.utils.isAddress(marketAddress) && amount) {
            let weiAmount = web3.utils.toWei(amount);
            weiAmount = new BN(weiAmount);
            market.options.address = marketAddress;
            let balance = new BN(
                await cash.methods.balanceOf(accounts[0]).call()
            );
            let numTicks = new BN(await market.methods.getNumTicks().call());
            console.log('numTicks: ' + numTicks);

            let amountOfShareToBuy = weiAmount.div(numTicks);
            // console.log(web3.utils.fromWei(amountOfShareToBuy));

            //user is inouting how much DAI they want to spend
            //They should have more than they want to spend
            if (weiAmount.cmp(balance) == 1) {
                //weiAmount > balance
                //await Promise.reject(new Error("Not Enough balance to buy complete sets"));
                this.openNotification('error', 'Not Enough DAI Balance', '');
                return;
            }

            let allowance = new BN(
                await cash.methods
                    .allowance(accounts[0], augur.options.address)
                    .call()
            );

            if (weiAmount.cmp(allowance) == 1) {
                console.log('allowance');
                this.openNotification(
                    'info',
                    'Approve your DAI to before minting new shares',
                    'This is one time transaction'
                );
                cash.methods
                    .approve(
                        augur.options.address,
                        constants.MAX_UINT256.toString()
                    )
                    .send({ from: accounts[0] })
                    .on('receipt', (receipt) => {
                        console.log('Before buy complete sets');
                        this.openNotification(
                            'info',
                            'Approval Successfull',
                            'Now we can mint shares for you'
                        );
                        this.openNotification('info', 'Minting shares', '');
                        shareToken.methods
                            .buyCompleteSets(
                                marketAddress,
                                accounts[0],
                                amountOfShareToBuy.toString()
                            )
                            .send({ from: accounts[0] })
                            .on('receipt', (receipt) => {
                                this.openNotification(
                                    'success',
                                    'Shares minted successfully',
                                    ''
                                );
                                this.initData();
                            })
                            .on('error', (error) => {
                                if (
                                    error.message.includes(
                                        'User denied transaction signature'
                                    )
                                ) {
                                    this.openNotification(
                                        'error',
                                        'User denied signature',
                                        'sign the transaction to be able to execute the transaction'
                                    );
                                } else {
                                    this.openNotification(
                                        'error',
                                        'There was an error in executing the transaction',
                                        ''
                                    );
                                }
                            });
                    })
                    .on('error', (error) => {
                        if (
                            error.message.includes(
                                'User denied transaction signature'
                            )
                        ) {
                            this.openNotification(
                                'error',
                                'User denied signature',
                                'sign the transaction to be able to execute the transaction'
                            );
                        } else {
                            this.openNotification(
                                'error',
                                'There was an error in executing the transaction',
                                ''
                            );
                        }
                    });
            } else {
                this.openNotification('info', 'Minting shares', '');
                // console.log(marketAddress);
                //buy the complete sets
                shareToken.methods
                    .buyCompleteSets(
                        marketAddress,
                        accounts[0],
                        amountOfShareToBuy.toString()
                    )
                    .send({ from: accounts[0] })
                    .on('receipt', (receipt) => {
                        this.openNotification(
                            'success',
                            'Shares minted successfully',
                            ''
                        );
                        this.initData();
                    })
                    .on('error', (error) => {
                        if (
                            error.message.includes(
                                'User denied transaction signature'
                            )
                        ) {
                            this.openNotification(
                                'error',
                                'User denied signature',
                                'sign the transaction to be able to execute the transaction'
                            );
                        } else {
                            this.openNotification(
                                'error',
                                'There was an error in executing the transaction',
                                ''
                            );
                        }
                    });
            }
        } else {
            this.openNotification(
                'error',
                'Select a Market and Enter   amount',
                ''
            );
        }

        // await this.initData();
    }
    //amounts need to be BN objects with decimals take care of
    async wrapShare(marketAddress, shareTokenAmounts) {
        // alert(marketAddress);
        if (marketAddress) {
            const { accounts } = this.state.web3Provider;
            const { shareToken, augurFoundry, OUTCOMES } = this.state;

            let isApprovedForAllToAugurFoundry = await shareToken.methods
                .isApprovedForAll(accounts[0], augurFoundry.options.address)
                .call();
            const hasEnough = await this.hasEnoughShareTokens(
                marketAddress,
                shareTokenAmounts
            );
            console.log('hasEnough', hasEnough);

            if (!hasEnough) {
                this.openNotification(
                    'error',
                    'Trying to Wrap more than you have',
                    ''
                );
                return;
            }

            let tokenIds = await this.getTokenIds(marketAddress);
            let shareTokenAmountsTobeConsidered = [];
            let tokenIdsTobeConsidered = [];

            // let tokenIds = []

            for (let i = 0; i < tokenIds.length; i++) {
                if (!shareTokenAmounts[i].isZero()) {
                    tokenIdsTobeConsidered.push(tokenIds[i]);
                    shareTokenAmountsTobeConsidered.push(
                        shareTokenAmounts[i].toString()
                    );
                }
            }
            console.log(
                'shareTokenAmountsTobeConsidered',
                shareTokenAmountsTobeConsidered
            );
            // console.log(amount);
            console.log('before Wrapping');

            if (!isApprovedForAllToAugurFoundry) {
                this.openNotification(
                    'info',
                    'Approve your share tokens to be able to wrap shares',
                    ''
                );
                await shareToken.methods
                    .setApprovalForAll(augurFoundry.options.address, true)
                    .send({ from: accounts[0] })
                    .on('receipt', (receipt) => {
                        this.openNotification(
                            'info',
                            'Approval successful',
                            'Now we can wrap shares'
                        );
                    })
                    .on('error', (error) => {
                        if (
                            error.message.includes(
                                'User denied transaction signature'
                            )
                        ) {
                            this.openNotification(
                                'error',
                                'User denied signature',
                                'sign the transaction to be able to execute the transaction'
                            );
                        } else {
                            this.openNotification(
                                'error',
                                'There was an error in executing the transaction',
                                ''
                            );
                        }
                    });
            }
            this.openNotification('info', 'Wrapping your shares', '');

            //wrapp all the tokens
            augurFoundry.methods
                .wrapMultipleTokens(
                    tokenIdsTobeConsidered,
                    accounts[0],
                    shareTokenAmountsTobeConsidered
                )
                .send({ from: accounts[0] })
                .on('receipt', (receipt) => {
                    this.openNotification('success', 'Wrapping successful', '');
                    this.initData();
                })
                .on('error', (error) => {
                    if (
                        error.message.includes(
                            'User denied transaction signature'
                        )
                    ) {
                        this.openNotification(
                            'error',
                            'User denied signature',
                            'sign the transaction to be able to execute the transaction'
                        );
                    } else {
                        this.openNotification(
                            'error',
                            'There was an error in executing the transaction',
                            ''
                        );
                    }
                });
        }
        // await this.initData();
    }
    async redeemDAI(marketAddress) {
        //check if market has finalized if it has call the claim trading proceeds
        //if not call the buy completeshares
        const { web3, accounts } = this.state.web3Provider;
        const { shareToken, augurFoundry, OUTCOMES, market } = this.state;
        if (marketAddress) {
            let isMarketFinalized = await this.isMarketFinalized(marketAddress);

            //end a market to do this
            if (isMarketFinalized) {
                console.log('claiming trading proceeds');
                //last arg is for fingerprint that has something to do with affiliate fees(NOTE: what exactly?)
                this.openNotification(
                    'info',
                    'Redeeming winning shares for DAI',
                    ' '
                );
                //Add a check that user has the complete shares
                //i.e. balanceofShareTOken for YES/NO/INVALID should be greater then zero

                shareToken.methods
                    .claimTradingProceeds(
                        marketAddress,
                        accounts[0],
                        web3.utils.fromAscii('')
                    )
                    .send({ from: accounts[0] })
                    .on('receipt', (receipt) => {
                        this.openNotification(
                            'success',
                            'DAI redeemed successfully',
                            ''
                        );
                        this.initData();
                    })
                    .on('error', (error) => {
                        if (
                            error.message.includes(
                                'User denied transaction signature'
                            )
                        ) {
                            this.openNotification(
                                'error',
                                'User denied signature',
                                'sign the transaction to be able to execute the transaction'
                            );
                        } else {
                            this.openNotification(
                                'error',
                                'There was an error in executing the transaction',
                                ''
                            );
                        }
                    });
            } else {
                // //here check the minimum of token balances

                market.options.address = marketAddress;
                const numOfOutcomes = await market.methods
                    .getNumberOfOutcomes()
                    .call(); // console.log('num of outcomes', numOfOutcomes)

                const outcomeArray = Array.from(
                    { length: numOfOutcomes },
                    (_, i) => i
                );

                let amount = new BN(
                    await shareToken.methods
                        .lowestBalanceOfMarketOutcomes(
                            marketAddress,
                            outcomeArray,
                            accounts[0]
                        )
                        .call()
                );
                // let amount = new BN()
                console.log('lowestBalance', amount.toString());
                if (amount.cmp(new BN(0)) === 0) {
                    this.openNotification(
                        'error',
                        'Not enough Balance',
                        'You need shares of every outcome(YES/NO/INVALID) to be able to redeem DAI'
                    );
                    return;
                }

                this.openNotification(
                    'info',
                    'Redeeming your shares for DAI',
                    ''
                );
                shareToken.methods
                    .sellCompleteSets(
                        marketAddress,
                        accounts[0],
                        accounts[0],
                        amount.toString(),
                        web3.utils.fromAscii('')
                    )
                    .send({ from: accounts[0] })
                    .on('receipt', (receipt) => {
                        this.openNotification(
                            'success',
                            'DAI redeemed successfully',
                            ''
                        );
                        this.initData();
                    })
                    .on('error', (error) => {
                        if (
                            error.message.includes(
                                'User denied transaction signature'
                            )
                        ) {
                            this.openNotification(
                                'error',
                                'User denied signature',
                                'sign the transaction to be able to execute the transaction'
                            );
                        } else {
                            this.openNotification(
                                'error',
                                'There was an error in executing the transaction',
                                ''
                            );
                        }
                    });
            }
        }
    } // await this.initData();
    async claimWinningsWhenWrapped(marketAddress) {
        const { web3, accounts } = this.state.web3Provider;
        const {
            shareToken,
            augurFoundry,
            market,
            OUTCOMES,
            erc20Wrapper,
        } = this.state;
        //check if the market has finalized
        market.options.address = marketAddress;
        if (await market.methods.isFinalized().call()) {
            //get the winning outcome
            let numTicks = new BN(await market.methods.getNumTicks().call());
            let tokenIds = await this.getTokenIds(marketAddress);
            const numOfOutcomes = await this.getNumberOfOutcomes(marketAddress);

            let i;
            const outcomeArray = Array.from(
                { length: numOfOutcomes },
                (_, i) => i
            );
            for (i in tokenIds) {
                // console.log("before calling winnign payout");
                const outcome = outcomeArray[i];
                let winningPayoutNumerator = new BN(
                    await market.methods
                        .getWinningPayoutNumerator(outcome)
                        .call()
                );
                // console.log("winningPayoutNumerator: " + winningPayoutNumerator);
                // console.log("numTicks: " + numTicks);
                if (winningPayoutNumerator.cmp(numTicks) == 0) {
                    // console.log("before calling q");

                    erc20Wrapper.options.address = await augurFoundry.methods
                        .wrappers(tokenIds[i])
                        .call();
                    //no claim for the user
                    // if(winningOutcome balance is zero then redeem DAI by selling ERC1155s)
                    let balanceOfWinningOutcomeWrapped = await this.getBalanceOfERC20(
                        erc20Wrapper.options.address,
                        accounts[0]
                    );
                    // console.log(balanceOfWinningOutcomeWrapped.toString());
                    if (balanceOfWinningOutcomeWrapped.cmp(new BN(0)) == 0) {
                        console.log('redeem DAI called');
                        let shareTokenBalances = await this.getBalancesMarketShareToken(
                            marketAddress
                        );
                        if (
                            await this.checkIfMoreThanZeroShares(
                                shareTokenBalances
                            )
                        ) {
                            this.redeemDAI(marketAddress);
                        } else {
                            this.openNotification(
                                'error',
                                'You do not have the winnng outcome shares',
                                ''
                            );
                        }

                        //try to sell by calling the shareToken method directly
                    } else {
                        console.log('redeem not DAI called');
                        erc20Wrapper.methods
                            .claim(accounts[0])
                            .send({ from: accounts[0] })
                            .on('receipt', (receipt) => {
                                this.openNotification(
                                    'success',
                                    'DAI redeemed successfully',
                                    ''
                                );
                                this.initData();
                            })
                            .on('error', (error) => {
                                if (
                                    error.message.includes(
                                        'User denied transaction signature'
                                    )
                                ) {
                                    this.openNotification(
                                        'error',
                                        'User denied signature',
                                        'sign the transaction to be able to execute the transaction'
                                    );
                                } else {
                                    this.openNotification(
                                        'error',
                                        'There was an error in executing the transaction',
                                        ''
                                    );
                                }
                            });
                    }
                }
            }
        }
        // await this.initData();
    }
    async getBalanceOfERC20(tokenAddress, account) {
        // console.log("getBlanecERC20" + account);
        const { erc20 } = this.state;
        erc20.options.address = tokenAddress;
        return new BN(await erc20.methods.balanceOf(account).call());
    }

    async isMarketFinalized(marketAddress) {
        const { market } = this.state;
        market.options.address = marketAddress;
        // console.log(await market.methods.isFinalized().call());
        return await market.methods.isFinalized().call();
    }
    async hasEnoughTokens(marketAddress, tokenAmounts) {
        const wrappedBalances = await this.getBalancesMarketERC20(marketAddress);
        let hasEnough = true;
        wrappedBalances.forEach((wrappedBalance, index) => {
            if (wrappedBalances[index].lt(tokenAmounts[index])) {
                hasEnough = false;
            }
        });

        return hasEnough;
    }
    async hasEnoughShareTokens(marketAddress, shareTokenAmounts) {
        const shareTokenBalances = await this.getBalancesMarketShareTokenWONumTicks(
            marketAddress
        );
        let hasEnough = true;
        shareTokenBalances.forEach((shareTokenBalance, index) => {
            if (shareTokenBalances[index].lt(shareTokenAmounts[index])) {
                hasEnough = false;
            }
        });
        return hasEnough;
    }
    //amounts need to be BN objects with decimals take care of
    async unwrapShares(marketAddress, tokenAmounts) {
        const { accounts, web3 } = this.state.web3Provider;
        const { augurFoundry, shareToken, OUTCOMES, chainId } = this.state;
        if (marketAddress) {
            // const {
            //   invalidTokenBalance,
            //   yesTokenBalance,
            //   noTokenBalance,
            // } = await this.getBalancesMarketERC20(marketAddress);

            const hasEnough = await this.hasEnoughTokens(
                marketAddress,
                tokenAmounts
            );
            console.log('hasEnough', hasEnough);
            if (!hasEnough) {
                this.openNotification(
                    'error',
                    'Trying to Unwrap more than you have',
                    ''
                );
                return;
            }

            let tokenIds = await this.getTokenIds(marketAddress);
            let tokenAmountsTobeConsidered = [];
            let tokenIdsTobeConsidered = [];

            for (let i = 0; i < tokenIds.length; i++) {
                if (!tokenAmounts[i].isZero()) {
                    tokenIdsTobeConsidered.push(tokenIds[i]);
                    tokenAmountsTobeConsidered.push(tokenAmounts[i].toString());
                }
                console.log('TokenAmounts', tokenAmounts[i].toString());
            }

            console.log(
                'tokenAmountsTobeConsidered',
                tokenAmountsTobeConsidered
            );

            // let amount =
            //   yesTokenBalance > noTokenBalance ? noTokenBalance : yesTokenBalance;
            this.openNotification('info', 'Unwrapping shares', '');
            if (chainId === 42) {
                const sendTo = accounts[0];
                const jsonInterfaceForUpdatedUnwrapMultipleTokens = {
                    inputs: [
                        {
                            internalType: 'uint256[]',
                            name: '_tokenIds',
                            type: 'uint256[]',
                        },
                        {
                            internalType: 'uint256[]',
                            name: '_amounts',
                            type: 'uint256[]',
                        },
                        {
                            internalType: 'address',
                            name: '_recipient',
                            type: 'address',
                        },
                    ],
                    name: 'unWrapMultipleTokens',
                    outputs: [],
                    stateMutability: 'nonpayable',
                    type: 'function',
                };
                const parameters = [
                    tokenIdsTobeConsidered,
                    tokenAmountsTobeConsidered,
                    sendTo,
                ];
                const data = web3.eth.abi.encodeFunctionCall(
                    jsonInterfaceForUpdatedUnwrapMultipleTokens,
                    parameters
                );

                const customTx = {
                    from: accounts[0],
                    to: augurFoundry.options.address,
                    data: data,
                };
                await web3.eth.sendTransaction(customTx);
                return;
            }
            augurFoundry.methods
                .unWrapMultipleTokens(
                    tokenIdsTobeConsidered,
                    tokenAmountsTobeConsidered
                )
                .send({ from: accounts[0] })
                .on('receipt', (receipt) => {
                    this.openNotification(
                        'success',
                        'Shares unwrapped successfully',
                        ''
                    );
                    this.initData();
                })
                .on('error', (error) => {
                    if (
                        error.message.includes(
                            'User denied transaction signature'
                        )
                    ) {
                        this.openNotification(
                            'error',
                            'User denied signature',
                            'sign the transaction to be able to execute the transaction'
                        );
                    } else {
                        this.openNotification(
                            'error',
                            'There was an error in executing the transaction',
                            ''
                        );
                    }
                });
        }
        // await this.initData();
    }

    async getBalancesMarketERC20(marketAddress) {
        const { accounts } = this.state.web3Provider;
        const { shareToken, augurFoundry, erc20, OUTCOMES } = this.state;
        let invalidTokenBalance = new BN(0);
        let yesTokenBalance = new BN(0);
        let noTokenBalance = new BN(0);

        if (accounts[0]) {
            const tokenAddresses = await this.getTokenAddresses(marketAddress);

            let tokenBalances = [];
            for (let i = 0; i < tokenAddresses.length; i++) {
                const tokenBalance = await this.getBalanceOfERC20(
                    tokenAddresses[i],
                    accounts[0]
                );
                tokenBalances.push(tokenBalance);
            }
            // console.log('tokenBalances', tokenBalances)
            return tokenBalances;
        }
    }
    async getNumberOfOutcomes(marketAddress) {
        const { market } = this.state;
        market.options.address = marketAddress;
        return await market.methods.getNumberOfOutcomes().call();
    }
    async getTokenIds(marketAddress) {
        const { shareToken, augurFoundry, OUTCOMES, market } = this.state;
        market.options.address = marketAddress;

        const numOfOutcomes = await market.methods.getNumberOfOutcomes().call();
        // console.log('num of outcomes', numOfOutcomes)

        const outcomeArray = Array.from({ length: numOfOutcomes }, (_, i) => i);

        // console.log('ouecomeArray', outcomeArray)

        let tokenIds = await shareToken.methods
            .getTokenIds(marketAddress, outcomeArray)
            .call();
        // console.log('tokenIds', tokenIds)
        this.setState({ tokenIds: tokenIds });
        return tokenIds;
    }

    async getTokenAddresses(marketAddress) {
        const { shareToken, augurFoundry, OUTCOMES, market } = this.state;

        let tokenIds = await this.getTokenIds(marketAddress);

        const tokenAddresses = [];

        for (let i = 0; i < tokenIds.length; i++) {
            const tokenAddress = await augurFoundry.methods
                .wrappers(tokenIds[i])
                .call();
            tokenAddresses.push(tokenAddress);
        }
        // console.log('tokenAddresses', tokenAddresses)

        return tokenAddresses;
    }
    async getERC20Symbols(marketAddress) {
        const { erc20 } = this.state;
        const tokenAddresses = await this.getTokenAddresses(marketAddress);

        let tokenSymbols = [];

        for (let i = 0; i < tokenAddresses.length; i++) {
            erc20.options.address = tokenAddresses[i];
            const tokenSymbol = await erc20.methods.symbol().call();
            tokenSymbols.push(tokenSymbol);
        }
        // console.log('tokenSymbols', tokenSymbols)

        return tokenSymbols;
    }
    async getBalancesMarketShareTokenWONumTicks(marketAddress) {
        const { accounts } = this.state.web3Provider;
        const { shareToken } = this.state;

        if (accounts[0]) {
            let tokenIds = await this.getTokenIds(marketAddress);

            let shareTokenBalances = [];

            for (let i = 0; i < tokenIds.length; i++) {
                const shareTokenBalance = new BN(
                    await shareToken.methods
                        .balanceOf(accounts[0], tokenIds[i])
                        .call()
                );
                shareTokenBalances.push(shareTokenBalance);
            }
            return shareTokenBalances;
        }
    }
    async getBalancesMarketShareToken(marketAddress) {
        const { accounts, web3 } = this.state.web3Provider;
        const { shareToken, augurFoundry, market, erc20, OUTCOMES } = this.state;

        market.options.address = marketAddress;
        let numTicks = new BN(await market.methods.getNumTicks().call());

        if (accounts[0]) {
            let tokenIds = await this.getTokenIds(marketAddress);

            let shareTokenBalancesWithNumTicks = [];

            for (let i = 0; i < tokenIds.length; i++) {
                const shareTokenBalance = new BN(
                    await shareToken.methods
                        .balanceOf(accounts[0], tokenIds[i])
                        .call()
                );
                const shareTokenBalanceWithNumTicks = shareTokenBalance.mul(
                    numTicks
                );
                shareTokenBalancesWithNumTicks.push(
                    shareTokenBalanceWithNumTicks
                );
            }

            // console.log(
            //     'shareTokenBalancesWithNumTicks',
            //     shareTokenBalancesWithNumTicks
            // )
            return shareTokenBalancesWithNumTicks;
        }
    }

    async checkIfMoreThanZeroERC20s(wrappedBalances) {
        const { accounts } = this.state.web3Provider;
        // console.log("accounts{0}" + accounts[0]);
        // console.log("marketAddress" + marketAddress);

        for (let i = 0; i < wrappedBalances.length; i++) {
            if (wrappedBalances[i].cmp(new BN(0)) !== 0) {
                return true;
            }
        }
        return false;
    }
    async checkIfMoreThanZeroShares(shareTokenBalances) {
        for (let i = 0; i < shareTokenBalances.length; i++) {
            if (shareTokenBalances[i].cmp(new BN(0)) !== 0) {
                return true;
            }
        }
        return false;
    }

    openNotification = (type, title, description, duration) => {
        if (duration == undefined) {
            duration = 15;
        } else {
            duration = duration;
        }
        // const { notification } = antd;
        notification[type]({
            message: title,
            duration: duration,
            description: description,
        });
    };
    timeConverter(UNIX_timestamp) {
        var a = new Date(UNIX_timestamp * 1000);
        var time = a.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        });
        return time;
    }
    showMarketInfoOnHover(marketId) {
        // let desciption = markets[marketId].desciption;
        let longDescription = markets[marketId].extraInfo.longDescription;
        let endTimeUnix = markets[marketId].endTime;
        let date = this.timeConverter(endTimeUnix);

        //"Resolution Details: " + longDescription + "\nMarket Ends on: " + date
        return (
            <Popover>
                {/* <Popover.Title as="h3">Info</Popover.Title> */}
                <Popover.Content>
                    MARKET ENDS ON : {date} <br />
                    <br />
                    RESOLUTION DETAILS :<br />
                    {longDescription}
                    <br />
                    <br />
                    MARKET ID : {markets[marketId].address}
                </Popover.Content>
            </Popover>
        );
    }
    handleChange = async (e) => {
        console.log('handle change');
        console.log(e.target.name, e.target.value);
        this.setState({ [e.target.name]: e.target.value });
        console.log('state', this.state);
    };
    onModalSubmit = async (e) => {
        const { marketAddress, isWrapping } = this.state;
        const { web3 } = this.state.web3Provider;
        // let marketAddress = "0x4dea3bedae79da692f2675038c4d9b8c246b4fb6";
        e.preventDefault();
        e.persist();

        //TODO: Add tokenIds in the state
        const tokenIds = await this.getTokenIds(marketAddress);

        //TODO: Add multiplier in the state
        let multiplier = new BN(3);
        let chainId = await web3.eth.net.getId();
        // if (chainId === 42) {
        //     multiplier = new BN(2)
        // }

        let inputAmounts = [];
        for (let i = 0; i < tokenIds.length; i++) {
            let inputAmountRaw = e.target.elements['inputAmount' + i].value;
            console.log('inputAmountsRaw', inputAmountRaw);
            //TODO: add sanity check for inputAmountRaw

            let inputAmount = new BN(web3.utils.toWei(inputAmountRaw));
            inputAmount = inputAmount.div(new BN(10).pow(multiplier));

            inputAmounts.push(inputAmount);
        }

        console.log('marketAddress', marketAddress);

        if (isWrapping) {
            await this.wrapShare(marketAddress, inputAmounts);
        } else {
            await this.unwrapShares(marketAddress, inputAmounts);
        }
    };

    showToolTip() {
        this.setState({ isShowToolTip: true });
    }

    hideToolTip() {
        this.setState({ isShowToolTip: false });
    }
    render() {
        return (
            <Container className="p-3 mainContainer">
                <Jumbotron>
                    <Jumbotron className="topcorner oi-display">
                        <h5>
                            <span
                                className="foundry-tvl"
                                style={{ color: '#FFFFFF' }}
                            >
                                Foundry TVL:{' '}
                                <NumberFormat
                                    value={this.state.foundryTVL}
                                    displayType={'text'}
                                    thousandSeparator={true}
                                    prefix={'$'}
                                />
                            </span>
                            <span
                                className="foundry-percent"
                                style={{ color: '#FFFFFF' }}
                            >
                                Portion of Net Augur OI:{' '}
                                {this.state.foundryPecentage}%
                            </span>
                        </h5>
                    </Jumbotron>
                    <h3 className="header">
                        <span style={{ color: '#FFA300' }}>AU</span>
                        <span style={{ color: '#FFFFFF' }}>
                            GUR <br></br> FOUNDRY
                        </span>
                    </h3>
                    <Modal show={this.state.show} onHide={this.hideModal}>
                        <Modal.Header closeButton> </Modal.Header>
                        <Form onSubmit={this.onModalSubmit}>
                            {this.state.someData}
                            <Row className="justify-content-md-center">
                                <Col xs={4} className="auto">
                                    {this.state.isWrapping ? (
                                        <Button
                                            variant="danger"
                                            className="m-left"
                                            type="submit"
                                        >
                                            WRAP SHARES
                                        </Button>
                                    ) : (
                                            <Button
                                                variant="success"
                                                className="m-left"
                                                type="submit"
                                            >
                                                UNWRAP{' '}
                                            </Button>
                                        )}
                                </Col>
                            </Row>
                        </Form>
                    </Modal>
                    <Row>
                        <Col xs={7}>
                            <Jumbotron className="dropdownMarket">
                                <Form onSubmit={this.mintDaiForm}>
                                    <div className="with-info">
                                        <Form.Control
                                            as="select"
                                            custom
                                            name="marketIds"
                                            onChange={this.setMarket}
                                        >
                                            <option value={0}>
                                                Select Market
                                            </option>
                                            {markets.map((i) => (
                                                <option
                                                    value={i.address}
                                                    key={i.address}
                                                >
                                                    {i.extraInfo.description}
                                                </option>
                                            ))}
                                        </Form.Control>

                                        <div
                                            onMouseEnter={this.showToolTip}
                                            onMouseLeave={this.hideToolTip}
                                            className="market-info-part"
                                        >
                                            {this.state.selectedMarket && (
                                                <FontAwesomeIcon icon="info-circle" />
                                            )}
                                            {this.state.selectedMarket &&
                                                this.state.isShowToolTip && (
                                                    <div className="custom-tooltip">
                                                        <div className="tooltip-item">
                                                            <h5>
                                                                Market Title:{' '}
                                                            </h5>
                                                            <p>
                                                                {
                                                                    this.state
                                                                        .selectedMarket
                                                                        .extraInfo
                                                                        .description
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="tooltip-item">
                                                            <h5>
                                                                Market
                                                                Description:{' '}
                                                            </h5>
                                                            <p>
                                                                {
                                                                    this.state
                                                                        .selectedMarket
                                                                        .extraInfo
                                                                        .longDescription
                                                                }
                                                            </p>
                                                        </div>
                                                        <div className="tooltip-item">
                                                            <h5>
                                                                Expiration Date:{' '}
                                                            </h5>
                                                            <p>
                                                                {this.timeConverter(
                                                                    this.state
                                                                        .selectedMarket
                                                                        .endTime
                                                                )}
                                                            </p>
                                                        </div>
                                                        <div className="tooltip-item">
                                                            <h5>Market ID: </h5>
                                                            <p>
                                                                {
                                                                    this.state
                                                                        .selectedMarket
                                                                        .address
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                    <Row>
                                        <Col xs={8}>
                                            <Form.Group controlId="exampleForm.ControlInput1">
                                                <Form.Control
                                                    type="text"
                                                    name="amount"
                                                    placeholder="Amount of DAI"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col xs={4}>
                                            <Button
                                                variant="primary"
                                                type="submit"
                                                block
                                                className="mintShare"
                                            >
                                                MINT SHARES
                                            </Button>
                                        </Col>
                                    </Row>
                                </Form>
                            </Jumbotron>
                        </Col>
                    </Row>

                    <Table striped bordered hover>
                        <thead>
                            <tr>
                                <th className="market-column">Market</th>
                                <th className="holdings-column">
                                    My Shares{' '}
                                    <span className="faded">(ERC1155)</span>
                                </th>
                                <th className="holdings-column">
                                    My Tokens{' '}
                                    <span className="faded">(ERC20)</span>
                                </th>
                                <th>Convert / Redeem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.listData == null ? (
                                <span>Loading...</span>
                            ) : (
                                    this.state.listData
                                )}
                        </tbody>
                    </Table>
                    <div className="misc-links">
                        <ul class="link-list">
                            <li>
                                {' '}
                                <a
                                    href="https://medium.com/sunrise-over-the-merkle-trees/how-to-use-augur-foundry-315f408c0d57"
                                    target="_blank"
                                >
                                    <span class="link_emoji">&#128129;</span>
                                    Tutorial
                                </a>
                            </li>
                            <li>
                                {' '}
                                <a
                                    href="https://pools.balancer.exchange/#/pool/0x6b74fb4e4b3b177b8e95ba9fa4c3a3121d22fbfb/"
                                    target="_blank"
                                    onClick={this.showPoolsModal}
                                >
                                    <span class="link_emoji">&#128167;</span>
                                    Liquidity Pools
                                </a>
                            </li>
                            <li>
                                {' '}
                                <a
                                    href="https://catnip.exchange/"
                                    target="_blank"
                                >
                                    <span class="link_emoji">&#128049;</span>
                                    catnip exchange
                                </a>
                            </li>
                            <li>
                                {' '}
                                <a
                                    href="https://github.com/aug-dao/augur_foundry"
                                    target="_blank"
                                >
                                    <span class="link_emoji"> &#128187;</span>
                                    Codebase
                                </a>
                            </li>
                        </ul>
                    </div>
                </Jumbotron>

                <Modal
                    show={this.state.isShowPools}
                    onHide={this.hidePoolsModal}
                >
                    <Modal.Header closeButton>
                        <Modal.Title>Liquidity Pools</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Row>
                            <Col>
                                <a
                                    href="https://pools.balancer.exchange/#/pool/0x6b74fb4e4b3b177b8e95ba9fa4c3a3121d22fbfb/"
                                    target="_blank"
                                >
                                    <h5>yTrump/nTrump/DAI </h5>
                                </a>
                            </Col>
                            <Col>
                                <a
                                    href="https://pools.balancer.exchange/#/pool/0xed0413d19cdf94759bbe3fe9981c4bd085b430cf"
                                    target="_blank"
                                >
                                    <h5>nTrump/DAI </h5>
                                </a>
                            </Col>
                            <Col>
                                <a
                                    href="https://pools.balancer.exchange/#/pool/0x68c74e157f35a3e40f1b02bba3e6e3827d534059"
                                    target="_blank"
                                >
                                    <h5>yBlue/nBlue/DAI </h5>
                                </a>
                            </Col>
                            <Col>
                                <a
                                    href="https://pools.balancer.exchange/#/pool/0xd4f73d51098df4dbe841cbbe3fa77d735422f656/"
                                    target="_blank"
                                >
                                    <h5>SUPER BOWL (Chiefs/Bucs/DAI)</h5>
                                </a>
                            </Col>
                        </Row>
                    </Modal.Body>
                </Modal>
            </Container>
        );
    }
}
