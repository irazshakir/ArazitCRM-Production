import React, { useState } from 'react';
import { Modal, Form, Input, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';

const { TextArea } = Input;

const AddPaymentModal = ({ visible, onClose, invoiceId, remainingAmount, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const paymentData = {
        amount: Number(values.amount),
        paymentType: values.paymentType,
        paymentDate: values.paymentDate.format('YYYY-MM-DD'),
        notes: values.notes || ''
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/${invoiceId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add payment');
      }

      message.success('Payment added successfully');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error) {
      message.error(error.message || 'Failed to add payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Payment"
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okButtonProps={{ 
        style: { backgroundColor: '#aa2478', borderColor: '#aa2478' } 
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          paymentDate: dayjs(),
        }}
      >
        <Form.Item
          name="amount"
          label="Amount"
          rules={[
            { required: true, message: 'Please enter amount' },
            {
              validator: (_, value) => {
                if (value && Number(value) > remainingAmount) {
                  return Promise.reject('Amount cannot exceed remaining balance');
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <Input
            prefix="PKR"
            type="number"
            placeholder="0.00"
            max={remainingAmount}
          />
        </Form.Item>

        <Form.Item
          name="paymentType"
          label="Payment Type"
          rules={[{ required: true, message: 'Please select payment type' }]}
        >
          <Select>
            <Select.Option value="Cash">Cash</Select.Option>
            <Select.Option value="Online">Online</Select.Option>
            <Select.Option value="Cheque">Cheque</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="paymentDate"
          label="Payment Date"
          rules={[{ required: true, message: 'Please select date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="notes"
          label="Notes"
        >
          <TextArea rows={4} placeholder="Add any payment notes" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddPaymentModal; 