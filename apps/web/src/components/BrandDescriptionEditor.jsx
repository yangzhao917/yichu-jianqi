import { useEffect, useState } from 'react'
import { Button, Form, Input, Typography } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function BrandDescriptionEditor() {
  const { brand, updateBrand } = useMuseum()
  const [description, setDescription] = useState(brand?.description || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDescription(brand?.description || '') }, [brand?.description])
  const save = async () => {
    setSaving(true)
    await updateBrand({ description: description.trim() })
    setSaving(false)
  }

  return <section className="console-company" aria-labelledby="company-description-title">
    <div className="console-section-heading"><div><span>企业资料</span><h2 id="company-description-title">企业简介</h2></div><Typography.Text type="secondary">客户从产品继续了解企业时，会看到这里的介绍。</Typography.Text></div>
    <Form layout="vertical" onFinish={save} className="console-company-form">
      <Form.Item label="企业简介" required><Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} showCount /></Form.Item>
      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={description.trim() === (brand?.description || '').trim()}>保存简介</Button>
    </Form>
  </section>
}
