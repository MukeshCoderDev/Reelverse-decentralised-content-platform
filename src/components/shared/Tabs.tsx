// src/components/shared/Tabs.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";

interface TabsContextType {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  children,
  activeTab,
  onTabChange,
}) => {
  return (
    <TabsContext.Provider value={{ activeTab, onTabChange }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
};

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className }) => {
  return <div className={className || "flex border-b border-gray-200 mb-4"}>{children}</div>;
};

interface TabProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const Tab: React.FC<TabProps> = ({ id, children, className }) => {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error("Tab must be used within Tabs");
  }
  const { activeTab, onTabChange } = context;
  const isActive = activeTab === id;

  return (
    <button
      className={className || `py-2 px-4 text-sm font-medium focus:outline-none ${
        isActive
          ? "border-b-2 border-blue-500 text-blue-600"
          : "text-gray-500 hover:text-gray-700"
      }`}
      onClick={() => onTabChange(id)}
    >
      {children}
    </button>
  );
};

interface TabPanelProps {
  id: string;
  children: ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, children }) => {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error("TabPanel must be used within Tabs");
  }
  const { activeTab } = context;

  return activeTab === id ? <div className="tab-panel">{children}</div> : null;
};
