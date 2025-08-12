
import React, { useState } from 'react';
import Icon from '../components/Icon';
import Button from '../components/Button';

type SettingsCategory = 'profile' | 'privacy' | 'notifications' | 'appearance' | 'creator' | 'account' | 'accessibility';

interface SettingsSection {
    id: SettingsCategory;
    title: string;
    icon: string;
    description: string;
}

const SettingsPage: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');
    const [settings, setSettings] = useState({
        // Profile Settings
        displayName: 'TechGuru',
        username: 'techguru',
        bio: 'Web3 educator and content creator. Making complex concepts simple.',
        website: 'https://techguru.dev',
        location: 'San Francisco, CA',
        
        // Privacy Settings
        profileVisibility: 'public' as 'public' | 'private' | 'followers',
        allowMessages: 'everyone' as 'everyone' | 'followers' | 'none',
        showOnlineStatus: true,
        allowTagging: true,
        contentVisibility: 'public' as 'public' | 'followers' | 'private',
        
        // Notification Settings
        emailNotifications: true,
        pushNotifications: true,
        commentNotifications: true,
        likeNotifications: false,
        followNotifications: true,
        liveNotifications: true,
        
        // Appearance Settings
        theme: 'system' as 'light' | 'dark' | 'system',
        language: 'en',
        autoplay: true,
        reducedMotion: false,
        
        // Creator Settings
        monetizationEnabled: true,
        analyticsEnabled: true,
        collaborationRequests: true,
        brandSafety: true,
        
        // Account Settings
        twoFactorEnabled: false,
        loginAlerts: true,
        dataDownload: false,
        
        // Accessibility Settings
        highContrast: false,
        largeText: false,
        screenReader: false,
        keyboardNavigation: true
    });

    const settingsSections: SettingsSection[] = [
        { id: 'profile', title: 'Profile', icon: 'user', description: 'Manage your public profile information' },
        { id: 'privacy', title: 'Privacy', icon: 'shield-check', description: 'Control who can see your content and interact with you' },
        { id: 'notifications', title: 'Notifications', icon: 'bell', description: 'Choose what notifications you receive' },
        { id: 'appearance', title: 'Appearance', icon: 'palette', description: 'Customize how Reelverse looks and feels' },
        { id: 'creator', title: 'Creator Studio', icon: 'video', description: 'Settings for content creators' },
        { id: 'account', title: 'Account', icon: 'settings', description: 'Account security and data management' },
        { id: 'accessibility', title: 'Accessibility', icon: 'accessibility', description: 'Make Reelverse more accessible' },
    ];

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const renderProfileSettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <img 
                            src="https://picsum.photos/seed/profile/80/80" 
                            alt="Profile" 
                            className="w-20 h-20 rounded-full object-cover"
                        />
                        <div>
                            <Button variant="outline" className="mb-2">Change Photo</Button>
                            <p className="text-sm text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Display Name</label>
                            <input
                                type="text"
                                value={settings.displayName}
                                onChange={(e) => updateSetting('displayName', e.target.value)}
                                className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">Username</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                <input
                                    type="text"
                                    value={settings.username}
                                    onChange={(e) => updateSetting('username', e.target.value)}
                                    className="w-full p-3 pl-8 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">Bio</label>
                        <textarea
                            value={settings.bio}
                            onChange={(e) => updateSetting('bio', e.target.value)}
                            rows={3}
                            className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                            maxLength={150}
                        />
                        <p className="text-xs text-muted-foreground mt-1">{settings.bio.length}/150</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Website</label>
                            <input
                                type="url"
                                value={settings.website}
                                onChange={(e) => updateSetting('website', e.target.value)}
                                className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                                placeholder="https://yourwebsite.com"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2">Location</label>
                            <input
                                type="text"
                                value={settings.location}
                                onChange={(e) => updateSetting('location', e.target.value)}
                                className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                                placeholder="City, Country"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderPrivacySettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Privacy Controls</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Profile Visibility</label>
                        <select
                            value={settings.profileVisibility}
                            onChange={(e) => updateSetting('profileVisibility', e.target.value)}
                            className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        >
                            <option value="public">Public - Anyone can see your profile</option>
                            <option value="followers">Followers only - Only your followers can see your profile</option>
                            <option value="private">Private - Only you can see your profile</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">Who can message you</label>
                        <select
                            value={settings.allowMessages}
                            onChange={(e) => updateSetting('allowMessages', e.target.value)}
                            className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        >
                            <option value="everyone">Everyone</option>
                            <option value="followers">People you follow</option>
                            <option value="none">No one</option>
                        </select>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Show online status</p>
                                <p className="text-sm text-muted-foreground">Let others see when you're active</p>
                            </div>
                            <button
                                onClick={() => updateSetting('showOnlineStatus', !settings.showOnlineStatus)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings.showOnlineStatus ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings.showOnlineStatus ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Allow tagging</p>
                                <p className="text-sm text-muted-foreground">Let others tag you in posts and comments</p>
                            </div>
                            <button
                                onClick={() => updateSetting('allowTagging', !settings.allowTagging)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings.allowTagging ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings.allowTagging ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderNotificationSettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                    {[
                        { key: 'emailNotifications', title: 'Email notifications', description: 'Receive notifications via email' },
                        { key: 'pushNotifications', title: 'Push notifications', description: 'Receive push notifications in your browser' },
                        { key: 'commentNotifications', title: 'Comments', description: 'When someone comments on your content' },
                        { key: 'likeNotifications', title: 'Likes', description: 'When someone likes your content' },
                        { key: 'followNotifications', title: 'New followers', description: 'When someone follows you' },
                        { key: 'liveNotifications', title: 'Live streams', description: 'When creators you follow go live' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{item.title}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <button
                                onClick={() => updateSetting(item.key, !settings[item.key as keyof typeof settings])}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings[item.key as keyof typeof settings] ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderAppearanceSettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">Theme</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'light', label: 'Light', icon: '☀️' },
                                { value: 'dark', label: 'Dark', icon: '🌙' },
                                { value: 'system', label: 'System', icon: '💻' },
                            ].map((theme) => (
                                <button
                                    key={theme.value}
                                    onClick={() => updateSetting('theme', theme.value)}
                                    className={`p-4 border rounded-lg text-center transition-colors ${
                                        settings.theme === theme.value
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-secondary'
                                    }`}
                                >
                                    <div className="text-2xl mb-2">{theme.icon}</div>
                                    <div className="font-medium">{theme.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium mb-2">Language</label>
                        <select
                            value={settings.language}
                            onChange={(e) => updateSetting('language', e.target.value)}
                            className="w-full p-3 bg-secondary border border-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20"
                        >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="ja">日本語</option>
                            <option value="ko">한국어</option>
                        </select>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Autoplay videos</p>
                                <p className="text-sm text-muted-foreground">Automatically play videos when scrolling</p>
                            </div>
                            <button
                                onClick={() => updateSetting('autoplay', !settings.autoplay)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings.autoplay ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings.autoplay ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Reduced motion</p>
                                <p className="text-sm text-muted-foreground">Reduce animations and transitions</p>
                            </div>
                            <button
                                onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings.reducedMotion ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings.reducedMotion ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCreatorSettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Creator Tools</h3>
                <div className="space-y-4">
                    {[
                        { key: 'monetizationEnabled', title: 'Monetization', description: 'Enable tips, subscriptions, and other monetization features' },
                        { key: 'analyticsEnabled', title: 'Analytics', description: 'Track your content performance and audience insights' },
                        { key: 'collaborationRequests', title: 'Collaboration requests', description: 'Allow other creators to send collaboration requests' },
                        { key: 'brandSafety', title: 'Brand safety', description: 'Enable brand safety filters for monetized content' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{item.title}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <button
                                onClick={() => updateSetting(item.key, !settings[item.key as keyof typeof settings])}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings[item.key as keyof typeof settings] ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderAccountSettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Account Security</h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                        <div>
                            <p className="font-medium">Two-factor authentication</p>
                            <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                        </div>
                        <Button variant={settings.twoFactorEnabled ? "default" : "outline"}>
                            {settings.twoFactorEnabled ? 'Enabled' : 'Enable'}
                        </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Login alerts</p>
                            <p className="text-sm text-muted-foreground">Get notified when someone logs into your account</p>
                        </div>
                        <button
                            onClick={() => updateSetting('loginAlerts', !settings.loginAlerts)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                settings.loginAlerts ? 'bg-primary' : 'bg-muted'
                            }`}
                        >
                            <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                settings.loginAlerts ? 'translate-x-6' : 'translate-x-0.5'
                            }`} />
                        </button>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 className="text-lg font-semibold mb-4">Data Management</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                        <div>
                            <p className="font-medium">Download your data</p>
                            <p className="text-sm text-muted-foreground">Get a copy of your Reelverse data</p>
                        </div>
                        <Button variant="outline">
                            <Icon name="download" className="mr-2" size={16} />
                            Download
                        </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div>
                            <p className="font-medium text-red-600">Delete account</p>
                            <p className="text-sm text-red-600/80">Permanently delete your account and all data</p>
                        </div>
                        <Button variant="destructive">
                            Delete Account
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAccessibilitySettings = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">Accessibility Options</h3>
                <div className="space-y-4">
                    {[
                        { key: 'highContrast', title: 'High contrast', description: 'Increase contrast for better visibility' },
                        { key: 'largeText', title: 'Large text', description: 'Increase text size throughout the app' },
                        { key: 'screenReader', title: 'Screen reader support', description: 'Optimize for screen reader users' },
                        { key: 'keyboardNavigation', title: 'Keyboard navigation', description: 'Enable full keyboard navigation' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{item.title}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <button
                                onClick={() => updateSetting(item.key, !settings[item.key as keyof typeof settings])}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings[item.key as keyof typeof settings] ? 'bg-primary' : 'bg-muted'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                                    settings[item.key as keyof typeof settings] ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeCategory) {
            case 'profile': return renderProfileSettings();
            case 'privacy': return renderPrivacySettings();
            case 'notifications': return renderNotificationSettings();
            case 'appearance': return renderAppearanceSettings();
            case 'creator': return renderCreatorSettings();
            case 'account': return renderAccountSettings();
            case 'accessibility': return renderAccessibilitySettings();
            default: return renderProfileSettings();
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
                <div className="p-6">
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">Manage your account preferences and settings</p>
                </div>
            </div>

            <div className="p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Instagram-style Settings Navigation */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-32 space-y-2">
                                {settingsSections.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveCategory(section.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                                            activeCategory === section.id
                                                ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Icon name={section.icon as any} size={20} />
                                        <div>
                                            <p className="font-medium">{section.title}</p>
                                            <p className="text-xs opacity-80">{section.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Settings Content */}
                        <div className="lg:col-span-3">
                            <div className="bg-secondary/30 rounded-xl p-6">
                                {renderContent()}
                                
                                {/* Save Button */}
                                <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-border">
                                    <Button variant="outline">Cancel</Button>
                                    <Button>Save Changes</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
