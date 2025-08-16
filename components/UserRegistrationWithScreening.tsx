/**
 * User Registration with Sanctions Screening
 * Registration form that includes real-time sanctions screening
 */

import React, { useState, useEffect } from 'react';
import { useUserRegistrationScreening, useCountryValidation } from '../lib/hooks/useSanctionsScreening';

interface RegistrationFormData {
  email: string;
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  countryCode: string;
  address: string;
  phoneNumber: string;
  agreeToTerms: boolean;
}

interface CountryOption {
  code: string;
  name: string;
  blocked?: boolean;
}

const UserRegistrationWithScreening: React.FC = () => {
  const [formData, setFormData] = useState<RegistrationFormData>({
    email: '',
    fullName: '',
    dateOfBirth: '',
    nationality: '',
    countryCode: '',
    address: '',
    phoneNumber: '',
    agreeToTerms: false
  });

  const [countries] = useState<CountryOption[]>([
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
    { code: 'IN', name: 'India' },
    { code: 'IR', name: 'Iran', blocked: true },
    { code: 'KP', name: 'North Korea', blocked: true },
    { code: 'SY', name: 'Syria', blocked: true }
  ]);

  const [showScreeningResult, setShowScreeningResult] = useState(false);
  const [countryValidation, setCountryValidation] = useState<any>(null);

  const { validateAndScreenUser, screeningStatus, isLoading, error } = useUserRegistrationScreening();
  const { validateCountry } = useCountryValidation();

  // Validate country when selected
  useEffect(() => {
    if (formData.countryCode) {
      const validation = validateCountry(formData.countryCode);
      setCountryValidation(validation);
    }
  }, [formData.countryCode, validateCountry]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreeToTerms) {
      alert('Please agree to the terms and conditions');
      return;
    }

    if (countryValidation?.isBlocked) {
      alert('Registration is not available in your selected country');
      return;
    }

    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await validateAndScreenUser({
        userId,
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        nationality: formData.nationality,
        address: formData.address,
        email: formData.email,
        countryCode: formData.countryCode
      });

      setShowScreeningResult(true);
      console.log('Registration screening result:', result);

    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const getScreeningStatusColor = () => {
    switch (screeningStatus) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'review': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'screening': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScreeningStatusMessage = () => {
    switch (screeningStatus) {
      case 'approved':
        return 'Registration approved! You can now access the platform.';
      case 'rejected':
        return 'Registration rejected. Please contact support if you believe this is an error.';
      case 'review':
        return 'Your registration requires manual review. We will contact you within 24-48 hours.';
      case 'screening':
        return 'Running compliance checks...';
      default:
        return 'Ready to register';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-600">
            Join our platform with secure, compliant registration
          </p>
        </div>

        {/* Country Validation Warning */}
        {countryValidation?.isBlocked && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-600 mr-2">⚠️</span>
              <div>
                <h3 className="font-medium text-red-800">Service Not Available</h3>
                <p className="text-sm text-red-700">{countryValidation.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Screening Status */}
        {(screeningStatus !== 'pending' || showScreeningResult) && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${getScreeningStatusColor()}`}>
            <div className="flex items-center">
              {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>}
              <div>
                <h3 className="font-medium">
                  {screeningStatus === 'screening' ? 'Processing Registration' : 'Registration Status'}
                </h3>
                <p className="text-sm mt-1">{getScreeningStatusMessage()}</p>
                {error && (
                  <p className="text-sm mt-1 text-red-600">Error: {error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Must match government-issued ID for verification
            </p>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
              max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be 18 years or older
            </p>
          </div>

          {/* Country and Nationality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country of Residence *
              </label>
              <select
                name="countryCode"
                value={formData.countryCode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={isLoading}
              >
                <option value="">Select Country</option>
                {countries.map(country => (
                  <option 
                    key={country.code} 
                    value={country.code}
                    disabled={country.blocked}
                  >
                    {country.name} {country.blocked ? '(Not Available)' : ''}
                  </option>
                ))}
              </select>
              {countryValidation && (
                <p className={`text-xs mt-1 ${countryValidation.isBlocked ? 'text-red-600' : 'text-green-600'}`}>
                  {countryValidation.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nationality *
              </label>
              <select
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={isLoading}
              >
                <option value="">Select Nationality</option>
                {countries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={isLoading}
              placeholder="Street address, city, state/province, postal code"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Terms Agreement */}
          <div className="flex items-start">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
              className="mt-1 mr-3"
              required
              disabled={isLoading}
            />
            <label className="text-sm text-gray-700">
              I agree to the{' '}
              <a href="/policies/terms_of_service" className="text-blue-600 hover:text-blue-800">
                Terms of Service
              </a>
              ,{' '}
              <a href="/policies/privacy_policy" className="text-blue-600 hover:text-blue-800">
                Privacy Policy
              </a>
              , and{' '}
              <a href="/policies/acceptable_use_policy" className="text-blue-600 hover:text-blue-800">
                Acceptable Use Policy
              </a>
              . I understand that my information will be screened for compliance purposes.
            </label>
          </div>

          {/* Compliance Notice */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">Compliance Screening</h3>
            <p className="text-sm text-blue-700">
              Your registration will be screened against sanctions lists and compliance databases 
              as required by law. This process is automatic and helps ensure platform security. 
              Your personal information is protected and used only for verification purposes.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || countryValidation?.isBlocked || screeningStatus === 'approved'}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing Registration...
              </div>
            ) : screeningStatus === 'approved' ? (
              'Registration Complete'
            ) : (
              'Create Account'
            )}
          </button>

          {/* Additional Actions */}
          {screeningStatus === 'approved' && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Continue to Dashboard →
              </button>
            </div>
          )}

          {screeningStatus === 'review' && (
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Need help?{' '}
                <a href="/support" className="text-blue-600 hover:text-blue-800">
                  Contact Support
                </a>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default UserRegistrationWithScreening;