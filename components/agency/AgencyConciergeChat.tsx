import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { Icon } from '../Icon';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any;
  actions?: string[];
  followUp?: string[];
}

interface AgencyConciergeChatProps {
  agencyId: string;
  onDataRequest?: (data: any) => void;
}

export const AgencyConciergeChat: React.FC<AgencyConciergeChatProps> = ({
  agencyId,
  onDataRequest
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message
      setMessages([{
        id: 'welcome',
        type: 'assistant',
        content: 'Hi! I\'m your Agency Concierge AI Assistant. I can help you with analytics, creator management, content insights, and answer questions about your platform. What would you like to know?',
        timestamp: new Date(),
        actions: [
          'Show me revenue analytics',
          'How are my creators performing?',
          'What content is trending?',
          'Generate a performance report'
        ]
      }]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/agency-concierge/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          query: message,
          channel: 'web'
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          type: 'assistant',
          content: data.data.response,
          timestamp: new Date(),
          data: data.data.data,
          actions: data.data.actions,
          followUp: data.data.followUp
        };

        setMessages(prev => [...prev, assistantMessage]);

        // If there's data, notify parent component
        if (data.data.data && onDataRequest) {
          onDataRequest(data.data.data);
        }
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
        actions: ['Try again', 'Contact support', 'View system status']
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleActionClick = (action: string) => {
    sendMessage(action);
  };

  const handleFollowUpClick = (followUp: string) => {
    sendMessage(followUp);
  };

  const renderMessage = (message: ChatMessage) => (
    <div
      key={message.id}
      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          message.type === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        
        {/* Data visualization */}
        {message.data && (
          <div className="mt-3 p-3 bg-white bg-opacity-20 rounded text-xs">
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(message.data, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 space-y-1">
            {message.actions.map((action, index) => (
              <Button
                key={index}
                size="sm"
                variant="outline"
                onClick={() => handleActionClick(action)}
                className="w-full text-xs bg-white bg-opacity-20 border-white border-opacity-30 hover:bg-opacity-30"
              >
                {action}
              </Button>
            ))}
          </div>
        )}
        
        {/* Follow-up suggestions */}
        {message.followUp && message.followUp.length > 0 && (
          <div className="mt-3">
            <p className="text-xs opacity-75 mb-2">You might also ask:</p>
            <div className="space-y-1">
              {message.followUp.map((followUp, index) => (
                <button
                  key={index}
                  onClick={() => handleFollowUpClick(followUp)}
                  className="block w-full text-left text-xs p-2 bg-white bg-opacity-10 rounded hover:bg-opacity-20 transition-colors"
                >
                  "{followUp}"
                </button>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-xs opacity-75 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 shadow-lg"
        >
          <Icon name="message-circle" size={24} />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-96 h-96 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
              <Icon name="cpu" size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Agency Concierge</h3>
              <p className="text-xs text-gray-600">AI Assistant</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            <Icon name="x" size={16} />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(renderMessage)}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center">
                <Spinner size="sm" />
                <span className="ml-2 text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your agency..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !inputValue.trim()}
              size="sm"
            >
              <Icon name="send" size={16} />
            </Button>
          </form>
          
          {/* Quick actions */}
          <div className="mt-2 flex flex-wrap gap-1">
            {[
              'Revenue this month',
              'Top creators',
              'Content performance',
              'Export data'
            ].map((quickAction) => (
              <button
                key={quickAction}
                onClick={() => sendMessage(quickAction)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                disabled={loading}
              >
                {quickAction}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};