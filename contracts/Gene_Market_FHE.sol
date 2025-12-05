pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract GeneMarketFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public isBatchOpen;
    mapping(uint256 => uint256) public batchSubmissionCount;

    struct EncryptedGeneticData {
        euint32[] dataPoints; // Array of FHE encrypted uint32 values representing genetic markers
    }
    mapping(uint256 => mapping(address => EncryptedGeneticData)) public batchGeneticData; // batchId => provider => data

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    // Custom Errors
    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosed();
    error InvalidBatch();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidProof();
    error AlreadyProcessed();
    error EmptyBatch();
    error InvalidCooldown();

    // Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PausedContract(address indexed account);
    event UnpausedContract(address indexed account);
    event CooldownSet(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId, uint256 totalSubmissions);
    event GeneticDataSubmitted(address indexed provider, uint256 indexed batchId, uint256 count);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, bytes32 stateHash);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 result);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier respectSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier respectDecryptionCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true; // Deployer is initially a provider
        emit ProviderAdded(owner);
        cooldownSeconds = 60; // Default cooldown of 1 minute
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit PausedContract(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit UnpausedContract(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        if (newCooldownSeconds == 0) revert InvalidCooldown();
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSet(oldCooldownSeconds, newCooldownSeconds);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        isBatchOpen[currentBatchId] = true;
        batchSubmissionCount[currentBatchId] = 0;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch(uint256 batchId) external onlyOwner whenNotPaused {
        if (!isBatchOpen[batchId]) revert BatchClosed();
        isBatchOpen[batchId] = false;
        emit BatchClosed(batchId, batchSubmissionCount[batchId]);
    }

    function submitEncryptedGeneticData(
        uint256 batchId,
        euint32[] calldata _dataPoints
    ) external onlyProvider whenNotPaused respectSubmissionCooldown {
        if (!isBatchOpen[batchId]) revert BatchClosed();
        if (_dataPoints.length == 0) revert EmptyBatch();

        lastSubmissionTime[msg.sender] = block.timestamp;

        EncryptedGeneticData storage data = batchGeneticData[batchId][msg.sender];
        // Overwrite or initialize
        delete data.dataPoints; // Clear previous data if any
        for (uint i = 0; i < _dataPoints.length; i++) {
            data.dataPoints.push(_initIfNeeded(_dataPoints[i]));
        }
        batchSubmissionCount[batchId]++;

        emit GeneticDataSubmitted(msg.sender, batchId, _dataPoints.length);
    }

    function requestResearchCalculation(uint256 batchId)
        external
        onlyProvider
        whenNotPaused
        respectDecryptionCooldown
    {
        if (batchSubmissionCount[batchId] == 0) revert EmptyBatch();

        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        euint32 encryptedSum = FHE.asEuint32(0); // Initialize encrypted sum
        bool initialized = false;

        // Iterate through all providers who submitted data for this batch
        // This simplified logic assumes we iterate through known providers or a fixed list.
        // For a production system, you'd need a more robust way to iterate or select data.
        // Here, we'll sum data from the caller for simplicity.
        if (batchGeneticData[batchId][msg.sender].dataPoints.length > 0) {
            for (uint i = 0; i < batchGeneticData[batchId][msg.sender].dataPoints.length; i++) {
                euint32 dataPoint = batchGeneticData[batchId][msg.sender].dataPoints[i];
                if (!initialized) {
                    encryptedSum = dataPoint;
                    initialized = true;
                } else {
                    encryptedSum = encryptedSum.add(dataPoint);
                }
            }
        }
        
        // If no data was processed (e.g., caller had no data or batch was empty for them)
        if (!initialized) {
            encryptedSum = FHE.asEuint32(0); // Ensure it's initialized
        }


        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(encryptedSum);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({
            batchId: batchId,
            stateHash: stateHash,
            processed: false
        });

        emit DecryptionRequested(requestId, batchId, stateHash);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();
        // Security: Replay protection ensures a callback for a given requestId is processed only once.

        DecryptionContext memory ctx = decryptionContexts[requestId];
        bytes32 currentHash = _reconstructAndHashCleartextsForCallback(ctx.batchId);
        // Security: State verification ensures that the contract's state relevant to the decryption
        // (specifically, the ciphertexts that were supposed to be decrypted) has not changed
        // since the decryption was requested. This prevents scenarios where an attacker might
        // alter the data after a request but before decryption, leading to inconsistent results.
        if (currentHash != ctx.stateHash) revert StateMismatch();

        // Security: Proof verification ensures that the cleartexts were indeed decrypted by the FHEVM
        // network from the ciphertexts associated with this request, and that the decryption was
        // performed correctly and is attested by the network.
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) revert InvalidProof();

        uint256 result = abi.decode(cleartexts, (uint256));
        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, ctx.batchId, result);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal view returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _reconstructAndHashCleartextsForCallback(uint256 batchId) internal view returns (bytes32) {
        // This function must reconstruct the `bytes32[] memory cts` array
        // in the *exact same order and content* as it was when `requestResearchCalculation`
        // was called for the given `batchId` and the `requestId` that led to this callback.
        // This simplified example assumes we are reconstructing the sum for the caller of `requestResearchCalculation`.
        // A more robust implementation would need to store or deterministically regenerate the exact list of ciphertexts.

        // For this example, we'll re-calculate the sum for the provider who initiated the request.
        // This is a simplification. A real system would need to know *which* provider's data was summed.
        // Let's assume `msg.sender` of `requestResearchCalculation` is the one whose data was summed.
        // This is NOT directly available in the callback. The `batchId` is stored in `DecryptionContext`.
        // The original `msg.sender` of `requestResearchCalculation` is lost unless explicitly stored.
        // For this example, we'll assume the callback logic implicitly knows or can derive it.
        // A more robust approach: store the provider address in `DecryptionContext`.

        // To keep this example self-contained and simple, we will assume the callback is for a sum
        // calculated from the data of a *specific* provider, and that provider's address was the `msg.sender`
        // of `requestResearchCalculation`. We cannot get `msg.sender` of `requestResearchCalculation` here.
        // This highlights a limitation of this simplified example.
        // For a real system, `DecryptionContext` should store all necessary info to reconstruct `cts`.

        // Let's assume for the purpose of this example that the `requestResearchCalculation`
        // was called by `owner` and we are summing owner's data.
        // THIS IS A SIMPLIFICATION FOR DEMONSTRATION.
        address dataProvider = owner; // Placeholder - this should be the actual provider whose data was summed.

        euint32 reconstructedEncryptedSum = FHE.asEuint32(0);
        bool initialized = false;
        if (batchGeneticData[batchId][dataProvider].dataPoints.length > 0) {
            for (uint i = 0; i < batchGeneticData[batchId][dataProvider].dataPoints.length; i++) {
                euint32 dataPoint = batchGeneticData[batchId][dataProvider].dataPoints[i];
                if (!initialized) {
                    reconstructedEncryptedSum = dataPoint;
                    initialized = true;
                } else {
                    reconstructedEncryptedSum = reconstructedEncryptedSum.add(dataPoint);
                }
            }
        }
        if (!initialized) { // If no data points, ensure it's initialized to 0
             reconstructedEncryptedSum = FHE.asEuint32(0);
        }

        bytes32[] memory reconstructedCts = new bytes32[](1);
        reconstructedCts[0] = FHE.toBytes32(reconstructedEncryptedSum);
        return _hashCiphertexts(reconstructedCts);
    }

    function _initIfNeeded(euint32 val) internal returns (euint32) {
        if (!FHE.isInitialized(val)) {
            return FHE.asEuint32(0); // Or handle uninitialized values as appropriate for your logic
        }
        return val;
    }
}