import React, { useEffect, useState } from 'react';
import { Button, Modal, Space, Typography } from 'antd';
import {
  readOnboardingState,
  writeOnboardingState,
} from '../../core/onboarding/onboardingStateStore';
import { t } from '../../core/i18n/strings';

/**
 * The **single** user-visible output of D-07's legacy plaintext credential
 * cleanup (UI-SPEC § Copywriting Contract — `provider.credentialsCleared`).
 *
 * What this component must never do:
 *   - it must not reveal whether a credential was found. Its copy is the pinned
 *     neutral sentence, it reads no cleanup result and it is shown exactly once
 *     per record regardless of what the migration found — so its appearance
 *     discloses nothing about the user's previous configuration;
 *   - it must not carry any part of a deleted value. Nothing here reads, renders
 *     or logs a credential; the only fact it reads is a boolean;
 *   - it must not invent a second storage key. The "shown" state lives on the
 *     existing onboarding record (`legacyCleanupNoticeShown`), so there is one
 *     key, one writer and one source of truth;
 *   - it must not open a surface or broadcast anything. It renders in whichever
 *     surface the user opened, and only there.
 *
 * It is mounted by both surface roots once the onboarding gate has settled and
 * the shared flow is not presenting, so the two modals never stack: the notice
 * presents as soon as the user is looking at a surface and is dismissed through
 * the pinned `Dismiss` label, which is the only dismissal path (no Escape, no
 * mask click, no close button) so the shown-state can never be skipped.
 */
export const LegacyCredentialCleanupNotice: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    void readOnboardingState().then((result) => {
      if (!alive) return;
      // A record that says the notice was shown is the only reason to stay
      // silent; a missing or unreadable record presents it once rather than
      // guessing. Note what is NOT read here: no cleanup result, no
      // found/not-found flag, no credential field.
      if (result.status === 'ok' && result.state.legacyCleanupNoticeShown) return;
      setOpen(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    // A non-secret boolean on the existing record — no second key, no second
    // writer. The write is fire-and-forget: the notice is already closed.
    void writeOnboardingState({ legacyCleanupNoticeShown: true });
  };

  if (!open) return null;

  return (
    <Modal
      open
      // The pinned `Dismiss` label is the single exit: Escape, the mask and a
      // close button would all leave the shown-state unrecorded.
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      footer={null}
      centered
      destroyOnHidden
      width={420}
      data-testid="legacy-credential-cleanup-notice"
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Text>{t('provider.credentialsCleared')}</Typography.Text>
        <Button type="primary" onClick={dismiss}>
          {t('provider.credentialsClearedDismiss')}
        </Button>
      </Space>
    </Modal>
  );
};
