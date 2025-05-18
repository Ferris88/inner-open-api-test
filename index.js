const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');
const {Web3} = require('web3');
const TronWeb = require('tronweb');


const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: {"TRON-PRO-API-KEY": ''},
    privateKey: ''
});
const app = express();
const PORT = 3000;
const PROXY_PORT = 3001;

app.use(bodyParser.json());
app.use(cors());

const PRIVATE_KEY = ''

const TRON_PRIVATE_KEY = ''


app.post('/send-transaction', async (req, res) => {
    try {
        const {chainId, jsonInput} = req.body;
        console.log('chainId:', chainId);

        if (chainId === ChainId.TRON) {
            const {from, to, data, value, abi} = JSON.parse(jsonInput);
            let tronResponse = await tron_send_tx(from, to, data, value, abi);
            res.send({transactionHash: tronResponse});
            return;
        }


        const txHash = await main({chainId: parseInt(chainId, 10), ...JSON.parse(jsonInput)});
        res.set('Access-Control-Allow-Origin', '*');
        console.log('Res Transaction hash:', txHash);

        res.send({transactionHash: txHash});
    } catch (error) {
        console.error('Error in /send-transaction:', error);

        // 确保错误信息是可序列化的
        const errorDetails = {
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace available',
            code: error.code || 'UNKNOWN_ERROR',
            errors: error.errors || []
        };

        // 返回 JSON 格式的错误信息
        res.status(500).json(errorDetails); // 直接传递对象
    }
});

async function sendTransaction(web3, txObject, privateKey) {
    try {
        const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt.transactionHash;
    } catch (error) {
        console.error('Failed to send transaction:', error);
        throw error;
    }
}

async function main(transactionData) {
    try {
        const {from, to, chainId, data, value, gas} = transactionData;
        console.log('Transaction data:', transactionData);
        const rpcUrl = getRpcUrl(chainId);
        console.log('RPC URL:', rpcUrl);
        const web3 = new Web3(rpcUrl);

        const nonce = await web3.eth.getTransactionCount(from, 'latest');
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = await estimateGas(web3, {
            from: from,
            to: to,
            data: data,
            value: parseInt(value, 10)
        });

        const txObject = {
            nonce: nonce,
            to: to,
            gasLimit: gasLimit * BigInt(2),
            gasPrice: gasPrice * BigInt(3) / BigInt(2),
            data: data,
            value: parseInt(value, 10)
        };


        const txHash = await sendTransaction(web3, txObject, PRIVATE_KEY);
        console.log('Transaction hash:', txHash);
        return txHash;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}


app.get('/proxy', (req, res) => {
    const url = req.query.url;
    console.log(`Proxying request to: ${url}`);
    request(
        {url: url},
        (error, response, body) => {
            if (error) {
                console.error(`Error: ${error}`);
                res.status(500).send(error);
            } else {
                res.set('Access-Control-Allow-Origin', '*');
                res.send(body);
            }
        }
    );
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const proxyApp = express();
proxyApp.use(cors());

proxyApp.get('/proxy', (req, res) => {
    const url = req.query.url;
    console.log(`Proxying request to: ${url}`);
    request(
        {url: url},
        (error, response, body) => {
            if (error) {
                console.error(`Error: ${error}`);
                res.status(500).send(error);
            } else {
                res.set('Access-Control-Allow-Origin', '*');
                res.send(body);
            }
        }
    );
});

proxyApp.listen(PROXY_PORT, () => {
    console.log(`Proxy server is running on port ${PROXY_PORT}`);
});

async function estimateGas(web3, transaction) {
    try {
        let gas = await web3.eth.estimateGas(transaction);
        return gas * BigInt(2);
    } catch (error) {
        console.error('Failed to estimate gas:', error);
        throw error;
    }
}

const ChainId = {
    ETH: 1,
    BSC: 56,
    POLYGON: 137,
    AVALANCHE: 43114,
    ARBITRUM: 42161,
    BASE: 8453,
    X_LAYER: 196,
    OP: 10,
    TRON: 195,
    SONIC: 146,
    SOLANA: 101
};

function getRpcUrl(chainId) {
    switch (chainId) {
        case ChainId.ETH:
            return 'https://eth.llamarpc.com';
        case ChainId.BSC:
            return 'https://binance.llamarpc.com';
        case ChainId.POLYGON:
            return 'https://polygon.llamarpc.com';
        case ChainId.AVALANCHE:
            return 'https://avalanche-c-chain-rpc.publicnode.com';
        case ChainId.ARBITRUM:
            return 'https://arbitrum.meowrpc.com';
        case ChainId.BASE:
            return 'https://base-rpc.publicnode.com';
        case ChainId.X_LAYER:
            return 'https://rpc.xlayer.tech';
        case ChainId.OP:
            return 'https://optimism.llamarpc.com';
        case ChainId.TRON:
            return 'https://api.trongrid.io';
        case ChainId.SONIC:
            return 'wss://sonic.drpc.org';
        case ChainId.SOLANA:
            return 'https://api.mainnet-beta.solana.com';
        default:
            throw new Error(`Unsupported chainId: ${chainId}`);
    }
}

async function assembleTriggerRequest(from, to, data, value, abi) {

    console.log('assembleTriggerRequest: ', from, to, data, value, abi);
    const options = {
        method: 'POST',
        url: 'https://api.trongrid.io/wallet/triggersmartcontract',
        headers: {accept: 'application/json', 'content-type': 'application/json'},
        body: {
            owner_address: from,
            contract_address: to,
            function_selector: abi,
            parameter: data.substring(10),
            fee_limit: 600000000,
            call_value: parseInt(value, 10),
            visible: true
        },
        json: true
    };
    return new Promise((resolve, reject) => {
        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
}


async function tron_send_tx(from, to, data, value, abi) {
    const rawTransaction = await assembleTriggerRequest(from, to, data, value, abi);
    console.log('tron_send_tx-rawTransaction: ', rawTransaction);
    try {
        const transaction = rawTransaction.transaction;
        if (!transaction) {
            throw new Error('Transaction data is missing');
        }
        let signedTransaction = transaction;
        if (!transaction.signature) {
            console.log('signing transaction');
            signedTransaction = await tronWeb.trx.sign(transaction, TRON_PRIVATE_KEY);
            console.log('signedTransaction:  ', signedTransaction);
        }
        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        console.log(result);
        return result;
    } catch (err) {
        console.log(err);
    }
}

