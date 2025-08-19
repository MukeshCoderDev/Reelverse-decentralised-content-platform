import React, { useState } from 'react';
import { sponsorAndSend } from '../../utils/sponsorAndSend';
import { ethers } from 'ethers';
import { useSessionKey } from '../wallet/SessionKeyProvider'; // Assuming this path

interface SponsoredActionButtonProps {
  target: 'like' | 'access';
  contentId: string; // Or any identifier for the content
}

const SponsoredActionButton: React.FC<SponsoredActionButtonProps> = ({ target, contentId }) => {
  const [status, setStatus] = useState<'idle' | 'sponsoring' | 'signing' | 'submitted' | 'confirmed' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { smartAccountAddress, sessionKeyInfo, loading: sessionLoading, error: sessionError } = useSessionKey();

  const handleClick = async () => {
    setStatus('sponsoring');
    setTxHash(null);
    setUserOpHash(null);
    setErrorMessage(null);

    try {
      // Using Sepolia WETH contract and calling its symbol() function as a harmless read-only call
      const targetContractAddress = '0xfFf9976782d46CC05630D1f6eB9Fe03089d87603'; // Sepolia WETH contract
      const targetContractABI = ['function symbol() view returns (string)'];
      const iface = new ethers.Interface(targetContractABI);
      const callData = iface.encodeFunctionData('symbol', []);

      const result = await sponsorAndSend(targetContractAddress, callData);
      setUserOpHash(result.userOpHash);
      setStatus('submitted');

      if (result.txHash) {
        setTxHash(result.txHash);
        setStatus('confirmed');
      } else {
        // If txHash is not immediately available, we might need to poll or wait for backend to update
        // For this demo, we'll just show submitted and rely on backend polling for E2E test.
        // In a real app, you'd have a mechanism to update txHash once confirmed.
      }

    } catch (err: any) {
      console.error('Sponsored action failed:', err);
      setErrorMessage(err.message || 'An unknown error occurred.');
      setStatus('error');
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={status === 'sponsoring' || status === 'submitted' || sessionLoading}>
        {status === 'idle' && `Sponsor & ${target === 'like' ? 'Like' : 'Access'}`}
        {status === 'sponsoring' && 'Sponsoring...'}
        {status === 'submitted' && 'Submitted (waiting for confirmation)...'}
        {status === 'confirmed' && 'Confirmed!'}
        {status === 'error' && 'Error!'}
      </button>
      {sessionLoading && <p>Loading session info...</p>}
      {sessionError && <p style={{ color: 'red' }}>Session Error: {sessionError}</p>}
      {smartAccountAddress && <p>Smart Account: {smartAccountAddress}</p>}
      {sessionKeyInfo && <p>Session Key Active: {sessionKeyInfo.publicKey.slice(0, 10)}...</p>}
      {userOpHash && <p>UserOp Hash: {userOpHash}</p>}
      {txHash && <p>Tx Hash: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">{txHash}</a></p>}
      {errorMessage && <p style={{ color: 'red' }}>Error: {errorMessage}</p>}
    </div>
  );
};

export default SponsoredActionButton;