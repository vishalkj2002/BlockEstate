# BlockEstate
<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f2027,50:203a43,100:2c5364&height=200&section=header&text=BlockEstate&fontSize=72&fontColor=ffffff&fontAlignY=38&desc=Decentralized%20Land%20Registration%20on%20Ethereum&descAlignY=58&descSize=18&descColor=aed6f1" width="100%"/>

<br/>

[![Ethereum](https://img.shields.io/badge/Ethereum-Blockchain-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)](https://ethereum.org/)
[![Solidity](https://img.shields.io/badge/Solidity-Smart%20Contracts-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![Flask](https://img.shields.io/badge/Flask-Backend-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

> **Tamper-proof. Transparent. Trustless.**  
> A full-stack DApp that brings land ownership records onto the Ethereum blockchain — eliminating fraud, paperwork, and intermediaries.

<br/>

[Features](#-key-features) · [How It Works](#-how-it-works) · [Tech Stack](#-tech-stack) · [Installation](#-installation-guide) · [Roadmap](#-future-enhancements)

</div>

---

## 📖 About

Traditional land registries are riddled with inefficiencies — forged documents, opaque processes, slow transfers, and heavy dependence on middlemen. **BlockEstate** reimagines property ownership for the digital age.

By combining **Ethereum smart contracts**, **cryptographic security**, and a **decentralized architecture**, this system creates a land registry that is:

| 🔗 Immutable | 🔐 Secure | 🌐 Transparent |
|:---:|:---:|:---:|
| Records on-chain can never be altered or deleted | Ownership verified via cryptographic proof | Every transaction is publicly auditable |

---

## ⚠️ Problems with the Traditional System

```
❌ Fraudulent and manipulated records
🐢 Slow, bureaucratic property transfers
📄 Mountains of paperwork
🔍 Zero transparency for citizens
💰 High intermediary costs (agents, notaries, lawyers)
⚖️ Lengthy and expensive dispute resolution
💾 Centralized data — single point of failure
```

---

## 🚀 How It Works

### Step 1 — Registering Land Ownership

```
User uploads property documents
        ↓
Government authority verifies ownership
        ↓
   If valid → Approved
        ↓
Data stored permanently on Ethereum
        ↓
   ✅ Tamper-proof ownership record created
```

### Step 2 — Transferring Property

```
Seller lists property with asking price
        ↓
Buyers submit purchase requests
        ↓
Seller reviews & accepts an offer
        ↓
Buyer transfers Ether as payment
        ↓
   ✅ Smart contract auto-transfers ownership
```

---

## 🛠 Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML · CSS · JavaScript | UI templates via Flask |
| **Backend** | Python · Flask | REST APIs & server logic |
| **Database** | MongoDB | Off-chain document storage |
| **Blockchain** | Ethereum | Immutable ownership ledger |
| **Smart Contracts** | Solidity | Transfer & registry logic |
| **Dev Tools** | Truffle · Ganache | Contract compilation & local chain |
| **Wallet** | MetaMask | Transaction signing & auth |

</div>

---

## ✨ Key Features

- 🏷️ **Property Auction System** — List and bid on properties in a decentralized marketplace
- 🌍 **Global Property Visibility** — Browse all registered land assets transparently
- 💬 **Buyer–Seller Interaction** — Built-in communication flow between parties
- 🤝 **Smart Negotiation Flow** — Offer, counter-offer, and accept seamlessly
- 🔐 **Secure Ether Transactions** — Payments handled by trustless smart contracts
- 📜 **Immutable Ownership Records** — On-chain records that cannot be forged or deleted
- ⚡ **Instant Ownership Transfer** — No waiting periods, no paperwork — just a transaction

---

## ⚙️ Installation Guide

### 🔧 Prerequisites

Make sure the following are installed before proceeding:

- [Python 3.x](https://www.python.org/downloads/)
- [Node.js & npm](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community)
- [Ganache](https://trufflesuite.com/ganache/) (local Ethereum blockchain)
- [MetaMask](https://metamask.io/) (browser extension)
- [Truffle](https://trufflesuite.com/) — `npm install -g truffle`

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/vishalkj2002/BlockEstate.git
cd Land-Registraion-System-with-Blockchain
```

---

### 2️⃣ Set Up Local Blockchain (Ganache)

1. Open **Ganache** and create a new workspace
2. Note down:
   - RPC URL (default: `http://127.0.0.1:7545`)
   - Port (`7545`)
   - Network ID (`5777`)

---

### 3️⃣ Deploy Smart Contracts

```bash
cd smart-contracts
truffle migrate
```

> 📌 Save the **deployed contract address** — you'll need it in the config step.

---

### 4️⃣ Set Up Python Virtual Environment

```bash
python3 -m venv env
source env/bin/activate          # On Windows: env\Scripts\activate
pip install -r python_package_requirements.txt
```

---

### 5️⃣ Configure the Government (Revenue Dept) Server

Edit `admin-panel/config.json`:

```json
{
  "Ganache_Url": "http://127.0.0.1:7545",
  "NETWORK_CHAIN_ID": 5777,
  "Mongo_Db_Url": "mongodb://localhost:27017",
  "Secret_Key": "your_secret_key",
  "Address_Used_To_Deploy_Contract": "your_deployer_account_address",
  "Admin_Password": "your_admin_password_here"
}
```

Then run the server:

```bash
cd admin-panel
python3 app.py
```

---

### 6️⃣ Start the User Portal

```bash
cd user-panel
python3 app.py
```

> 🌐 Open your browser and connect MetaMask to `http://127.0.0.1:7545` (Ganache network) to interact with the DApp.

---

## 📊 Future Enhancements

| Enhancement | Description |
|---|---|
| 🌐 Government API Integration | Sync with official land record databases |
| 💳 Payment Gateway | Support fiat currencies alongside Ether |
| ☁️ IPFS Storage | Decentralized document storage for property files |
| 📱 Mobile App | iOS & Android interfaces for wider accessibility |
| 🧠 AI Fraud Detection | ML models to flag suspicious transactions |
| 🔏 Zero-Knowledge Proofs | Privacy-preserving ownership verification |

---


## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2c5364,50:203a43,100:0f2027&height=100&section=footer" width="100%"/>

**Built with ❤️ on Ethereum**

</div>
