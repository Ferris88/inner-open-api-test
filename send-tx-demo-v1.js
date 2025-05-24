const express = require('express');
const request = require('request');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Web3 } = require('web3');
const TronWeb = require('tronweb');
const bs58 = require('bs58');
const solanaWeb3 = require('@solana/web3.js');
const { Connection } = require("@solana/web3.js");
const { fromHex } = require('@mysten/bcs');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { post } = require("axios");
const { base } = require('@okxweb3/crypto-lib');

const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=xxxx");

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

const evmPrivateKey = '';
const tronPrivateKey = '';
const solanaPrivateKey = '';
const suiPrivateKey = '';

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
    SOLANA: 501,
    UNICHAIN: 130,
    SUI: 784
};

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
        [ChainId.SOLANA]: '',
        [ChainId.UNICHAIN]: 'wss://unichain-rpc.publicnode.com',
        [ChainId.SUI]: ''
    };
    if (!rpcUrls[chainId]) throw new Error(`Unsupported chainId: ${chainId}`);
    return rpcUrls[chainId];
}

async function estimateGas(web3, transaction) {
    try {
        return await web3.eth.estimateGas(transaction) * BigInt(2);
    } catch (error) {
        console.error('Failed to estimate gas:', error);
        throw error;
    }
}

async function sendEvmTransaction(web3, txObject, privateKey) {
    try {
        const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt.transactionHash;
    } catch (error) {
        console.error('Failed to send EVM transaction:', error);
        throw error;
    }
}

async function handleEvmTransaction(transactionData) {
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

    return await sendEvmTransaction(web3, txObject, evmPrivateKey);
}

async function handleTronTransaction(from, to, data, value, abi) {
    try {
        const rawTransaction = await assembleTronRequest(from, to, data, value, abi);
        const transaction = rawTransaction.transaction;
        if (!transaction) throw new Error('Transaction data is missing');

        const signedTransaction = transaction.signature
            ? transaction
            : await tronWeb.trx.sign(transaction, tronPrivateKey);

        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        return result;
    } catch (error) {
        console.error('Error in TRON transaction:', error);
        throw error;
    }
}

async function assembleTronRequest(from, to, data, value, abi) {
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

async function handleSolanaTransaction(callData) {
    const transaction = bs58.decode(callData);

    let tx;
    try {
        tx = solanaWeb3.Transaction.from(transaction);
    } catch (error) {
        tx = solanaWeb3.VersionedTransaction.deserialize(transaction);
    }

    const recentBlockHash = await connection.getLatestBlockhash();
    if (tx instanceof solanaWeb3.VersionedTransaction) {
        tx.message.recentBlockhash = recentBlockHash.blockhash;
    } else {
        tx.recentBlockhash = recentBlockHash.blockhash;
    }

    const feePayer = solanaWeb3.Keypair.fromSecretKey(bs58.decode(solanaPrivateKey));
    if (tx instanceof solanaWeb3.VersionedTransaction) {
        tx.sign([feePayer]);
    } else {
        tx.partialSign(feePayer);
    }

    const serializedTx = tx.serialize();
    const txId = await connection.sendRawTransaction(serializedTx, {
        maxRetries: 2,
        skipPreflight: true,
        preflightCommitment: 'processed'
    });

    return `https://solscan.io/tx/${txId}`;
}

async function handleSuiTransaction(callData) {
    const [, words] = base.fromBech32(suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(fromHex(base.toHex(words.slice(1), true)));
    const sender = keypair.getPublicKey().toSuiAddress();

    const signature = await keypair.signTransaction(base.fromBase64(callData));
    const isValid = await keypair.getPublicKey().verifyTransaction(base.fromBase64(callData), signature.signature);

    if (!isValid) throw new Error('Invalid SUI transaction signature');

    const url = 'https://sui-mainnet.blockvision.org/v1/2npLZmS5g7JDqDFFAehTw6HkuIO';
    const headers = {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': '93951c41-e026-4ad9-8572-7d85c499b371'
    };
    const data = {
        jsonrpc: "2.0",
        id: 1,
        method: "sui_executeTransactionBlock",
        params: [
            callData,
            [signature.signature],
            {
                showInput: true,
                showRawInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true
            },
            "WaitForLocalExecution"
        ]
    };

    const response = await post(url, data, { headers });
    return response.data.result.effects.transactionDigest;
}

async function main(transactionData) {
    const { chainId, jsonInput } = transactionData;
    const { from, to, data, value, abi } = JSON.parse(jsonInput);

    switch (Number(chainId)) {
        case ChainId.TRON:
            return await handleTronTransaction(from, to, data, value, abi);
        case ChainId.SOLANA:
            return await handleSolanaTransaction(data);
        case ChainId.SUI:
            return await handleSuiTransaction(data);
        default:
            return await handleEvmTransaction({ from, to, chainId, data, value });
    }
}

app.post('/send-transaction', async (req, res) => {
    try {
        const txHash = await main(req.body);
        res.set('Access-Control-Allow-Origin', '*');
        res.send({ transactionHash: txHash });
    } catch (error) {
        console.error('Error in /send-transaction:', error);
        res.status(500).json({
            message: error.message || 'Unknown error',
            stack: error.stack || 'No stack trace available',
            code: error.code || 'UNKNOWN_ERROR',
            errors: error.errors || []
        });
    }
});

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