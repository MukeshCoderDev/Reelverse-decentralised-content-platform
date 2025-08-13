import { WalletError, WalletErrorType } from '../types/wallet';

export class WalletErrorHandler {
  static handleError(error: any): WalletError {
    // Handle user rejection errors
    if (this.isUserRejection(error)) {
      return {
        type: WalletErrorType.USER_REJECTED,
        message: 'Connection was rejected by user',
        originalError: error
      };
    }

    // Handle wallet not found errors
    if (this.isWalletNotFound(error)) {
      return {
        type: WalletErrorType.WALLET_NOT_FOUND,
        message: 'Wallet not found. Please install the wallet extension.',
        originalError: error
      };
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return {
        type: WalletErrorType.NETWORK_ERROR,
        message: 'Network connection failed. Please check your internet connection.',
        originalError: error
      };
    }

    // Handle unsupported network errors
    if (this.isUnsupportedNetwork(error)) {
      return {
        type: WalletErrorType.UNSUPPORTED_NETWORK,
        message: 'This network is not supported. Please switch to a supported network.',
        originalError: error
      };
    }

    // Handle transaction errors
    if (this.isTransactionError(error)) {
      return {
        type: WalletErrorType.TRANSACTION_FAILED,
        message: 'Transaction failed. Please try again.',
        originalError: error
      };
    }

    // Default connection error
    return {
      type: WalletErrorType.CONNECTION_FAILED,
      message: error?.message || 'Failed to connect wallet. Please try again.',
      originalError: error
    };
  }

  static isUserRejection(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code;
    
    return (
      code === 4001 || // MetaMask user rejection
      code === -32002 || // MetaMask request pending
      message.includes('user rejected') ||
      message.includes('user denied') ||
      message.includes('rejected by user') ||
      message.includes('cancelled by user')
    );
  }

  static isWalletNotFound(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return (
      message.includes('no ethereum provider') ||
      message.includes('wallet not found') ||
      message.includes('provider not found') ||
      message.includes('no injected provider')
    );
  }

  static isNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return (
      message.includes('network error') ||
      message.includes('fetch failed') ||
      message.includes('connection failed') ||
      message.includes('timeout')
    );
  }

  static isUnsupportedNetwork(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code;
    
    return (
      code === -32602 || // Invalid params (often network related)
      message.includes('unsupported network') ||
      message.includes('unrecognized chain') ||
      message.includes('invalid chain')
    );
  }

  static isTransactionError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return (
      message.includes('transaction failed') ||
      message.includes('insufficient funds') ||
      message.includes('gas estimation failed') ||
      message.includes('nonce too low')
    );
  }

  static shouldRetry(error: WalletError): boolean {
    return [
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.CONNECTION_FAILED
    ].includes(error.type);
  }

  static getUserFriendlyMessage(error: WalletError): string {
    switch (error.type) {
      case WalletErrorType.USER_REJECTED:
        return 'Connection cancelled. Please try again when ready.';
      
      case WalletErrorType.WALLET_NOT_FOUND:
        return 'Wallet not detected. Please install the wallet extension and refresh the page.';
      
      case WalletErrorType.NETWORK_ERROR:
        return 'Connection failed. Please check your internet connection and try again.';
      
      case WalletErrorType.UNSUPPORTED_NETWORK:
        return 'Please switch to a supported network (Ethereum, Polygon, BNB Chain, Arbitrum, Optimism, or Avalanche).';
      
      case WalletErrorType.TRANSACTION_FAILED:
        return 'Transaction failed. Please check your balance and try again.';
      
      case WalletErrorType.CONNECTION_FAILED:
      default:
        return 'Failed to connect. Please try again or contact support if the issue persists.';
    }
  }
}