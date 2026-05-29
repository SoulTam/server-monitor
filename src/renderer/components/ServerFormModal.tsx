import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Radio, message } from 'antd';
import type { ServerWithMetrics, CreateServerInput, UpdateServerInput } from '../../shared/ipc-types';
import type { MetricType } from '../../shared/types';

interface ServerFormModalProps {
  open: boolean;
  server?: ServerWithMetrics;
  onClose: () => void;
}

export default function ServerFormModal({ open, server, onClose }: ServerFormModalProps): JSX.Element {
  const [form] = Form.useForm();
  const isEdit = !!server;
  const authType = Form.useWatch('authType', form);

  useEffect(() => {
    if (open && server) {
      form.setFieldsValue({
        name: server.name,
        ip: server.ip,
        port: server.port,
        username: server.username,
        authType: server.authType,
        privateKeyPath: server.privateKeyPath,
        monitorInterval: server.monitorInterval,
        monitorItems: server.monitorItems,
        cpuThreshold: server.cpuThreshold,
        memoryThreshold: server.memoryThreshold,
        diskThreshold: server.diskThreshold,
        networkThreshold: server.networkThreshold,
      });
    } else if (open) {
      form.resetFields();
    }
  }, [open, server, form]);

  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields();
      if (isEdit) {
        const input: UpdateServerInput = { id: server!.id, ...values };
        const res = await window.electronAPI.server.update(input);
        if (res.success) {
          message.success('更新成功');
          onClose();
        } else {
          message.error(res.error || '更新失败');
        }
      } else {
        const input: CreateServerInput = values;
        const res = await window.electronAPI.server.create(input);
        if (res.success) {
          message.success('添加成功');
          onClose();
        } else {
          message.error(res.error || '添加失败');
        }
      }
    } catch {
      // validation failed
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑服务器' : '添加服务器'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      width={520}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          port: 22,
          authType: 'password',
          monitorInterval: 30,
          monitorItems: ['cpu', 'memory', 'disk', 'network'],
          cpuThreshold: 90,
          memoryThreshold: 90,
          diskThreshold: 95,
          networkThreshold: 100,
        }}
      >
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入服务器名称' }]}>
          <Input placeholder="例如: 生产服务器-01" />
        </Form.Item>

        <Form.Item
          name="ip"
          label="IP地址"
          rules={[
            { required: true, message: '请输入IP地址' },
            { pattern: /^(\d{1,3}\.){3}\d{1,3}$/, message: 'IP格式不正确' },
          ]}
        >
          <Input placeholder="例如: 192.168.1.100" />
        </Form.Item>

        <Form.Item name="port" label="端口" rules={[{ required: true }, { type: 'number', min: 1, max: 65535 }]}>
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input placeholder="例如: root" />
        </Form.Item>

        <Form.Item name="authType" label="认证方式">
          <Radio.Group>
            <Radio value="password">密码</Radio>
            <Radio value="key">密钥文件</Radio>
          </Radio.Group>
        </Form.Item>

        {authType === 'password' && (
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !isEdit, message: '请输入密码' }]}
          >
            <Input.Password placeholder={isEdit ? '留空则不修改' : '请输入密码'} />
          </Form.Item>
        )}

        {authType === 'key' && (
          <>
            <Form.Item
              name="privateKeyPath"
              label="密钥文件路径"
              rules={[{ required: true, message: '请输入密钥文件路径' }]}
            >
              <Input placeholder="例如: C:\Users\xxx\.ssh\id_rsa" />
            </Form.Item>
            <Form.Item name="privateKeyPassphrase" label="密钥密码(选填)">
              <Input.Password placeholder="留空表示密钥无密码" />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="monitorInterval"
          label="监控周期(秒)"
          rules={[{ required: true }, { type: 'number', min: 5, message: '最小5秒' }]}
        >
          <InputNumber style={{ width: '100%' }} min={5} />
        </Form.Item>

        <Form.Item name="monitorItems" label="监控项">
          <Select mode="multiple" options={[
            { label: 'CPU', value: 'cpu' },
            { label: '内存', value: 'memory' },
            { label: '磁盘', value: 'disk' },
            { label: '网络', value: 'network' },
          ]} />
        </Form.Item>

        <Form.Item name="cpuThreshold" label="CPU报警阈值(%)">
          <InputNumber style={{ width: '100%' }} min={1} max={100} />
        </Form.Item>

        <Form.Item name="memoryThreshold" label="内存报警阈值(%)">
          <InputNumber style={{ width: '100%' }} min={1} max={100} />
        </Form.Item>

        <Form.Item name="diskThreshold" label="磁盘报警阈值(%)">
          <InputNumber style={{ width: '100%' }} min={1} max={100} />
        </Form.Item>

        <Form.Item name="networkThreshold" label="网络报警阈值(Mbps)">
          <InputNumber style={{ width: '100%' }} min={1} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
