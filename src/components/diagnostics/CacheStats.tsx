import { Row, Col, Statistic } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { CacheTrace } from '../../core/telemetry/types';

export interface CacheStatsProps {
  cacheTraces: CacheTrace[];
}

export function CacheStats({ cacheTraces }: CacheStatsProps) {
  const hits = cacheTraces.filter((c) => c.event === 'hit').length;
  const misses = cacheTraces.filter((c) => c.event === 'miss').length;
  const invalidations = cacheTraces.filter((c) => c.event === 'invalidation').length;
  const tokensSaved = cacheTraces.reduce(
    (sum, c) => sum + (c.estimatedTokenSavings ?? 0),
    0,
  );

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Statistic
          title="Cache Hits"
          value={hits}
          prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Cache Misses"
          value={misses}
          prefix={<CloseCircleOutlined style={{ color: '#faad14' }} />}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Tokens Saved"
          value={tokensSaved}
          suffix="tokens"
          prefix={<DollarOutlined style={{ color: '#1890ff' }} />}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Invalidations"
          value={invalidations}
          prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
        />
      </Col>
    </Row>
  );
}
