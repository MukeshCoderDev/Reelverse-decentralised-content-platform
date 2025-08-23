/**
 * MetadataForm Component
 * 
 * Form for content metadata including title, description, tags, category, and visibility
 */

import React, { useState, useCallback, useRef } from 'react';
import { MetadataFormProps, ContentMetadata } from '../../types/upload';
import Icon from '../Icon';
import Button from '../Button';

const MetadataForm: React.FC<MetadataFormProps> = ({
  value,
  onChange,
  errors = {},
  disabled = false
}) => {
  const [tagInput, setTagInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Character count helpers
  const titleCharsRemaining = 100 - value.title.length;
  const descriptionCharsRemaining = 5000 - value.description.length;

  // Categories for selection
  const categories = [
    { value: '', label: 'Select Category' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'education', label: 'Education' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'sports', label: 'Sports' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'travel', label: 'Travel' },
    { value: 'food', label: 'Food & Cooking' },
    { value: 'art', label: 'Art & Design' },
    { value: 'technology', label: 'Technology' },
    { value: 'business', label: 'Business' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'other', label: 'Other' }
  ];

  // Languages for selection
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' },
    { value: 'ar', label: 'Arabic' },
    { value: 'hi', label: 'Hindi' },
    { value: 'other', label: 'Other' }
  ];

  // Handle form field changes
  const handleFieldChange = useCallback((field: keyof ContentMetadata, fieldValue: any) => {
    onChange({ [field]: fieldValue });
  }, [onChange]);

  // Handle tag input
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && tagInput === '' && value.tags.length > 0) {
      // Remove last tag if input is empty
      const newTags = [...value.tags];
      newTags.pop();
      handleFieldChange('tags', newTags);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !value.tags.includes(tag) && value.tags.length < 10) {
      handleFieldChange('tags', [...value.tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = value.tags.filter(tag => tag !== tagToRemove);
    handleFieldChange('tags', newTags);
  };

  // Input field wrapper with error styling
  const InputWrapper: React.FC<{
    children: React.ReactNode;
    error?: string;
    label: string;
    required?: boolean;
    description?: string;
  }> = ({ children, error, label, required, description }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-900">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-sm text-slate-500">{description}</p>
      )}
      {children}
      {error && (
        <div className="flex items-center space-x-1 text-sm text-rose-600">
          <Icon name="alert-circle" size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Title Field */}
      <InputWrapper
        label="Title"
        required
        error={errors.title}
        description="Give your video a descriptive title"
      >
        <div className="relative">
          <input
            type="text"
            value={value.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="Enter video title..."
            disabled={disabled}
            maxLength={100}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
              errors.title 
                ? 'border-rose-300 bg-rose-50' 
                : 'border-slate-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-describedby="title-description title-count"
          />
          <div
            id="title-count"
            className={`absolute right-3 top-2 text-xs ${
              titleCharsRemaining < 10 ? 'text-rose-500' : 'text-slate-400'
            }`}
          >
            {titleCharsRemaining}
          </div>
        </div>
      </InputWrapper>

      {/* Description Field */}
      <InputWrapper
        label="Description"
        error={errors.description}
        description="Tell viewers about your video (supports markdown)"
      >
        <div className="relative">
          <textarea
            value={value.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="Describe your video..."
            disabled={disabled}
            maxLength={5000}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-vertical ${
              errors.description 
                ? 'border-rose-300 bg-rose-50' 
                : 'border-slate-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-describedby="description-count"
          />
          <div
            id="description-count"
            className={`absolute right-3 bottom-2 text-xs ${
              descriptionCharsRemaining < 100 ? 'text-rose-500' : 'text-slate-400'
            }`}
          >
            {descriptionCharsRemaining}
          </div>
        </div>
      </InputWrapper>

      {/* Tags Field */}
      <InputWrapper
        label="Tags"
        error={errors.tags}
        description={`Add up to 10 tags to help people find your video (${value.tags.length}/10)`}
      >
        <div className={`border rounded-lg p-3 focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent ${
          errors.tags ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white'
        }`}>
          {/* Existing Tags */}
          <div className="flex flex-wrap gap-2 mb-2">
            {value.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center space-x-1 px-2 py-1 bg-violet-100 text-violet-700 text-sm rounded-full"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={disabled}
                  className="hover:text-violet-900 focus:outline-none"
                  aria-label={`Remove tag ${tag}`}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
          
          {/* Tag Input */}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={handleTagInputChange}
            onKeyDown={handleTagInputKeyDown}
            onBlur={addTag}
            placeholder={value.tags.length < 10 ? "Type a tag and press Enter..." : "Maximum tags reached"}
            disabled={disabled || value.tags.length >= 10}
            className="w-full bg-transparent border-none outline-none placeholder:text-slate-400"
          />
        </div>
      </InputWrapper>

      {/* Category and Visibility Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category */}
        <InputWrapper
          label="Category"
          description="Help viewers find your content"
        >
          <select
            value={value.category}
            onChange={(e) => handleFieldChange('category', e.target.value)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } border-slate-300 bg-white`}
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </InputWrapper>

        {/* Visibility */}
        <InputWrapper
          label="Visibility"
          description="Who can see your video"
        >
          <div className="space-y-2">
            {[
              { value: 'private', label: 'Private', description: 'Only you can see' },
              { value: 'unlisted', label: 'Unlisted', description: 'Anyone with link can see' },
              { value: 'public', label: 'Public', description: 'Everyone can see' }
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  value.visibility === option.value 
                    ? 'border-violet-300 bg-violet-50' 
                    : 'border-slate-200 hover:bg-slate-50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={option.value}
                  checked={value.visibility === option.value}
                  onChange={(e) => handleFieldChange('visibility', e.target.value)}
                  disabled={disabled}
                  className="mt-0.5 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-900">{option.label}</div>
                  <div className="text-xs text-slate-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </InputWrapper>
      </div>

      {/* Advanced Settings Toggle */}
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
          <span>Advanced Settings</span>
        </Button>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          {/* Language */}
          <InputWrapper
            label="Language"
            description="Primary language of your video"
          >
            <select
              value={value.language}
              onChange={(e) => handleFieldChange('language', e.target.value)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } border-slate-300 bg-white`}
            >
              {languages.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
          </InputWrapper>
        </div>
      )}

      {/* Auto-save Indicator */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Icon name="check-circle" size={16} className="text-green-500" />
        <span>Changes saved automatically</span>
      </div>
    </div>
  );
};

export default MetadataForm;