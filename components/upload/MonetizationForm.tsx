/**
 * MonetizationForm Component
 * 
 * Form for monetization settings including pricing options and USDC integration
 */

import React, { useState } from 'react';
import { MonetizationFormProps, MonetizationSettings } from '../../types/upload';
import Icon from '../Icon';
import Button from '../Button';

const MonetizationForm: React.FC<MonetizationFormProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle field changes
  const handleFieldChange = (field: keyof MonetizationSettings, fieldValue: any) => {
    onChange({ [field]: fieldValue });
  };

  // Handle price input with validation
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const price = parseFloat(e.target.value) || 0;
    handleFieldChange('price', Math.max(0.5, price));
  };

  // Format price for display
  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Monetization Type */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            Monetization & Distribution
          </h3>
          <p className="text-sm text-slate-600">
            Choose how people can access your content
          </p>
        </div>

        <div className="space-y-3">
          {/* Public (Free) */}
          <label
            className={`block p-4 border rounded-lg cursor-pointer transition-all ${
              value.type === 'public' 
                ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-200' 
                : 'border-slate-200 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                name="monetization"
                value="public"
                checked={value.type === 'public'}
                onChange={(e) => handleFieldChange('type', e.target.value)}
                disabled={disabled}
                className="mt-1 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Icon name="globe" size={20} className="text-green-600" />
                  <span className="font-medium text-slate-900">Public (Free)</span>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  Anyone can watch for free. Maximize your reach and grow your audience.
                </p>
              </div>
            </div>
          </label>

          {/* Subscribers Only */}
          <label
            className={`block p-4 border rounded-lg cursor-pointer transition-all ${
              value.type === 'subscribers' 
                ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-200' 
                : 'border-slate-200 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                name="monetization"
                value="subscribers"
                checked={value.type === 'subscribers'}
                onChange={(e) => handleFieldChange('type', e.target.value)}
                disabled={disabled}
                className="mt-1 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Icon name="users" size={20} className="text-violet-600" />
                  <span className="font-medium text-slate-900">Subscribers Only</span>
                </div>
                <p className="text-sm text-slate-600">
                  Only your subscribers can watch. Build exclusive content for your community.
                </p>
              </div>
            </div>
          </label>

          {/* Pay-per-view */}
          <label
            className={`block p-4 border rounded-lg cursor-pointer transition-all ${
              value.type === 'pay-per-view' 
                ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-200' 
                : 'border-slate-200 hover:bg-slate-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                name="monetization"
                value="pay-per-view"
                checked={value.type === 'pay-per-view'}
                onChange={(e) => handleFieldChange('type', e.target.value)}
                disabled={disabled}
                className="mt-1 text-violet-600 focus:ring-violet-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Icon name="credit-card" size={20} className="text-amber-600" />
                  <span className="font-medium text-slate-900">Pay-per-view</span>
                  <div className="flex items-center space-x-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    <Icon name="coins" size={12} />
                    <span>USDC</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Viewers pay to watch. Perfect for premium, exclusive, or educational content.
                </p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Price Input for Pay-per-view */}
      {value.type === 'pay-per-view' && (
        <div className="space-y-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Price per view
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-500 text-sm">$</span>
              </div>
              <input
                type="number"
                min="0.50"
                step="0.01"
                value={formatPrice(value.price)}
                onChange={handlePriceChange}
                disabled={disabled}
                className="w-full pl-7 pr-12 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="0.50"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 text-sm">USDC</span>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Minimum $0.50 USDC. You keep 90% of net revenue.
            </p>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white p-3 rounded border border-amber-200">
            <h4 className="text-sm font-medium text-slate-900 mb-2">Revenue Breakdown</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Viewer pays</span>
                <span className="font-medium">${formatPrice(value.price)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Platform fee (10%)</span>
                <span className="text-slate-500">-${formatPrice(value.price * 0.1)} USDC</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-900 font-medium">You receive</span>
                <span className="font-bold text-green-600">${formatPrice(value.price * 0.9)} USDC</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Treasury Coverage Notice */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Icon name="shield-check" size={20} className="text-green-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-green-800 mb-1">
              Treasury Coverage
            </h4>
            <p className="text-sm text-green-700">
              Storage and gas fees are paid by the Reelverse Treasury. 
              You don't need a wallet to upload or receive payments.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm"
          disabled={disabled}
        >
          <Icon 
            name={showAdvanced ? 'chevron-right' : 'chevron-left'} 
            size={16}
            className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          />
          <span>Advanced Options</span>
        </Button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          {/* Tip Jar */}
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="tipJar"
              checked={value.tipJarEnabled}
              onChange={(e) => handleFieldChange('tipJarEnabled', e.target.checked)}
              disabled={disabled}
              className="mt-1 text-violet-600 focus:ring-violet-500"
            />
            <div className="flex-1">
              <label htmlFor="tipJar" className="text-sm font-medium text-slate-900 cursor-pointer">
                Enable Tip Jar
              </label>
              <p className="text-sm text-slate-600">
                Allow viewers to send tips in USDC, even for free content.
              </p>
            </div>
          </div>

          {/* NSFW/Age Gate */}
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="nsfwGated"
              checked={value.nsfwGated}
              onChange={(e) => handleFieldChange('nsfwGated', e.target.checked)}
              disabled={disabled}
              className="mt-1 text-violet-600 focus:ring-violet-500"
            />
            <div className="flex-1">
              <label htmlFor="nsfwGated" className="text-sm font-medium text-slate-900 cursor-pointer">
                Age-restricted content (18+)
              </label>
              <p className="text-sm text-slate-600">
                Content will be hidden behind an age verification gate.
              </p>
            </div>
          </div>

          {/* NSFW Warning */}
          {value.nsfwGated && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Icon name="alert-circle" size={16} className="text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Age-restricted content</p>
                  <p>
                    This content will only be visible to verified users 18 and older.
                    Make sure your content complies with our community guidelines.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monetization Tips */}
      <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
        <h4 className="text-sm font-medium text-violet-800 mb-2">
          💡 Monetization Tips
        </h4>
        <ul className="text-sm text-violet-700 space-y-1">
          <li>• Start with free content to build your audience</li>
          <li>• Use pay-per-view for premium or educational content</li>
          <li>• Enable tips to earn from engaged viewers</li>
          <li>• Subscribers-only content builds loyalty</li>
        </ul>
      </div>
    </div>
  );
};

export default MonetizationForm;