import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Descriptions, Button, Space } from 'antd';
import { useAlertStore } from '../stores/alertStore';
import dayjs from 'dayjs';

export default function AlertPopup(): JSX.Element {
  const navigate = useNavigate();
  const { pendingPopup, dismissPopup } = useAlertStore();

  useEffect(() => {
    const unsubscribe = window.electronAPI.alert.onNotification((alert) => {
      useAlertStore.getState().showPopup(alert);
    });
    return unsubscribe;
  }, []);

  const handleViewDetail = (): void => {
    if (pendingPopup) {
      navigate(`/server/${pendingPopup.serverId}`);
      dismissPopup();
    }
  };

  const handleDismiss = async (): Promise<void> => {
    if (pendingPopup) {
      await window.electronAPI.alert.dismiss(pendingPopup.id);
      dismissPopup();
    }
  };

  const typeLabel: Record<string, string> = {
    cpu: 'CPU',
    memory: '内存',
    disk: '磁盘',
    network: '网络',
  };

  return (
    <Modal
      title="报警通知"
      open={!!pendingPopup}
      onCancel={dismissPopup}
      footer={
        <Space>
          <Button onClick={handleDismiss}>忽略</Button>
          <Button type="primary" onClick={handleViewDetail}>
            查看详情
          </Button>
        </Space>
      }
      width={400}
    >
      {pendingPopup && (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="报警类型">
            {typeLabel[pendingPopup.alertType] || pendingPopup.alertType}
          </Descriptions.Item>
          <Descriptions.Item label="当前值">{pendingPopup.currentValue.toFixed(1)}%</Descriptions.Item>
          <Descriptions.Item label="阈值">{pendingPopup.threshold}%</Descriptions.Item>
          <Descriptions.Item label="时间">
            {dayjs(pendingPopup.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
