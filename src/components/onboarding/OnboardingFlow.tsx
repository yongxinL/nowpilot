import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { format, t } from '../../core/i18n/strings';
import { debugLog } from '../../core/log/debugLog';
import { PROVIDER_IDS, type ProviderId } from '../../types';
import {
  isValidationCancelled,
  type ProviderValidationErrorCode,
  type ProviderValidationPort,
} from '../../services/ports/providerValidationPort';

const { Title, Text, Paragraph } = Typography;

/** The surface the flow is presented in — the only thing that differs. */
export type OnboardingSurface = 'sidepanel' | 'standalone';

/**
 * The non-secret completion seed a surface may supply (D-06).
 *
 * Structural on purpose: `readOnboardingState()` from
 * `src/core/onboarding/onboardingStateStore.ts` is directly assignable, so the
 * surface passes its reader without an adapter.
 */
export type OnboardingStateRead =
  | { status: 'ok'; state: { uiComplete: boolean; providerId: ProviderId | null } }
  | { status: 'unknown'; reason: string };

/** What the surface persists when the user finishes setup. Never a credential. */
export interface OnboardingCompletionSelection {
  /** Phase 1 renders no persona runtime: the card is a preview (Phase 15). */
  persona: string | null;
  providerId: ProviderId;
}

export interface OnboardingFlowProps {
  /** Whether the surface presents the flow (its render gate owns this). */
  open: boolean;
  /** Surface descriptor — canvas only; steps, state machine and copy are shared. */
  surface: OnboardingSurface;
  /**
   * The typed validation port. Phase 1 passes the fixture adapter; Phase 3
   * passes the real implementation without this component changing (D-05).
   */
  validationPort: ProviderValidationPort;
  /** Navigation adapter: the surface persists the non-secret completion record. */
  onComplete: (selection: OnboardingCompletionSelection) => void;
  /** Navigation adapter: explicit Skip — the surface records an incomplete state. */
  onSkip: () => void;
  /** Optional lifecycle adapter: resumes the non-secret provider selection. */
  readOnboardingState?: () => Promise<OnboardingStateRead>;
  /** Optional navigation adapter: the Side Panel's "Switch to Full setup". */
  onSwitchToFullSetup?: () => void;
}

type Step = 1 | 2 | 3 | 4;

/** One machine, four states — plus the cancelled branch that returns to idle. */
type ValidationStatus = 'idle' | 'testing' | 'ok' | 'error';

const STEP_TITLE_KEYS: Record<Step, string> = {
  1: 'onboarding.step1Title',
  2: 'onboarding.step2Title',
  3: 'onboarding.step3Title',
  4: 'onboarding.step4Title',
};

const STEP_BODY_KEYS: Record<Step, string> = {
  1: 'onboarding.step1Body',
  2: 'onboarding.step2Body',
  3: 'onboarding.step3Body',
  4: 'onboarding.step4Body',
};

/** The typed failure label per canonical code — the `{error}` slot value. */
function failureLabel(code: ProviderValidationErrorCode): string {
  return t(`provider.error.${code}`);
}

/**
 * The shared, surface-independent onboarding flow (D-05, D-06, D-08).
 *
 * One presentation and one flow controller: both surfaces import this module,
 * no surface imports the other, and **no Chrome API is reached here** — the
 * surface supplies navigation and lifecycle adapters through typed props.
 *
 * Key hygiene (D-08) is structural, not conventional: the credential lives in
 * component state only, is never passed to a store, a broadcast, a log or a
 * prop, and is cleared on completion, cancellation, close and every terminal
 * validation state where retention is unnecessary (the failure path keeps it
 * only because Retry must re-validate the same value).
 *
 * Validation is fixture-backed: the injected port performs no request, and the
 * fixture nature is disclosed by the marked `deferred.reasonFixture` notice —
 * never by an error code and never as a live-provider claim.
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  open,
  surface,
  validationPort,
  onComplete,
  onSkip,
  readOnboardingState,
  onSwitchToFullSetup,
}) => {
  const { token } = theme.useToken();

  const [step, setStep] = useState<Step>(1);
  const [providerId, setProviderId] = useState<ProviderId | null>(null);
  const [credential, setCredential] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<ValidationStatus>('idle');
  const [failureCode, setFailureCode] = useState<ProviderValidationErrorCode | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const focusTargetRef = useRef<{ focus: () => void } | null>(null);

  /** Focus the step's first control — on open and on every step change. */
  const focusFirstControl = useCallback(() => {
    focusTargetRef.current?.focus();
  }, []);

  /**
   * The focus-target ref. **Exactly one** control per step carries it, so the
   * target is never ambiguous; a detached node (`null`) is ignored because
   * React detaches the outgoing step's ref after the incoming one attaches.
   */
  const focusTarget = useCallback((node: { focus: () => void } | null) => {
    if (node) focusTargetRef.current = node;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // A validation still in flight is abandoned with the component; the port
      // sees the cancellation through its signal.
      abortRef.current?.abort();
    };
  }, []);

  // Opening resets the attempt; closing clears the in-memory credential.
  useEffect(() => {
    if (open) {
      setStep(1);
      setStatus('idle');
      setFailureCode(null);
    } else {
      setCredential('');
      setRevealed(false);
      setStatus('idle');
      setFailureCode(null);
    }
  }, [open]);

  // Resume the non-secret provider selection from the surface's record. An
  // unreadable or absent record simply leaves the default (nothing selected).
  useEffect(() => {
    if (!open || !readOnboardingState) return;
    let alive = true;
    readOnboardingState()
      .then((result) => {
        if (!alive || result.status !== 'ok') return;
        if (result.state.providerId) setProviderId(result.state.providerId);
      })
      .catch((error: unknown) => {
        // A failed read leaves the flow usable with no selection. Only the
        // failure is reported — the record is non-secret and carries no value.
        debugLog('ONBOARDING_STATE_READ_FAILED', 'completion record unreadable', {
          reason: error instanceof Error ? error.name : typeof error,
        });
      });
    return () => {
      alive = false;
    };
  }, [open, readOnboardingState]);

  // The dialog's own open pass focuses the panel container, so the step focus
  // is applied after it rather than synchronously on mount.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(focusFirstControl, 0);
    return () => window.clearTimeout(id);
  }, [step, open, focusFirstControl]);

  const clearCredential = useCallback(() => {
    setCredential('');
    setRevealed(false);
  }, []);

  const handleValidate = useCallback(async () => {
    if (providerId === null) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('testing');
    setFailureCode(null);

    try {
      const result = await validationPort.validate({
        providerId,
        credential,
        signal: controller.signal,
      });
      if (!mountedRef.current) return;

      if (result.ok) {
        // Terminal success: retention is unnecessary, so the value goes.
        clearCredential();
        setStatus('ok');
        return;
      }

      if (isValidationCancelled(result)) {
        // Cancellation is neither a failure nor a success claim: back to idle.
        clearCredential();
        setStatus('idle');
        return;
      }

      setFailureCode(result.code);
      setStatus('error');
    } catch {
      if (!mountedRef.current) return;
      // The port is documented never to throw; an escaped exception is a
      // check-failed outcome — never a silent success.
      setFailureCode('PROVIDER_CHECK_FAILED');
      setStatus('error');
    }
  }, [providerId, credential, validationPort, clearCredential]);

  const handleFinish = useCallback(() => {
    if (providerId === null) return;
    const selection: OnboardingCompletionSelection = { persona: null, providerId };
    clearCredential();
    setStatus('idle');
    setFailureCode(null);
    onComplete(selection);
  }, [providerId, clearCredential, onComplete]);

  const handleSkip = useCallback(() => {
    clearCredential();
    setStatus('idle');
    setFailureCode(null);
    onSkip();
  }, [clearCredential, onSkip]);

  const handleEditKey = useCallback(() => {
    // Retention is necessary here: the user is going back to edit the value.
    setStatus('idle');
    setFailureCode(null);
    setStep(3);
  }, []);

  const exitAffordance = (
    <Button type="link" onClick={handleSkip} style={{ paddingLeft: 0 }} data-testid="onboarding-skip">
      {t('onboarding.skip')}
    </Button>
  );

  const stepFooter = (options: {
    back?: Step;
    next?: Step;
    nextDisabled?: boolean;
    /** True when this step's first control is the Continue button. */
    focusNext?: boolean;
  }) => {
    const { back, next, nextDisabled, focusNext } = options;
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: token.paddingSM,
          marginTop: token.marginSM,
        }}
      >
        {exitAffordance}
        <Space>
          {back !== undefined && (
            <Button
              onClick={() => setStep(back)}
              icon={<ArrowLeftOutlined />}
              data-testid="onboarding-back"
            >
              {t('onboarding.back')}
            </Button>
          )}
          {next !== undefined && (
            <Button
              ref={focusNext === true ? focusTarget : undefined}
              type="primary"
              disabled={nextDisabled === true}
              onClick={() => setStep(next)}
              data-testid="onboarding-continue"
            >
              {t('onboarding.continue')} <ArrowRightOutlined />
            </Button>
          )}
        </Space>
      </div>
    );
  };

  const renderStep1 = () => (
    <>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t(STEP_BODY_KEYS[1])}
      </Paragraph>
      {/* The persona runtime ships in Phase 15 (RICH-R-03): the card is a preview. */}
      <div
        data-np-backing="fixture"
        data-testid="onboarding-persona-card"
        aria-label={t('deferred.reasonDeferred')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.paddingXS,
          padding: token.paddingSM,
          border: `1px dashed ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          background: token.colorFillQuaternary,
        }}
      >
        <Tag color="warning">{t('deferred.fixtureTag')}</Tag>
        <Text type="secondary">{t('deferred.reasonDeferred')}</Text>
      </div>
      {stepFooter({ next: 2, focusNext: true })}
    </>
  );

  const renderStep2 = () => (
    <>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t(STEP_BODY_KEYS[2])}
      </Paragraph>
      <Select
        ref={focusTarget}
        data-testid="onboarding-provider-select"
        aria-label={t('onboarding.providerPlaceholder')}
        value={providerId}
        onChange={(value: ProviderId) => setProviderId(value)}
        placeholder={t('onboarding.providerPlaceholder')}
        style={{ width: '100%' }}
        options={PROVIDER_IDS.map((id) => ({ value: id, label: t(`provider.name.${id}`) }))}
      />
      {stepFooter({ back: 1, next: 3, nextDisabled: providerId === null })}
    </>
  );

  const renderStep3 = () => (
    <>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t(STEP_BODY_KEYS[3])}
      </Paragraph>
      <div data-np-backing="fixture" aria-label={t('deferred.reasonFixture')}>
        <Input
          ref={focusTarget}
          data-testid="onboarding-credential-input"
          // The reveal toggle is visual only: it flips the input's `type` and
          // never touches the value, the store or any other consumer.
          type={revealed ? 'text' : 'password'}
          value={credential}
          onChange={(event) => setCredential(event.target.value)}
          placeholder={t('onboarding.keyPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          suffix={
            <Tooltip title={revealed ? t('onboarding.hideKey') : t('onboarding.showKey')}>
              <Button
                type="text"
                size="small"
                data-testid="onboarding-credential-reveal"
                aria-label={revealed ? t('onboarding.hideKey') : t('onboarding.showKey')}
                aria-pressed={revealed}
                icon={revealed ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => setRevealed((value) => !value)}
              />
            </Tooltip>
          }
        />
      </div>
      {stepFooter({ back: 2, next: 4, nextDisabled: credential.trim().length === 0 })}
    </>
  );

  const renderStep4 = () => (
    <>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t(STEP_BODY_KEYS[4])}
      </Paragraph>
      {/* Block marker: the whole validation step is fixture-backed (D-05). */}
      <Alert
        type="warning"
        showIcon
        data-np-backing="fixture"
        data-testid="onboarding-fixture-notice"
        aria-label={t('deferred.reasonFixture')}
        message={t('deferred.reasonFixture')}
      />

      {status === 'idle' && (
        <>
          <Button
            ref={focusTarget}
            type="primary"
            block
            data-testid="onboarding-validate"
            onClick={() => void handleValidate()}
          >
            {t('onboarding.validate')}
          </Button>
          <Button
            type="link"
            onClick={() => setStep(3)}
            style={{ paddingLeft: 0 }}
            data-testid="onboarding-back"
          >
            <ArrowLeftOutlined /> {t('onboarding.back')}
          </Button>
        </>
      )}

      {status === 'testing' && (
        <Button
          type="primary"
          block
          loading
          disabled
          data-testid="onboarding-validate"
        >
          {t('onboarding.testing')}
        </Button>
      )}

      {status === 'ok' && (
        <>
          <Space>
            <CheckCircleFilled style={{ color: token.colorSuccess }} aria-hidden="true" />
            <Text strong data-testid="onboarding-success">
              {t('onboarding.connected')}
            </Text>
          </Space>
          <Button
            ref={focusTarget}
            type="primary"
            block
            data-testid="onboarding-finish"
            onClick={handleFinish}
          >
            {t('onboarding.finish')}
          </Button>
        </>
      )}

      {status === 'error' && failureCode !== null && (
        <>
          <Space align="start">
            <CloseCircleFilled style={{ color: token.colorError, marginTop: 4 }} aria-hidden="true" />
            <Text data-testid="onboarding-failure">
              {format('onboarding.failed', { error: failureLabel(failureCode) })}
            </Text>
          </Space>
          <Space>
            <Button data-testid="onboarding-edit-key" onClick={handleEditKey}>
              {t('onboarding.editKey')}
            </Button>
            <Button
              ref={focusTarget}
              type="primary"
              data-testid="onboarding-retry"
              onClick={() => void handleValidate()}
            >
              {t('onboarding.retry')}
            </Button>
          </Space>
        </>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      // Onboarding is the only path to a usable configuration: Escape does not
      // dismiss it and the mask is not closable. Skip and Finish are the only
      // exits, and they are separate callbacks.
      closable={false}
      keyboard={false}
      mask={{ closable: false }}
      footer={null}
      centered
      destroyOnHidden
      width={surface === 'sidepanel' ? 420 : 520}
      afterOpenChange={(visible) => {
        if (visible) focusFirstControl();
      }}
      data-testid="onboarding-modal"
      data-np-surface={surface}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            {t(STEP_TITLE_KEYS[step])}
          </Title>
          <Text
            type="secondary"
            role="status"
            aria-live="polite"
            data-testid="onboarding-step-indicator"
          >
            {format('onboarding.stepIndicator', { n: step })}
          </Text>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {onSwitchToFullSetup && (
          <Button type="link" onClick={onSwitchToFullSetup} data-testid="onboarding-switch-full-setup">
            {t('onboarding.switchToFullSetup')}
          </Button>
        )}
      </Space>
    </Modal>
  );
};
