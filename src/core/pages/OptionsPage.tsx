import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

export interface OptionsPageProps {
  sectionId?: string;
}

export function OptionsPage({ sectionId = 'providers' }: OptionsPageProps) {
  return (
    <Card>
      <Title level={3}>Options</Title>
      <Text type="secondary">Section: {sectionId}</Text>
      <p style={{ marginTop: 8 }}>Settings rendering is scaffolded. Detailed sections arrive in a later phase.</p>
    </Card>
  );
}
