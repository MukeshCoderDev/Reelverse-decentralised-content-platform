
import React from 'react';

export function Categories({ categories }: { categories: { id: string; name: string; }[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {categories.map(c => (
                <button key={c.id} className="rounded-full border border-border bg-secondary px-4 py-1.5 text-sm hover:bg-muted focus:bg-primary focus:text-primary-foreground focus:border-primary transition-colors">
                    {c.name}
                </button>
            ))}
        </div>
    );
}
