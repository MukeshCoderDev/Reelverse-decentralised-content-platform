
import React, { useState } from 'react';
import { benchmarks } from '../../lib/benchmarks';
import Icon from '../Icon';
import { WalletButton } from '../wallet/WalletButton';
import { flags } from "../../src/config/flags";
import { useAuth } from '../../src/auth/AuthProvider'; // Import useAuth
import { SignInButton } from '../../src/components/auth/SignInButton'; // Import SignInButton
import { ProfileMenu } from '../../src/components/auth/ProfileMenu'; // Import ProfileMenu

export function PageHeader({ id, title, actions }: { id: keyof typeof benchmarks; title: string; actions?: React.ReactNode }) {
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const { isAuthenticated } = useAuth(); // Use auth context

    return (
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{title}</h1>
                <div 
                    className="relative"
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                >
                    <Icon name="info" className="h-4 w-4 text-rv-muted cursor-help" />
                    {tooltipVisible && (
                        <div className="absolute left-0 top-full mt-2 w-max max-w-xs z-10 bg-rv-elev text-rv-text rounded-rv-md px-3 py-2 text-sm shadow-rv-1">
                            <p className="font-semibold">Benchmarked Against:</p>
                            <p>{benchmarks[id]}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {flags.showWalletUI && <div className="wallet-ui"><WalletButton /></div>}
                {!flags.showWalletUI && <div style={{width: 0, height: 0}} aria-hidden />}
                {isAuthenticated ? <ProfileMenu /> : <SignInButton />} {/* Conditional rendering */}
                {actions}
            </div>
        </div>
    );
}
