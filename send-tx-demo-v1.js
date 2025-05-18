const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Web3 } = require('web3');
const TronWeb = require('tronweb');
const bs58 = require('bs58');
const solanaWeb3 = require('@solana/web3.js');
const {Connection} = require("@solana/web3.js");



const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=xxxx")

// 配置
const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": '' },
    privateKey: ''
});

const app = express();
const PORT = 3000;
const PROXY_PORT = 3001;

app.use(bodyParser.json());
app.use(cors());

const PRIVATE_KEY = '';
const TRON_PRIVATE_KEY = '';
const solanaPrivateKey = ''


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
    SOLANA: 501
};

// 获取RPC URL
function getRpcUrl(chainId) {
    const rpcUrls = {
        [ChainId.ETH]: 'https://eth.llamarpc.com',
        [ChainId.BSC]: 'https://binance.llamarpc.com',
        [ChainId.POLYGON]: 'https://polygon.llamarpc.com',
        [ChainId.AVALANCHE]: 'https://avalanche-c-chain-rpc.publicnode.com',
        [ChainId.ARBITRUM]: 'https://arbitrum.meowrpc.com',
        [ChainId.BASE]: 'https://base-rpc.publicnode.com',
        [ChainId.X_LAYER]: 'https://rpc.xlayer.tech',
        [ChainId.OP]: 'https://optimism.llamarpc.com',
        [ChainId.TRON]: 'https://api.trongrid.io',
        [ChainId.SONIC]: 'wss://sonic.drpc.org',
        [ChainId.SOLANA]: ''
    };
    if (!rpcUrls[chainId]) throw new Error(`Unsupported chainId: ${chainId}`);
    return rpcUrls[chainId];
}

// 估算Gas
async function estimateGas(web3, transaction) {
    try {
        return await web3.eth.estimateGas(transaction) * BigInt(2);
    } catch (error) {
        console.error('Failed to estimate gas:', error);
        throw error;
    }
}

// 发送交易
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

// 主交易逻辑
async function main(transactionData) {
    try {
        const { from, to, chainId, data, value } = transactionData;

        const web3 = new Web3(getRpcUrl(chainId));

        const nonce = await web3.eth.getTransactionCount(from, 'latest');
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = await estimateGas(web3, { from, to, data, value: parseInt(value, 10) });

        const txObject = {
            nonce,
            to,
            gasLimit: gasLimit * BigInt(2),
            gasPrice: gasPrice * BigInt(3) / BigInt(2),
            data,
            value: parseInt(value, 10)
        };

        return await sendTransaction(web3, txObject, PRIVATE_KEY);
    } catch (error) {
        console.error('Error in main transaction logic:', error);
        throw error;
    }
}

// 组装TRON请求
async function assembleTriggerRequest(from, to, data, value, abi) {
    const options = {
        method: 'POST',
        url: 'https://api.trongrid.io/wallet/triggersmartcontract',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
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
        request(options, (error, response, body) => {
            if (error) reject(error);
            else resolve(body);
        });
    });
}

// 发送TRON交易
async function tron_send_tx(from, to, data, value, abi) {
    try {
        const rawTransaction = await assembleTriggerRequest(from, to, data, value, abi);
        const transaction = rawTransaction.transaction;
        if (!transaction) throw new Error('Transaction data is missing');

        const signedTransaction = transaction.signature
            ? transaction
            : await tronWeb.trx.sign(transaction, TRON_PRIVATE_KEY);

        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        return result;
    } catch (error) {
        console.error('Error in TRON transaction:', error);
        throw error;
    }
}

// 处理交易请求
app.post('/send-transaction', async (req, res) => {
    try {
        const { chainId, jsonInput } = req.body;
        const { from, to, data, value, abi } = JSON.parse(jsonInput);
        if (chainId === ChainId.TRON) {
            const { from, to, data, value, abi } = JSON.parse(jsonInput);
            const tronResponse = await tron_send_tx(from, to, data, value, abi);
            return res.send({ transactionHash: tronResponse });
        }

        if (chainId.toString() === ChainId.SOLANA.toString()) {
            let txHash = await signTransaction(data);
            return res.send({ transactionHash: txHash });
        }

        const txHash = await main({ chainId: parseInt(chainId, 10), ...JSON.parse(jsonInput) });
        res.set('Access-Control-Allow-Origin', '*');
        res.send({ transactionHash: txHash });
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

// 代理请求
function setupProxy(app, port) {
    app.use(cors());
    app.get('/proxy', (req, res) => {
        const url = req.query.url;
        request({ url }, (error, response, body) => {
            if (error) {
                console.error(`Proxy error: ${error}`);
                res.status(500).send(error);
            } else {
                res.set('Access-Control-Allow-Origin', '*');
                res.send(body);
            }
        });
    });
    app.listen(port, () => console.log(`Proxy server running on port ${port}`));
}

setupProxy(app, PORT);
setupProxy(express(), PROXY_PORT);


async function signTransaction(callData) {

    const transaction = bs58.decode(callData)

    let tx
    try {
        tx = solanaWeb3.Transaction.from(transaction)
    } catch (error) {
        tx = solanaWeb3.VersionedTransaction.deserialize(transaction)
    }

    const recentBlockHash = await connection.getLatestBlockhash();
    console.log('recentBlockHash', recentBlockHash)

    if (tx instanceof solanaWeb3.VersionedTransaction) {
        tx.message.recentBlockhash = recentBlockHash.blockhash;
    } else {
        tx.recentBlockhash = recentBlockHash.blockhash
    }


    let feePayer = solanaWeb3.Keypair.fromSecretKey(bs58.decode(solanaPrivateKey))
    if (tx instanceof solanaWeb3.VersionedTransaction) {
        tx.sign([feePayer])
    } else {
        tx.partialSign(feePayer)
    }
    let serialize = tx.serialize();
    console.log('serialize', serialize)
    const txId = await connection.sendRawTransaction(serialize, {
        maxRetries: 2,
        skipPreflight: true,
        preflightCommitment: 'processed'
    });

    console.log('txId:', txId)

    return `https://solscan.io/tx/${txId}`;
}