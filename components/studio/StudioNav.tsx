
import React from 'react';
import { NavLink } from "react-router-dom";
import { sidebar } from '../../config/sidebar';

const studioItems = sidebar.find(g => g.group === "Studio")?.items || [];

export function StudioNav() {
    return (
        <aside className="w-56 shrink-0">
            <nav className="space-y-1">
                {studioItems.map(i => (
                    <NavLink
                        key={i.id}
                        to={i.route}
                        end={i.route === '/studio'} // 'end' prop for index route matching
                        className={({ isActive }) =>
                            `block rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors ${
                                isActive ? 'bg-secondary font-semibold text-primary-foreground' : 'text-muted-foreground'
                            }`
                        }
                    >
                        {i.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
