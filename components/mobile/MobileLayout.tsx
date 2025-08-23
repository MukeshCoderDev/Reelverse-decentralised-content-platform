import React, { useState, useEffect } from 'react';
import { MobileBottomNav } from './MobileBottomNav';
import Header from '../Header';
import Sidebar from '../Sidebar';

interface MobileLayoutProps {
    children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle swipe gestures for mobile navigation
    useEffect(() => {
        if (!isMobile) return;

        let startX = 0;
        let startY = 0;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = endY - startY;

            // Swipe right from left edge to open sidebar
            if (Math.abs(diffX) > Math.abs(diffY) && diffX > 100 && startX < 50) {
                setShowSidebar(true);
            }
            // Swipe left to close sidebar
            else if (Math.abs(diffX) > Math.abs(diffY) && diffX < -100 && showSidebar) {
                setShowSidebar(false);
            }
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isMobile, showSidebar]);

    if (!isMobile) {
        // Desktop layout with Header and Sidebar
        return (
            <div className="flex h-screen bg-background text-foreground">
                <Sidebar />
                <div className="flex-1 flex flex-col">
                    <Header title="Reelverse" />
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        );
    }

    // Mobile layout with bottom navigation
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            {/* Header with navigation */}
            <Header title="Reelverse" onMenuClick={() => setShowSidebar(true)} />
            
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-20">
                {children}
            </main>
            
            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
            
            {/* Mobile Sidebar Overlay */}
            {showSidebar && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setShowSidebar(false)}
                    />
                    
                    {/* Sidebar */}
                    <div className="fixed left-0 top-0 bottom-0 w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-out">
                        <div className="h-full overflow-y-auto">
                            <Sidebar />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};