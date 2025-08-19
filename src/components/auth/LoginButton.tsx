import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

const LoginButton: React.FC = () => {
  const { login, logout, authenticated, user } = usePrivy();

  if (authenticated) {
    return (
      <div>
        <p>Welcome, {user?.email || user?.id}!</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <button onClick={login}>Login with Privy</button>
  );
};

export default LoginButton;