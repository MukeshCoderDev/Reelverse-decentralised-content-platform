import React, { useState, useEffect } from 'react';
import Button from '../Button';
import { Card } from '../ui/Card';

interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
  third_party: boolean;
}

interface CookieConsentManagerProps {
  onConsentChange?: (preferences: ConsentPreferences) => void;
  showBanner?: boolean;
  position?: 'bottom' | 'top';
}

export const CookieConsentManager: React.FC<CookieConsentManagerProps> = ({
  onConsentChange,
  showBanner = true,
  position = 'bottom'
}) => {
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true, // Always required
    analytics: false,
    marketing: false,
    personalization: false,
    third_party: false,
  });
  const [hasConsented, setHasConsented] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const savedConsent = localStorage.getItem('cookie_consent');
    if (savedConsent) {
      const consentData = JSON.parse(savedConsent);
      setPreferences(consentData.preferences);
      setHasConsented(true);
      setShowConsentBanner(false);
    } else if (showBanner) {
      setShowConsentBanner(true);
    }
  }, [showBanner]);

  const handleAcceptAll = async () => {
    const allAccepted: ConsentPreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      personalization: true,
      third_party: true,
    };

    await saveConsent(allAccepted);
  };

  const handleAcceptEssential = async () => {
    const essentialOnly: ConsentPreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      personalization: false,
      third_party: false,
    };

    await saveConsent(essentialOnly);
  };

  const handleCustomizePreferences = () => {
    setShowPreferences(true);
  };

  const handleSavePreferences = async () => {
    await saveConsent(preferences);
    setShowPreferences(false);
  };

  const saveConsent = async (consentPreferences: ConsentPreferences) => {
    try {
      // Save to localStorage
      const consentData = {
        preferences: consentPreferences,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
      localStorage.setItem('cookie_consent', JSON.stringify(consentData));

      // Send to backend
      await fetch('/api/v1/privacy/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consents: Object.entries(consentPreferences).map(([type, granted]) => ({
            consentType: type,
            granted,
          })),
        }),
      });

      setPreferences(consentPreferences);
      setHasConsented(true);
      setShowConsentBanner(false);

      // Notify parent component
      if (onConsentChange) {
        onConsentChange(consentPreferences);
      }

      // Apply consent preferences
      applyConsentPreferences(consentPreferences);

    } catch (error) {
      console.error('Failed to save consent preferences:', error);
    }
  };

  const applyConsentPreferences = (prefs: ConsentPreferences) => {
    // Analytics
    if (prefs.analytics) {
      // Enable analytics tracking
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          analytics_storage: 'granted'
        });
      }
    } else {
      // Disable analytics tracking
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          analytics_storage: 'denied'
        });
      }
    }

    // Marketing
    if (prefs.marketing) {
      // Enable marketing cookies
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          ad_storage: 'granted'
        });
      }
    } else {
      // Disable marketing cookies
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          ad_storage: 'denied'
        });
      }
    }

    // Personalization
    if (prefs.personalization) {
      // Enable personalization features
      localStorage.setItem('personalization_enabled', 'true');
    } else {
      // Disable personalization features
      localStorage.removeItem('personalization_enabled');
    }

    // Third-party
    if (!prefs.third_party) {
      // Block third-party scripts/iframes
      document.querySelectorAll('iframe[data-consent="third-party"]').forEach(iframe => {
        iframe.remove();
      });
    }
  };

  const handleRevokeConsent = () => {
    localStorage.removeItem('cookie_consent');
    setHasConsented(false);
    setShowConsentBanner(true);
    setPreferences({
      essential: true,
      analytics: false,
      marketing: false,
      personalization: false,
      third_party: false,
    });
  };

  if (!showConsentBanner && !showPreferences) {
    return null;
  }

  return (
    <>
      {/* Consent Banner */}
      {showConsentBanner && (
        <div className={`fixed left-0 right-0 z-50 p-4 ${position === 'bottom' ? 'bottom-0' : 'top-0'}`}>
          <Card className="max-w-4xl mx-auto p-6 shadow-lg border-2">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  We use cookies to enhance your experience
                </h3>
                <p className="text-sm text-gray-600">
                  We use essential cookies to make our site work. We'd also like to set optional cookies 
                  to help us improve our site and show you relevant content. You can choose which cookies 
                  you're happy for us to use.
                </p>
                <button
                  onClick={() => setShowPreferences(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline mt-2"
                >
                  Learn more about cookies
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 min-w-fit">
                <Button
                  onClick={handleAcceptEssential}
                  variant="outline"
                  size="sm"
                >
                  Essential Only
                </Button>
                <Button
                  onClick={handleCustomizePreferences}
                  variant="outline"
                  size="sm"
                >
                  Customize
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  size="sm"
                >
                  Accept All
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Cookie Preferences</h2>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Essential Cookies */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Essential Cookies</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These cookies are necessary for the website to function and cannot be switched off.
                      </p>
                    </div>
                    <div className="ml-4">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Always Active
                      </span>
                    </div>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Analytics Cookies</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These cookies help us understand how visitors interact with our website.
                      </p>
                    </div>
                    <div className="ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.analytics}
                          onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Marketing Cookies</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These cookies are used to show you relevant advertisements and measure campaign effectiveness.
                      </p>
                    </div>
                    <div className="ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.marketing}
                          onChange={(e) => setPreferences(prev => ({ ...prev, marketing: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Personalization Cookies */}
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Personalization Cookies</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These cookies help us personalize content and recommendations for you.
                      </p>
                    </div>
                    <div className="ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.personalization}
                          onChange={(e) => setPreferences(prev => ({ ...prev, personalization: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Third-party Cookies */}
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Third-party Cookies</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        These cookies are set by third-party services like social media platforms and payment processors.
                      </p>
                    </div>
                    <div className="ml-4">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.third_party}
                          onChange={(e) => setPreferences(prev => ({ ...prev, third_party: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <Button
                  onClick={() => setShowPreferences(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePreferences}
                >
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Consent Management Link (for users who have already consented) */}
      {hasConsented && !showConsentBanner && !showPreferences && (
        <button
          onClick={() => setShowPreferences(true)}
          className="fixed bottom-4 left-4 z-40 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded px-3 py-2 shadow-sm"
        >
          Cookie Settings
        </button>
      )}
    </>
  );
};

export default CookieConsentManager;