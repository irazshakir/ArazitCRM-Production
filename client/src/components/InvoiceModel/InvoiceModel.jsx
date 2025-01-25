import React, { useState } from 'react';
import { Form, Input, DatePicker, Button, Typography, Table, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Logo from '../../assets/Arazit.svg';
import './InvoiceModel.css';

const { Title } = Typography;
const { TextArea } = Input;

const InvoiceModel = ({ onClose }) => {
  const [form] = Form.useForm();
  const [items, setItems] = useState([{
    key: 0,
    serviceName: '',
    description: '',
    amount: '',
  }]);

  const [amountReceived, setAmountReceived] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);

  const generateInvoiceNumber = () => {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const invoiceCount = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    return `INV-${month}${invoiceCount}-${year}`;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const invoiceData = {
        invoiceNumber: values.invoiceNumber,
        created_date: values.date.format('YYYY-MM-DD'),
        due_date: values.dueDate.format('YYYY-MM-DD'),
        bill_to: values.billTo,
        notes: values.notes || '',
        total_amount: calculateTotal(),
        amount_received: Number(amountReceived) || 0,
        remaining_amount: remainingAmount,
        items: items.map(item => ({
          service_name: item.serviceName,
          description: item.description || '',
          amount: Number(item.amount) || 0
        }))
      };
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create invoice');
      }

      await response.json();
      message.success('Invoice created successfully');
      onClose();
    } catch (error) {
      message.error(error.message || 'Failed to create invoice');
    }
  };

  const columns = [
    {
      title: 'Services',
      dataIndex: 'serviceName',
      key: 'serviceName',
      width: '30%',
      render: (_, record, index) => (
        <Input 
          placeholder="Enter service name"
          value={record.serviceName}
          onChange={(e) => handleItemChange(index, 'serviceName', e.target.value)}
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '40%',
      render: (_, record, index) => (
        <Input 
          placeholder="Enter description"
          value={record.description}
          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: '30%',
      render: (_, record, index) => (
        <Input 
          prefix="PKR"
          placeholder="0.00"
          value={record.amount}
          onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
        />
      ),
    },
  ];

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      key: items.length,
      serviceName: '',
      description: '',
      amount: '',
    }]);
  };

  const calculateTotal = () => {
    return items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  };

  const handleAmountReceivedChange = (e) => {
    const received = parseFloat(e.target.value) || 0;
    const total = calculateTotal();
    const remaining = total - received;
    
    setAmountReceived(received);
    setRemainingAmount(remaining);
  };

  return (
    <div className="invoice-container">
      <div className="invoice-header">
        <div className="left-section">
          <div className="logo-section">
            <img src={Logo} alt="Arazit Logo" className="company-logo" />
            <Title level={4}>Arazit Solutions</Title>
            
            <Form form={form} layout="vertical">
              <Form.Item 
                label="Bill To" 
                name="billTo"
                rules={[{ required: true, message: 'Billing details are required' }]}
              >
                <TextArea rows={4} placeholder="Enter billing details" />
              </Form.Item>

              <Form.Item 
                label="Notes" 
                name="notes"
              >
                <TextArea 
                  rows={6} 
                  placeholder="Add any notes or payment instructions" 
                />
              </Form.Item>
            </Form>
          </div>
        </div>

        <div className="right-section">
          <Title level={2}>INVOICE</Title>
          <Form form={form} layout="vertical">
            <Form.Item 
              label="Invoice Number" 
              name="invoiceNumber" 
              initialValue={generateInvoiceNumber()}
              rules={[{ required: true, message: 'Invoice number is required' }]}
            >
              <Input disabled />
            </Form.Item>
            
            <Form.Item 
              label="Date" 
              name="date"
              rules={[{ required: true, message: 'Date is required' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item 
              label="Due Date" 
              name="dueDate"
              rules={[{ required: true, message: 'Due date is required' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={items}
        pagination={false}
        className="items-table"
      />

      <Button 
        type="default" 
        icon={<PlusOutlined />} 
        onClick={addItem}
        className="add-item-btn"
      >
        Add Line
      </Button>

      <div className="invoice-footer">
        <div className="totals-section">
          <div className="amount-fields">
            <Form.Item label="Amount Received" name="amountReceived">
              <Input
                prefix="PKR"
                placeholder="0.00"
                onChange={handleAmountReceivedChange}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Remaining Amount">
              <Input
                prefix="PKR"
                placeholder="0.00"
                disabled
                value={remainingAmount ? remainingAmount.toFixed(2) : '0.00'}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
          <div className="total">
            <span>Total:</span>
            <span>PKR {calculateTotal().toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={onClose} className="mr-2">
          Cancel
        </Button>
        <Button 
          type="primary" 
          onClick={handleSubmit}
          style={{ 
            backgroundColor: '#aa2478',
            borderColor: '#aa2478'
          }}
        >
          Create Invoice
        </Button>
      </div>
    </div>
  );
};

export default InvoiceModel;
