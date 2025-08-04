import React, { useState, useEffect } from 'react';

const Notification = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose && onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#28a745';
      case 'error':
        return '#dc3545';
      case 'info':
        return '#17a2b8';
      case 'warning':
        return '#ffc107';
      default:
        return '#17a2b8';
    }
  };

  return (
    <div 
      className="notification"
      style={{
        backgroundColor: getBackgroundColor(),
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0
      }}
    >
      <span style={{ marginRight: '8px' }}>{getIcon()}</span>
      {message}
    </div>
  );
};

export default Notification; 