import React from 'react';

const MessageFormatter = ({ message, onRadioSelection }) => {
  if (!message) return '';

  const normalizedMessage = message.replace(/\\n/g, '\n');

  
  // Check if the message contains HTML tags
  if (normalizedMessage.includes('<') && normalizedMessage.includes('>')) {
    let cleanedHtml = normalizedMessage;

    // Remove submit buttons from forms
    cleanedHtml = cleanedHtml.replace(/<input[^>]*type=["']submit["'][^>]*>/gi, '');
    
    // If it's a complete HTML document, extract only the body content
    if (cleanedHtml.includes('<!DOCTYPE') || cleanedHtml.includes('<html')) {
      const bodyMatch = cleanedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cleanedHtml = bodyMatch[1];
      }
    }
    
    return (
      <div 
        className="conversation-message"
        dangerouslySetInnerHTML={{ __html: cleanedHtml }} 
        style={{
          lineHeight: '1.3',
        }}
        onClick={(e) => {
          if (e.target.type === 'radio') {
            const value = e.target.value;
            if (value) {
              onRadioSelection(value);
            }
          }
        }}
      />
    );
  }
  
  // Original formatting logic for non-HTML messages (markdown-style)
  const lines = normalizedMessage.split('\n');
  const formattedLines = lines.map((line, index) => {
    let formattedLine = line;
    
    // Handle numbered lists (1. 2. 3. etc.)
    if (/^\d+\.\s\*\*/.test(line)) {
      const parts = line.match(/^(\d+\.\s)\*\*(.*?)\*\*:?\s*(.*)/);
      if (parts) {
        return (
          <div key={index} className="mb-1">
            <span className="font-semibold text-blue-700">{parts[1]}</span>
            <span className="font-bold text-gray-900">{parts[2]}</span>
            {parts[3] && <span className="text-gray-800">: {parts[3]}</span>}
          </div>
        );
      }
    }
    
    // Handle bold text **text**
    if (formattedLine.includes('**')) {
      const parts = formattedLine.split(/(\*\*.*?\*\*)/);
      return (
        <div key={index} className="mb-0.5">
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <span key={partIndex} className="font-bold text-gray-900">{part.slice(2, -2)}</span>;
            }
            return <span key={partIndex}>{part}</span>;
          })}
        </div>
      );
    }
    
    // Handle regular lines with minimal spacing
    if (line.trim() === '') {
      return null;
    }
    
    return <div key={index} className="mb-0.5">{line}</div>;
  });
  
  // Filter out null values (empty lines)
  const filteredLines = formattedLines.filter(line => line !== null);
  
  return <div className="leading-snug space-y-0.5">{filteredLines}</div>;
};

export default MessageFormatter;