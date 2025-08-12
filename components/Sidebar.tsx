import React from 'react';
import { NavLink } from 'react-router-dom';
import { sidebar } from '../config/sidebar';
import { SidebarGroup, SidebarItem, IconName } from '../types';
import Icon from './Icon';
import Button from './Button';

const Sidebar: React.FC = () => {
  // In a real app, this would come from user state
  const userRole = 'creator'; 

  return (
    <aside className="w-64 flex-shrink-0 bg-zinc-900/70 backdrop-blur-xl border-r border-border p-4 flex flex-col space-y-2 overflow-y-auto">
      <div className="px-2 pb-4 mb-2 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">Reelverse</h1>
      </div>
      
      {sidebar.map((group, index) => {
        if (group.featureFlag) return null;
        if (group.role && group.role !== userRole) return null;

        if (group.intent === 'primary') {
           const item = group.items[0];
            return (
              <NavLink to={item.route} key={item.id} className="w-full">
                {({ isActive }) => (
                  <Button variant={isActive ? 'default' : 'secondary'} className="w-full justify-start text-base">
                    <Icon name={item.icon} className="mr-3" /> {item.label}
                  </Button>
                )}
              </NavLink>
            );
        }

        return (
          <div key={group.group || index}>
            {group.group && <h2 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">{group.group}</h2>}
            <ul className="space-y-1">
              {group.items.map((item) => {
                 if (item.role && item.role !== userRole) return null;
                 return (
                  <li key={item.id}>
                    <NavLink to={item.route} className="block">
                      {({ isActive }) => (
                        <span className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-primary/20 text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'}`}>
                          <Icon name={item.icon} className="mr-3" />
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  </li>
                 );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
};

export default Sidebar;