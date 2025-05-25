# 项目使用方法

## 1. 安装依赖

1. 安装 Homebrew（如已安装可跳过）  
   `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

2. 通过 Homebrew 安装 Node.js  
   `brew install node`

3. 验证 Node.js 和 npm 是否安装成功  
   `node -v`  
   `npm -v`

4. 安装项目依赖（推荐使用 yarn）  
   `yarn install`

## 2. 配置项说明

- 在 `index.js` 中填写您的主链私钥：**`PRIVATE_KEY`**
- 在 `display-index` 的 `callDataUrl` 中配置请求地址：**`url`**
- 若需发送 Tron 交易，请配置 **`TRON_PRIVATE_KEY`** 及 **`trongrid ApiKey`**
- `url` 中的 `user` 参数请替换为您自己的钱包地址
- 若涉及 Solana 交易，请前往 [Helius Dashboard](https://dashboard.helius.dev/) 申请节点

## 3. 最新脚本 V1.0

> 最新脚本已支持 Solana、SUI Chain。请运行 `send-tx-demo-v1.js`，并确保依赖已完整安装。遇到问题可参考 GPT 提示。  
> 请务必正确配置各链的 `XXX_PRIVATE_KEY`。

## 4. 示例效果

![img.png](img.png)

---
> 💡 **如有疑问，欢迎查阅文档或联系 Ferris 获取支持。**
--- 