import React, { useCallback } from 'react';
import { Typography, Card, Button } from 'antd';
import { writeSkillTemplates } from '../skills/writeSkills';
import { useWorkspaceStore } from '../../../core/stores/workspaceStore';

const { Title, Paragraph } = Typography;

export function WritePage() {
  const setDraft = useWorkspaceStore((s) => s.setDraft);

  const handleSkillClick = useCallback(
    (template: string) => {
      setDraft('write', template);
      // Navigate to Chat page — the Sender will pick up the draft via workspaceStore
      useWorkspaceStore.getState().setActiveSurface('sidepanel');
    },
    [setDraft],
  );

  return (
    <div data-options-section="write" style={{ maxWidth: 720, padding: 16 }}>
      <Title level={4}>Write</Title>
      <Paragraph type="secondary">
        Select a writing action to populate the prompt.
      </Paragraph>

      <Card>
        {writeSkillTemplates.map((skill) => (
          <Button
            key={skill.id}
            block
            style={{ marginBottom: 8 }}
            onClick={() => handleSkillClick(skill.template)}
          >
            {skill.name}
          </Button>
        ))}
      </Card>
    </div>
  );
}
