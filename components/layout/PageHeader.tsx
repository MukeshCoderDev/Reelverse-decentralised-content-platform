
import React, { useState } from 'react';
import { benchmarks } from '../../lib/benchmarks';
import Icon from '../Icon';
import { WalletButton } from '../wallet/WalletButton';

export function PageHeader({ id, title, actions }: { id: keyof typeof benchmarks; title: string; actions?: React.ReactNode }) {
    const [tooltipVisible, setTooltipVisible] = useState(false);

    return (
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{title}</h1>
                <div 
                    className="relative"
                    onMouseEnter={() => setTooltipVisible(true)}
                    onMouseLeave={() => setTooltipVisible(false)}
                >
                    <Icon name="info" className="h-4 w-4 text-muted-foreground cursor-help" />
                    {tooltipVisible && (
                        <div className="absolute left-0 top-full mt-2 w-max max-w-xs z-10 bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-sm shadow-lg">
                            <p className="font-semibold">Benchmarked Against:</p>
                            <p>{benchmarks[id]}</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <WalletButton />
                {actions}
            </div>
        </div>
    );
}
