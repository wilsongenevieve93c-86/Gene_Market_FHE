# Gene Market: Confidential Genetic Data Marketplace for Research

Gene Market is a pioneering platform that revolutionizes the way genetic data is shared and utilized in scientific research, all powered by **Zama's Fully Homomorphic Encryption technology (FHE)**. This unique marketplace allows users to submit their FHE-encrypted whole genome sequencing data for research purposes, enabling pharmaceutical companies to conduct encrypted correlational studies while ensuring that user privacy is paramount. Users not only contribute to scientific advancement but also earn rewards in the process.

## The Challenge: Protecting Genetic Privacy

In today's data-driven world, genetic information has become a valuable asset for research and pharmaceutical development. However, sharing this sensitive data poses significant privacy risks. Users are often hesitant to disclose their genomic data due to concerns about misuse or unauthorized access. The lack of secure environments where individuals can share their genetic information without compromising their privacy hinders scientific progress and drug development.

## The FHE Solution: Safe and Secure Data Sharing

The **Gene Market** addresses these challenges using **Zama's Fully Homomorphic Encryption technology**. This technology enables computation on encrypted data, allowing pharmaceutical companies to perform valuable analyses without ever accessing the raw genetic data itself. By leveraging Zama's open-source libraries, such as **Concrete**, **TFHE-rs**, and the **zama-fhe SDK**, Gene Market fosters a safe environment for all parties involved. Users can confidently share their genomic data while retaining complete control over their privacy.

## Key Features

- **FHE-Encrypted User Data:** Users can submit their genome data securely encrypted with FHE.
- **Research Query Execution:** Utilizing homomorphic encryption algorithms to execute research queries without exposing raw data.
- **Monetization of Data:** Users can earn rewards by allowing pharmaceutical companies to conduct research using their encrypted data.
- **Contribution to Science:** Individuals support scientific research while maintaining their privacy.
- **User-Friendly Interface:** An intuitive portal for users to manage their genetic data and permissions easily.

## Technology Stack

- **Zama SDK:** The primary component for integrating fully homomorphic encryption in the application.
- **Node.js:** For server-side JavaScript execution.
- **Hardhat/Foundry:** Development environment for Ethereum-based smart contracts.
- **Solidity:** Programming language for writing smart contracts.
- **IPFS (InterPlanetary File System):** For decentralized storage of encrypted data.

## Directory Structure

Here’s how the project's directory is structured:

```
Gene_Market_FHE/
│
├── contracts/
│   └── Gene_Market.sol
│
├── src/
│   ├── index.js
│   ├── encryption.js
│   └── queries.js
│
├── test/
│   ├── testGeneMarket.js
│   └── utils.js
│
├── package.json
├── hardhat.config.js
└── README.md
```

## Installation Instructions

To get started with Gene Market, follow these setup instructions:

1. **Ensure you have Node.js installed:** Make sure you have Node.js (v12 or higher) installed on your machine.
2. **Set up your project environment:**
   - Create a new directory for the project.
   - Navigate into the directory.
3. **Install dependencies:** Run the following command to install all required packages, including Zama FHE libraries:

   ```bash
   npm install
   ```

**Important:** Do not use `git clone` or any repository URLs.

## Build & Run Guide

Once the installation is complete, follow these steps to compile, test, and run the project:

1. **Compile the smart contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Run tests to ensure everything is working properly:**
   ```bash
   npx hardhat test
   ```

3. **Start the application:**
   ```bash
   npx hardhat run scripts/deploy.js
   ```

## Example Usage

Here’s a short snippet demonstrating how users can submit their encrypted genomic data for research:

```javascript
const { encryptData, submitData } = require('./encryption.js');

// Example genomic data
const genomicData = {
    userId: 'user123',
    data: 'ATGCATGCATGCATGC...'
};

// Encrypt the genomic data using FHE
const encryptedData = encryptData(genomicData.data);

// Submit the encrypted data to the Gene Market
submitData(genomicData.userId, encryptedData)
    .then(response => {
        console.log('Data submitted successfully:', response);
    })
    .catch(error => {
        console.error('Error submitting data:', error);
    });
```

## Acknowledgements

**Powered by Zama**: This project harnesses the groundbreaking capabilities of Zama's Fully Homomorphic Encryption technology. The efforts of the Zama team in developing open-source tools and libraries make it possible for confidential blockchain applications like Gene Market to thrive. We extend our sincere gratitude for their pioneering work in the realm of secure data sharing.