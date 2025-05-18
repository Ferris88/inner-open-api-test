# 项目使用方法

## 1. 安装依赖
```shell
1. ‌安装 Homebrew

终端执行命令（若已安装可跳过）：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. 通过 Homebrew 安装 Node.js
  brew install node
‌  验证安装‌
  执行 node -v 和 npm -v
 
3. yarn intall
  yarn add  express request cors express request cors tronweb
```

## 2. 配置相关信息
- 在index.js 中配置私钥 **`PRIVATE_KEY`**
- `display-index` 的callDataUrl 中配置请求地址 **`url`**
- 如果要发Tron的交易 也要配置 **`TRON_PRIVATE_KEY`** 和 **`trongrid ApiKey`**
- > **`url`** 中请求的 **`user`** 替换为自己的钱包地址
  > 如果涉及到Solana交易 需要到  https://dashboard.helius.dev/ 申请节点 
> 最新脚本支持Solana Chain，需要执行 `send-tx-demo-v1.js`  并且确保`yarn install`是完整可以执行的 [遇到问题请参考Gpt]


## 3. 示例
![img.png](img.png)

