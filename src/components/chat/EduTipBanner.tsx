import { useState, useEffect, useCallback } from 'react';
import { Alert, Button, theme } from 'antd';
import { tipEligibilityService } from '../../core/edu/TipEligibilityService';
import { TIPS } from '../../core/edu/tipDefinitions';
import { useEduTipsStore } from '../../core/edu/EduTipsStore';

export function EduTipBanner() {
  const { token: antdToken } = theme.useToken();
  const [visibleTipId, setVisibleTipId] = useState<string | null>(null);

  useEffect(() => {
    const eligible = tipEligibilityService.getEligibleTips();
    if (eligible.length > 0) {
      setVisibleTipId(eligible[0]);
    } else {
      setVisibleTipId(null);
    }
  }, []);

  const handleDismiss = useCallback((tipId: string) => {
    useEduTipsStore.getState().dismissTip(tipId);
    setVisibleTipId(null);
  }, []);

  if (!visibleTipId) return null;

  const tip = TIPS.find((t) => t.id === visibleTipId);
  if (!tip) return null;

  return (
    <Alert
      type="info"
      banner
      message={tip.heading}
      description={tip.body}
      closable
      onClose={() => handleDismiss(visibleTipId)}
      action={
        <Button type="link" size="small" onClick={() => handleDismiss(visibleTipId)}>
          {tip.dismissLabel}
        </Button>
      }
      style={{
        marginBottom: 8,
        borderRadius: antdToken.borderRadius,
      }}
    />
  );
}
