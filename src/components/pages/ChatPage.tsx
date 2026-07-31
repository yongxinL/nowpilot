import React, { useState } from 'react';
import { SidepanelChat } from '../chat/SidepanelChat';

export const ChatPage: React.FC = () => {
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SidepanelChat
        isStandalone
        onOpenOptions={() => setOptionsOpen(true)}
      />
    </div>
  );
};
