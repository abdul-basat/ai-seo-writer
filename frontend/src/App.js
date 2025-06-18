import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Available models for each provider
const AVAILABLE_MODELS = {
  openai: [
    'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
    'o1', 'o1-mini', 'o1-pro', 'o3', 'o3-mini', 'o4-mini'
  ],
  anthropic: [
    'claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-7-sonnet-20250219',
    'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'
  ],
  gemini: [
    'gemini-2.5-flash-preview-04-17', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash',
    'gemini-2.0-flash-preview-image-generation', 'gemini-2.0-flash-lite',
    'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'
  ],
  groq: [
    'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant',
    'mixtral-8x7b-32768', 'gemma-7b-it'
  ],
  grok: [
    'grok-beta', 'grok-vision-beta'
  ]
};

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [apiKeys, setApiKeys] = useState({
    openai_key: '',
    anthropic_key: '',
    gemini_key: '',
    groq_key: '',
    grok_key: ''
  });
  const [validatedKeys, setValidatedKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [contentForm, setContentForm] = useState({
    keyword: '',
    provider: 'openai',
    model: 'gpt-4o',
    tone: 'informative',
    word_count: 1000,
    include_faq: true,
    include_schema: true
  });
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contentHistory, setContentHistory] = useState([]);

  useEffect(() => {
    loadContentHistory();
  }, []);

  const loadContentHistory = async () => {
    try {
      const response = await axios.get(`${API}/content?limit=5`);
      setContentHistory(response.data);
    } catch (error) {
      console.error('Error loading content history:', error);
    }
  };

  const testApiKey = async (provider, apiKey, model) => {
    try {
      const response = await axios.post(`${API}/test-api-key`, {
        provider,
        api_key: apiKey,
        model
      });
      return response.data.valid;
    } catch (error) {
      return false;
    }
  };

  const handleApiKeyChange = async (provider, value) => {
    const keyName = `${provider}_key`;
    setApiKeys(prev => ({ ...prev, [keyName]: value }));
    
    if (value) {
      // Test the API key
      const defaultModel = AVAILABLE_MODELS[provider][0];
      const isValid = await testApiKey(provider, value, defaultModel);
      setValidatedKeys(prev => ({ ...prev, [provider]: isValid }));
    } else {
      setValidatedKeys(prev => ({ ...prev, [provider]: false }));
    }
  };

  const getAvailableProviders = () => {
    return Object.keys(AVAILABLE_MODELS).filter(provider => validatedKeys[provider]);
  };

  const generateContent = async () => {
    if (!contentForm.keyword.trim()) {
      alert('Please enter a keyword');
      return;
    }

    const apiKey = apiKeys[`${contentForm.provider}_key`];
    if (!apiKey) {
      alert(`Please enter a valid API key for ${contentForm.provider}`);
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${API}/generate-content`, {
        keyword: contentForm.keyword,
        provider: contentForm.provider,
        model: contentForm.model,
        tone: contentForm.tone,
        word_count: parseInt(contentForm.word_count),
        api_key: apiKey,
        include_faq: contentForm.include_faq,
        include_schema: contentForm.include_schema
      });

      setGeneratedContent(response.data);
      setCurrentView('result');
      loadContentHistory(); // Refresh history
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Error generating content: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">AI SEO Writer</h1>
                <p className="text-sm text-gray-600">Automated SEO Content Generator</p>
              </div>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setCurrentView('home')}
                className={`${currentView === 'home' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Generate
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`${currentView === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Settings
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`${currentView === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                History
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Generate SEO Content
              <span className="text-indigo-600"> with AI</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Enter a keyword and get fully SEO-optimized blog posts generated automatically. 
              Complete with meta tags, schema markup, and perfect heading structure.
            </p>
            
            {/* Content Generation Form */}
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
              <div className="space-y-6">
                {/* Keyword Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Focus Keyword
                  </label>
                  <input
                    type="text"
                    value={contentForm.keyword}
                    onChange={(e) => setContentForm(prev => ({ ...prev, keyword: e.target.value }))}
                    placeholder="e.g., best productivity apps 2025"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                  />
                </div>

                {/* Provider and Model Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Provider
                    </label>
                    <select
                      value={contentForm.provider}
                      onChange={(e) => {
                        const newProvider = e.target.value;
                        setContentForm(prev => ({ 
                          ...prev, 
                          provider: newProvider,
                          model: AVAILABLE_MODELS[newProvider][0]
                        }));
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {Object.keys(AVAILABLE_MODELS).map(provider => (
                        <option 
                          key={provider} 
                          value={provider}
                          disabled={!validatedKeys[provider]}
                        >
                          {provider.charAt(0).toUpperCase() + provider.slice(1)} 
                          {!validatedKeys[provider] && ' (API Key Required)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Model
                    </label>
                    <select
                      value={contentForm.model}
                      onChange={(e) => setContentForm(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={!validatedKeys[contentForm.provider]}
                    >
                      {AVAILABLE_MODELS[contentForm.provider]?.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tone and Word Count */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tone
                    </label>
                    <select
                      value={contentForm.tone}
                      onChange={(e) => setContentForm(prev => ({ ...prev, tone: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="informative">Informative</option>
                      <option value="casual">Casual</option>
                      <option value="professional">Professional</option>
                      <option value="authoritative">Authoritative</option>
                      <option value="storytelling">Storytelling</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Word Count
                    </label>
                    <select
                      value={contentForm.word_count}
                      onChange={(e) => setContentForm(prev => ({ ...prev, word_count: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="500">500 words</option>
                      <option value="1000">1000 words</option>
                      <option value="1500">1500 words</option>
                      <option value="2000">2000 words</option>
                      <option value="3000">3000 words</option>
                    </select>
                  </div>
                </div>

                {/* Additional Options */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contentForm.include_faq}
                      onChange={(e) => setContentForm(prev => ({ ...prev, include_faq: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include FAQ Section</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={contentForm.include_schema}
                      onChange={(e) => setContentForm(prev => ({ ...prev, include_schema: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include Schema Markup</span>
                  </label>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateContent}
                  disabled={isGenerating || !validatedKeys[contentForm.provider]}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium py-4 px-6 rounded-lg text-lg transition-colors duration-200 flex items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Content...
                    </>
                  ) : (
                    'Generate SEO Content'
                  )}
                </button>

                {!validatedKeys[contentForm.provider] && (
                  <p className="text-center text-red-600 text-sm">
                    Please add a valid API key for {contentForm.provider} in Settings first.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose AI SEO Writer?
            </h2>
            <p className="text-lg text-gray-600">
              Generate professional, SEO-optimized content in minutes, not hours
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">Generate complete blog posts in under 2 minutes with advanced AI</p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">SEO Optimized</h3>
              <p className="text-gray-600">Built-in SEO optimization with meta tags, schema markup, and keyword targeting</p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Multiple AI Providers</h3>
              <p className="text-gray-600">Choose from OpenAI, Anthropic, Gemini, Groq, and Grok with your own API keys</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">AI SEO Writer</h1>
                <p className="text-sm text-gray-600">API Settings</p>
              </div>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setCurrentView('home')}
                className={`${currentView === 'home' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Generate
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`${currentView === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Settings
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`${currentView === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                History
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">API Key Settings</h2>
          <p className="text-gray-600 mb-8">
            Add your API keys to enable content generation. Your keys are stored securely and never shared.
          </p>

          <div className="space-y-8">
            {Object.keys(AVAILABLE_MODELS).map(provider => (
              <div key={provider} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {provider === 'grok' ? 'Grok (xAI)' : provider}
                    </h3>
                    {validatedKeys[provider] && (
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Valid
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }))}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    {showKeys[provider] ? 'Hide' : 'Show'} Key
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type={showKeys[provider] ? 'text' : 'password'}
                    value={apiKeys[`${provider}_key`]}
                    onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                    placeholder={`Enter your ${provider} API key`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="text-sm text-gray-600">
                  <p className="mb-2">Available models:</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MODELS[provider].map(model => (
                      <span
                        key={model}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          validatedKeys[provider] 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  <p>
                    Get your API key from: 
                    {provider === 'openai' && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 ml-1">OpenAI Platform</a>}
                    {provider === 'anthropic' && <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 ml-1">Anthropic Console</a>}
                    {provider === 'gemini' && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 ml-1">Google AI Studio</a>}
                    {provider === 'groq' && <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 ml-1">Groq Console</a>}
                    {provider === 'grok' && <a href="https://console.x.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 ml-1">xAI Console</a>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">AI SEO Writer</h1>
                <p className="text-sm text-gray-600">Content History</p>
              </div>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setCurrentView('home')}
                className={`${currentView === 'home' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Generate
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`${currentView === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                Settings
              </button>
              <button
                onClick={() => setCurrentView('history')}
                className={`${currentView === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'} pb-2 text-sm font-medium transition-colors`}
              >
                History
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Content</h2>
            <button
              onClick={loadContentHistory}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Refresh
            </button>
          </div>

          {contentHistory.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No content yet</h3>
              <p className="mt-1 text-sm text-gray-500">Generate your first SEO content to see it here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {contentHistory.map((content, index) => (
                <div key={content.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">Keyword: {content.keyword}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {content.provider}
                        </span>
                        <span className="text-xs text-gray-500">{content.word_count} words</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(content.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{content.meta_description}</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      {content.h2_tags && content.h2_tags.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {content.h2_tags.length} H2 tags
                        </span>
                      )}
                      {content.faq_section && (
                        <span className="text-xs text-green-600">FAQ included</span>
                      )}
                      {content.schema_markup && (
                        <span className="text-xs text-purple-600">Schema markup</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setGeneratedContent(content);
                        setCurrentView('result');
                      }}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => setCurrentView('home')}
                className="mr-4 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <h1 className="text-3xl font-bold text-gray-900">Generated Content</h1>
                <p className="text-sm text-gray-600">SEO-optimized content for "{generatedContent?.keyword}"</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {generatedContent && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-8">
            {/* SEO Meta Information */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">SEO Meta Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SEO Title</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={generatedContent.title}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedContent.title)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                  <div className="flex items-start space-x-2">
                    <textarea
                      value={generatedContent.meta_description}
                      readOnly
                      rows={3}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedContent.meta_description)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">H1 Tag</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={generatedContent.h1_tag}
                      readOnly
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedContent.h1_tag)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Article Content</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{generatedContent.word_count} words</span>
                  <button
                    onClick={() => copyToClipboard(generatedContent.content)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Copy Content
                  </button>
                </div>
              </div>
              
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {generatedContent.content}
                </pre>
              </div>
            </div>

            {/* Headings Structure */}
            {(generatedContent.h2_tags?.length > 0 || generatedContent.h3_tags?.length > 0) && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Heading Structure</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {generatedContent.h2_tags?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">H2 Tags</h3>
                      <ul className="space-y-2">
                        {generatedContent.h2_tags.map((tag, index) => (
                          <li key={index} className="text-gray-700 text-sm">• {tag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {generatedContent.h3_tags?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">H3 Tags</h3>
                      <ul className="space-y-2">
                        {generatedContent.h3_tags.map((tag, index) => (
                          <li key={index} className="text-gray-700 text-sm">• {tag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FAQ Section */}
            {generatedContent.faq_section && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">FAQ Section</h2>
                  <button
                    onClick={() => copyToClipboard(generatedContent.faq_section)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Copy FAQ
                  </button>
                </div>
                
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                    {generatedContent.faq_section}
                  </pre>
                </div>
              </div>
            )}

            {/* Schema Markup */}
            {generatedContent.schema_markup && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Schema Markup</h2>
                  <button
                    onClick={() => copyToClipboard(generatedContent.schema_markup)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Copy Schema
                  </button>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-green-400 text-sm">
                    {generatedContent.schema_markup}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Main render
  if (currentView === 'settings') return renderSettings();
  if (currentView === 'history') return renderHistory();
  if (currentView === 'result') return renderResult();
  return renderHome();
};

export default App;