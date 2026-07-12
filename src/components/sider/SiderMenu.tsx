import { useMemo } from 'react';
import { theme } from 'antd';
import type { CSSProperties } from 'react';
import { selectNavItems } from '../../core/navigation/navigationSelectors';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { SiderMenuItem } from './SiderMenuItem';

export interface SiderMenuProps {
  surface: 'standalone' | 'sidepanel';
  density: 'expanded' | 'collapsed' | 'narrow';
  activeId: string;
  onSelect: (item: NowPilotNavItem) => void;
  showGroups?: boolean;
  showArrows?: boolean;
  style?: CSSProperties;
}

export function SiderMenu({
  surface,
  density,
  activeId,
  onSelect,
  showGroups = false,
  showArrows = false,
  style,
}: SiderMenuProps) {
  const { token } = theme.useToken();

  const coreItems = useMemo(() => selectNavItems({ surface, group: 'core' }), [surface]);
  const addonItems = useMemo(() => selectNavItems({ surface, group: 'addons' }), [surface]);

  const itemDensity = density === 'expanded' ? 'expanded' : surface === 'standalone' ? 'collapsed' : 'narrow';

  return (
    <div role="group" aria-label="Sider menu" style={style}>
      {coreItems.map((item) => (
        <SiderMenuItem
          key={item.id}
          item={item}
          active={item.id === activeId}
          density={itemDensity}
          surface={surface}
          onClick={onSelect}
          showArrow={showArrows && item.showArrowInStandaloneExpanded === true}
        />
      ))}

      {showGroups && addonItems.length > 0 && (
        <div
          role="separator"
          style={{
            height: 1,
            backgroundColor: token.colorBorderSecondary,
            margin: '8px 0',
          }}
        />
      )}

      {addonItems.map((item) => (
        <SiderMenuItem
          key={item.id}
          item={item}
          active={item.id === activeId}
          density={itemDensity}
          surface={surface}
          onClick={onSelect}
          showArrow={showArrows && item.showArrowInStandaloneExpanded === true}
        />
      ))}
    </div>
  );
}
