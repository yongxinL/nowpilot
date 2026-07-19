import { Button, Tooltip, theme } from 'antd';
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons';
import { useVoiceInput } from '../../hooks/useVoiceInput';

export interface VoiceInputButtonProps {
  onTranscript?: (text: string, isFinal: boolean) => void;
}

export function VoiceInputButton({ onTranscript }: VoiceInputButtonProps) {
  const { token: antdToken } = theme.useToken();
  const { isRecording, isSupported, toggle } = useVoiceInput({ onTranscript });

  if (!isSupported) return null;

  return (
    <Tooltip title={isRecording ? 'Stop recording' : 'Start voice input'}>
      <Button
        type="text"
        icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
        onClick={toggle}
        style={
          isRecording
            ? {
                boxShadow: `0 0 0 2px ${antdToken.colorPrimary}40`,
                animation: 'voice-pulse 1.5s ease-in-out infinite',
              }
            : undefined
        }
      />
      {isRecording && (
        <style>{`
          @keyframes voice-pulse {
            0%, 100% { box-shadow: 0 0 0 0 ${antdToken.colorPrimary}40; }
            50% { box-shadow: 0 0 0 4px ${antdToken.colorPrimary}80; }
          }
        `}</style>
      )}
    </Tooltip>
  );
}
