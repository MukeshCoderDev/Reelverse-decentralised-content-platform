
import React from 'react';
import Icon from '../Icon';
import { IconName } from '../../types';

export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
    return (
        <div className="flex h-[60vh] items-center justify-center rounded-md border bg-muted/30">
            <div className="text-center">
                <div className="mb-3 flex justify-center text-muted-foreground">
                    <Icon name={icon} size={48} />
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
        </div>
    );
}
