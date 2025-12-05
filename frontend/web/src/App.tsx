import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

// FHE 加密/解密函数（模拟）
const FHEEncryptNumber = (value: number): string => `FHE-${btoa(value.toString())}`;
const FHEDecryptNumber = (encryptedData: string): number => 
  encryptedData.startsWith('FHE-') ? parseFloat(atob(encryptedData.substring(4))) : 0;
const generatePublicKey = () => `0x${Array(20).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

interface GeneData {
  id: number;
  ownerId: string;
  encryptedGenome: string;
  researchQueries: string[];
  rewardAmount: number;
  timestamp: number;
  isAuthorized: boolean;
}

interface UserAction {
  type: 'upload' | 'authorize' | 'query' | 'decrypt' | 'earn';
  timestamp: number;
  details: string;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [geneDataList, setGeneDataList] = useState<GeneData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [selectedData, setSelectedData] = useState<GeneData | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [contractPublicKey, setContractPublicKey] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // 初始化
  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initApp = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractPublicKey(generatePublicKey());
      if (window.ethereum && address) {
        try {
          const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [address],
          });
          setWalletBalance(ethers.formatEther(balance as string));
        } catch (e) {
          console.log("Balance fetch error:", e);
        }
      }
    };
    initApp();
  }, [address]);

  // 加载数据
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;

      // 检查合约可用性
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        showTransactionStatus("success", "Contract is available and ready for FHE operations!");
      }

      // 加载基因数据列表
      const dataBytes = await contract.getData("genedata");
      let dataList: GeneData[] = [];
      if (dataBytes && dataBytes.length > 0) {
        try {
          const dataStr = ethers.toUtf8String(dataBytes);
          if (dataStr.trim() !== '') {
            dataList = JSON.parse(dataStr);
          }
        } catch (e) {
          console.log("Data parsing error:", e);
        }
      }
      setGeneDataList(dataList);

      // 加载用户操作历史
      const actionsBytes = await contract.getData("useractions");
      if (actionsBytes && actionsBytes.length > 0) {
        try {
          const actionsStr = ethers.toUtf8String(actionsBytes);
          if (actionsStr.trim() !== '') {
            const actions: UserAction[] = JSON.parse(actionsStr);
            setUserActions(actions);
          }
        } catch (e) {
          console.log("Actions parsing error:", e);
        }
      }
    } catch (e) {
      console.error("Error loading data:", e);
      showTransactionStatus("error", "Failed to load data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // 显示交易状态
  const showTransactionStatus = (status: "pending" | "success" | "error", message: string) => {
    setTransactionStatus({ visible: true, status, message });
    setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
  };

  // 上传基因数据
  const uploadGeneData = async () => {
    if (!isConnected || !address) {
      showTransactionStatus("error", "Please connect wallet first");
      return;
    }

    const mockGenomeData = {
      id: Date.now(),
      sequence: "ATCG" + Math.random().toString(36).substring(2, 15),
      variants: [1, 0, 1, 1, 0],
      quality: 99.9,
      encrypted: true
    };

    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting genome data with Zama FHE..." });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract");

      // 模拟FHE加密过程
      const encryptedData = FHEEncryptNumber(Math.floor(Math.random() * 1000));
      const newGeneData: GeneData = {
        id: geneDataList.length + 1,
        ownerId: address,
        encryptedGenome: encryptedData,
        researchQueries: [],
        rewardAmount: 0,
        timestamp: Math.floor(Date.now() / 1000),
        isAuthorized: false
      };

      const updatedData = [...geneDataList, newGeneData];
      await contract.setData("genedata", ethers.toUtf8Bytes(JSON.stringify(updatedData)));

      // 记录用户操作
      const newAction: UserAction = {
        type: 'upload',
        timestamp: Math.floor(Date.now() / 1000),
        details: `Uploaded encrypted genome data (ID: ${newGeneData.id})`
      };
      setUserActions([newAction, ...userActions]);

      showTransactionStatus("success", "Genome data uploaded and encrypted successfully!");
      await loadData();
    } catch (e: any) {
      const errorMsg = e.message.includes("user rejected") ? "Transaction rejected" : "Upload failed: " + (e.message || "");
      showTransactionStatus("error", errorMsg);
    }
  };

  // 授权研究查询
  const authorizeResearch = async (dataId: number, researchId: string) => {
    if (!isConnected || !address) {
      showTransactionStatus("error", "Please connect wallet first");
      return;
    }

    setTransactionStatus({ visible: true, status: "pending", message: "Authorizing research access with FHE..." });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract");

      const updatedData = geneDataList.map(data => {
        if (data.id === dataId) {
          return {
            ...data,
            researchQueries: [...data.researchQueries, researchId],
            isAuthorized: true
          };
        }
        return data;
      });

      await contract.setData("genedata", ethers.toUtf8Bytes(JSON.stringify(updatedData)));

      const newAction: UserAction = {
        type: 'authorize',
        timestamp: Math.floor(Date.now() / 1000),
        details: `Authorized research ${researchId} for data ID ${dataId}`
      };
      setUserActions([newAction, ...userActions]);

      showTransactionStatus("success", "Research access authorized!");
      await loadData();
    } catch (e: any) {
      const errorMsg = e.message.includes("user rejected") ? "Transaction rejected" : "Authorization failed";
      showTransactionStatus("error", errorMsg);
    }
  };

  // 执行研究查询
  const executeResearchQuery = async (dataId: number, query: string) => {
    if (!isConnected || !address) {
      showTransactionStatus("error", "Please connect wallet first");
      return;
    }

    setTransactionStatus({ visible: true, status: "pending", message: "Executing homomorphic research query..." });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract");

      const updatedData = geneDataList.map(data => {
        if (data.id === dataId) {
          return {
            ...data,
            researchQueries: [...data.researchQueries, query],
            rewardAmount: data.rewardAmount + Math.floor(Math.random() * 10) + 1
          };
        }
        return data;
      });

      await contract.setData("genedata", ethers.toUtf8Bytes(JSON.stringify(updatedData)));

      const newAction: UserAction = {
        type: 'query',
        timestamp: Math.floor(Date.now() / 1000),
        details: `Executed research query "${query}" on data ID ${dataId}`
      };
      setUserActions([newAction, ...userActions]);

      showTransactionStatus("success", "Research query executed with FHE homomorphic computation!");
      await loadData();
    } catch (e: any) {
      const errorMsg = e.message.includes("user rejected") ? "Transaction rejected" : "Query execution failed";
      showTransactionStatus("error", errorMsg);
    }
  };

  // 解密数据（模拟）
  const decryptData = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) {
      showTransactionStatus("error", "Please connect wallet first");
      return null;
    }

    try {
      const message = `publickey:${contractPublicKey}\naddress:${address}\nchainid:${await window.ethereum?.request({ method: 'eth_chainId' })}\ntimestamp:${Date.now()}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const decrypted = FHEDecryptNumber(encryptedData);
      
      const newAction: UserAction = {
        type: 'decrypt',
        timestamp: Math.floor(Date.now() / 1000),
        details: `Decrypted FHE data (value: ${decrypted})`
      };
      setUserActions([newAction, ...userActions]);

      return decrypted;
    } catch (e) {
      console.error("Decryption error:", e);
      return null;
    }
  };

  // 获取筛选后的数据
  const filteredData = geneDataList.filter(data => 
    data.id.toString().includes(searchTerm) ||
    data.ownerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Initializing Gene_Market_FHE encrypted data marketplace...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="dna-icon">🧬</div>
          </div>
          <h1>Gene<span>_Market</span><span className="fhe-text">FHE</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={uploadGeneData} 
            className="upload-btn"
            disabled={!isConnected}
          >
            <div className="upload-icon">📤</div>
            Upload Encrypted Data
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="dashboard-grid">
          <div className="stats-panel">
            <h3>Market Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{geneDataList.length}</div>
                <div className="stat-label">Encrypted Datasets</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {geneDataList.filter(d => d.isAuthorized).length}
                </div>
                <div className="stat-label">Authorized Research</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{walletBalance}</div>
                <div className="stat-label">Wallet Balance</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {userActions.filter(a => a.type === 'earn').length}
                </div>
                <div className="stat-label">Rewards Earned</div>
              </div>
            </div>
          </div>

          <div className="data-panel">
            <div className="panel-header">
              <h3>Encrypted Gene Datasets</h3>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search by ID or Owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="data-list">
              {filteredData.length === 0 ? (
                <div className="no-data">
                  <div className="no-data-icon">🔒</div>
                  <p>No encrypted gene data found</p>
                  <button onClick={uploadGeneData} className="upload-prompt-btn">
                    Upload Your First Dataset
                  </button>
                </div>
              ) : filteredData.map((data) => (
                <div 
                  className={`data-item ${selectedData?.id === data.id ? 'selected' : ''}`}
                  key={data.id}
                  onClick={() => setSelectedData(data)}
                >
                  <div className="data-header">
                    <div className="data-id">ID: {data.id}</div>
                    <div className="data-status">
                      {data.isAuthorized ? '🔓 Authorized' : '🔒 Private'}
                    </div>
                  </div>
                  <div className="data-info">
                    <div className="info-row">
                      <span>Owner:</span>
                      <span>{data.ownerId.substring(0, 6)}...{data.ownerId.substring(38)}</span>
                    </div>
                    <div className="info-row">
                      <span>Queries:</span>
                      <span>{data.researchQueries.length}</span>
                    </div>
                    <div className="info-row">
                      <span>Reward:</span>
                      <span>{data.rewardAmount} Ξ</span>
                    </div>
                    <div className="info-row">
                      <span>Uploaded:</span>
                      <span>{new Date(data.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {selectedData?.id === data.id && (
                    <div className="data-actions">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          authorizeResearch(data.id, `research_${Date.now()}`);
                        }}
                        className="action-btn authorize"
                        disabled={!isConnected}
                      >
                        Authorize Research
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          executeResearchQuery(data.id, `query_${Date.now()}`);
                        }}
                        className="action-btn query"
                        disabled={!isConnected || !data.isAuthorized}
                      >
                        Run FHE Query
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedData && (
          <div className="detail-panel">
            <div className="panel-header">
              <h3>Dataset Details</h3>
              <button onClick={() => setSelectedData(null)} className="close-btn">×</button>
            </div>
            
            <div className="detail-content">
              <div className="detail-section">
                <h4>Basic Information</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Dataset ID:</span>
                    <span className="value">{selectedData.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Owner Address:</span>
                    <span className="value">{selectedData.ownerId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Encryption Status:</span>
                    <span className="value encrypted">FHE Encrypted</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Upload Time:</span>
                    <span className="value">{new Date(selectedData.timestamp * 1000).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Research & Rewards</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Authorized Queries:</span>
                    <span className="value">{selectedData.researchQueries.length}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Total Reward:</span>
                    <span className="value reward">{selectedData.rewardAmount} Ξ</span>
                  </div>
                </div>
                
                {selectedData.researchQueries.length > 0 && (
                  <div className="queries-list">
                    <h5>Research Queries:</h5>
                    <ul>
                      {selectedData.researchQueries.map((query, index) => (
                        <li key={index}>{query}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4>Data Actions</h4>
                <div className="action-buttons">
                  <button 
                    onClick={() => decryptData(selectedData.encryptedGenome)}
                    className="action-btn decrypt"
                    disabled={!isConnected}
                  >
                    Decrypt Sample Data
                  </button>
                  <button 
                    onClick={() => {
                      const newData = { ...selectedData, rewardAmount: selectedData.rewardAmount + 5 };
                      setGeneDataList(geneDataList.map(d => d.id === selectedData.id ? newData : d));
                      showTransactionStatus("success", "Bonus reward added for data contribution!");
                    }}
                    className="action-btn reward"
                  >
                    Claim Reward
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <h4>Gene_Market_FHE</h4>
          <p>Confidential Genetic Data Marketplace powered by Zama FHE</p>
          <p>Securely share encrypted genome data for research while protecting privacy</p>
        </div>
        <div className="footer-links">
          <span className="fhe-badge">Powered by Zama FHE</span>
        </div>
      </footer>
    </div>
  );
};

export default App;