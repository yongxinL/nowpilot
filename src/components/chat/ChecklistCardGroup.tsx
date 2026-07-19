import { memo, useState, useCallback, type ReactElement, type ReactNode } from 'react';
import { Checkbox, Progress, Typography, theme } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

export interface ChecklistCardGroupProps {
  children?: ReactNode;
  start?: number;
  'data-message-id'?: string;
}

export const ChecklistCardGroup = memo(function ChecklistCardGroup({
  children,
  start,
  'data-message-id': messageId,
}: ChecklistCardGroupProps) {
  const { token } = theme.useToken();
  const items = Array.isArray(children) ? (children as ReactElement[]) : [];
  const itemCount = items.length;

  if (itemCount < 2) {
    return <ol start={start}>{children}</ol>;
  }

  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggleItem = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const completed = checked.size;
  const percent = itemCount > 0 ? Math.round((completed / itemCount) * 100) : 0;
  const allDone = completed === itemCount;

  const getLiText = (child: ReactElement): string => {
    const node = child.props?.children;
    if (typeof node === 'string') return node;
    return '';
  };

  return (
    <div style={{ margin: `${token.marginSM}px 0` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, marginBottom: token.marginXS }}>
        <Progress
          percent={percent}
          size="small"
          style={{ flex: 1, margin: 0 }}
          strokeColor={allDone ? token.colorSuccess : token.colorPrimary}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {allDone ? `All ${itemCount} completed` : `${completed}/${itemCount} completed`}
        </Typography.Text>
      </div>
      <ol start={start} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((child, index) => {
          const isChecked = checked.has(index);
          const text = getLiText(child);
          return (
            <li
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: token.marginXS,
                padding: `${token.paddingXXS}px 0`,
                opacity: isChecked ? 0.6 : 1,
              }}
            >
              <Checkbox
                checked={isChecked}
                onChange={(_e: CheckboxChangeEvent) => toggleItem(index)}
                style={{ marginTop: 3 }}
              />
              <Typography.Text
                delete={isChecked}
                style={{ flex: 1 }}
              >
                {text || child}
              </Typography.Text>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
