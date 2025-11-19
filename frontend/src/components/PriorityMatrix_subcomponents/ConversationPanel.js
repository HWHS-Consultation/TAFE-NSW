import React, { useRef, useEffect } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import MessageFormatter from './MessageFormatter';
import InteractiveOptions from './InteractiveOptions';

const ConversationPanel = ({
  conversationHistory,
  userResponse,
  setUserResponse,
  isLoading,
  selectedRadioOption,
  onUserResponse,
  onRadioSelection
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const getLastInteractiveMessage = () => {
    if (conversationHistory.length === 0) return null;
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    return lastMessage.interactive && 
           (lastMessage.interactive.type === "choice" || lastMessage.interactive.type === "radio")
      ? lastMessage.interactive
      : null;
  };

  return (
    <div className="lg:col-span-2">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Conversation with Riley
          </h2>
        </div>
        
        <div 
          className="h-96 overflow-y-auto p-4 space-y-4" 
          ref={messagesContainerRef}
        > 
          {conversationHistory.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  msg.interactive && msg.interactive.type === "rating_scale"
                    ? `px-4 py-3 rounded-lg${msg.sender === 'user' ? ' bg-blue-600 text-white' : ' bg-gray-100 text-gray-900'}`
                    : `max-w-xs lg:max-w-md px-4 py-3 rounded-lg${msg.sender === 'user' ? ' bg-blue-600 text-white' : ' bg-gray-100 text-gray-900'}`
                }
                style={
                  msg.interactive && msg.interactive.type === "rating_scale"
                    ? { width: '100vh' }
                    : undefined
                }
              >
                {msg.sender === 'ai' && (
                  <div className="text-xs text-gray-600 mb-1">Riley</div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words">
                  {msg.isInteractiveResponse ? (
                    <span className="font-medium">{msg.message}</span>
                  ) : msg.interactive && msg.interactive.type === "rating_scale" ? (
                    <div className="mt-2">
                      <iframe
                        srcDoc={msg.interactive.htmlContent}
                        className="w-full border-0 rounded-lg"
                        style={{ height: '800px', minHeight: '600px' }}
                        title="Rating Scale Form"
                      />
                    </div>
                  ) : (
                    <MessageFormatter 
                      message={msg.interactive ? msg.message : (msg.htmlMessage || msg.message)} 
                      onRadioSelection={onRadioSelection}
                    />
                  )}
                </div>
                {msg.insights && msg.insights.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-500">Insights:</div>
                    {msg.insights.map((insight, i) => (
                      <div key={i} className="text-xs text-blue-600 mt-1">
                        • {insight.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Riley is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 text-black border-t border-gray-200">
          <InteractiveOptions
            interactive={getLastInteractiveMessage()}
            selectedRadioOption={selectedRadioOption}
            onRadioSelection={onRadioSelection}
          />
          
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onUserResponse()}
              placeholder="Type your response..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={onUserResponse}
              disabled={isLoading || !userResponse.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;