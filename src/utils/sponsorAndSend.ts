import axios from 'axios';

interface SponsorAndSendResult {
  userOpHash: string;
  txHash?: string;
}

export async function sponsorAndSend(to: string, data: string, value: string = '0'): Promise<SponsorAndSendResult> {
  try {
    const response = await axios.post('/api/aa/sponsor-and-send', {
      to,
      data,
      value,
    });
    return response.data;
  } catch (error: any) {
    console.error('Error in sponsorAndSend:', error);
    throw new Error(error.response?.data?.error || 'Failed to sponsor and send transaction.');
  }
}