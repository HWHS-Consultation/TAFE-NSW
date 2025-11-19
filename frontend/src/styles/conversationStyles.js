const conversationStyles = `
  .conversation-message {
    line-height: 1.3;
  }
  .conversation-message p {
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }
  .conversation-message p:last-child {
    margin-bottom: 0;
  }
  .conversation-message .consultation-container {
    background: transparent;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }
  .conversation-message .question-section {
    margin: 0;
    padding: 15px;
    border-left: 3px solid #007bff;
    background-color: #f8f9fa;
    border-radius: 0 6px 6px 0;
  }
  .conversation-message .intro-text {
    margin-bottom: 15px;
    font-size: 14px;
    color: #495057;
  }
  .conversation-message .question-title {
    margin: 0 0 15px 0;
    font-size: 16px;
    font-weight: 600;
    color: #212529;
  }
  .conversation-message .options-container {
    margin-top: 10px;
  }
  .conversation-message .option-item {
    margin: 0;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .conversation-message .option-item:hover {
    background-color: #e3f2fd;
  }
  .conversation-message .option-item input[type="radio"] {
    margin-right: 8px;
    accent-color: #007bff;
  }
  .conversation-message .option-item label {
    cursor: pointer;
    color: #495057;
    font-weight: 500;
    font-size: 14px;
    margin: 0;
  }
  .conversation-message * {
    margin-top: 0;
  }
  .conversation-message h1, .conversation-message h2, .conversation-message h3 {
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
`;