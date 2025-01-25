import React, { useState, useEffect } from 'react';
import { Form, Input, DatePicker, Button, Table, message, Modal, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AddPaymentModal from './AddPaymentModal';
import Logo from '../../assets/Arazit.svg';
import './EditInvoice.css';

const { TextArea } = Input;
const { Title } = Typography;

const EditInvoice = ({ invoice, visible, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (invoice && invoice.id) {
      form.setFieldsValue({
        invoiceNumber: invoice.invoice_number,
        billTo: invoice.bill_to,
        date: dayjs(invoice.created_date),
        dueDate: dayjs(invoice.due_date),
        notes: invoice.notes,
      });
      
      // Use items directly from invoice object
      if (invoice.invoice_items) {
        const formattedItems = invoice.invoice_items.map(item => ({
          key: item.id,
          serviceName: item.service_name,
          description: item.description,
          amount: Number(item.amount),
        }));
        setItems(formattedItems);
        
        // Calculate total from items
        const total = formattedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        setTotalAmount(total);
      }
      
      // Use payment history from invoice if available
      if (invoice.payment_history) {
        setPaymentHistory(invoice.payment_history);
      } else {
        fetchPaymentHistory();
      }
    }
  }, [invoice]);

  const fetchInvoiceItems = async () => {
    try {
      if (!invoice || !invoice.id) return;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice.id}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoice items');
      }
      
      const data = await response.json();
      
      const formattedItems = data.map(item => ({
        key: item.id,
        serviceName: item.service_name,
        description: item.description,
        amount: Number(item.amount),
      }));
      
      setItems(formattedItems);
      
      // Calculate total from items
      const total = formattedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      setTotalAmount(total);
    } catch (error) {
      message.error('Failed to fetch invoice items');
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      if (!invoice || !invoice.id) return;
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice.id}/payments`);
      if (!response.ok) throw new Error('Failed to fetch payment history');
      
      const data = await response.json();
      setPaymentHistory(data);
    } catch (error) {
      message.error('Failed to fetch payment history');
    }
  };

  const handleUpdateInvoice = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const updateData = {
        created_date: values.date.format('YYYY-MM-DD'),
        due_date: values.dueDate.format('YYYY-MM-DD'),
        billTo: values.billTo,
        notes: values.notes,
        total_amount: totalAmount,
        items: items.map(item => ({
          service_name: item.serviceName,
          description: item.description,
          amount: Number(item.amount)
        }))
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update invoice');
      }
      
      message.success('Invoice updated successfully');
      onUpdate();
      onClose();
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
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
          prefix="AED"
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
    
    // Recalculate total whenever items change
    const newTotal = newItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    setTotalAmount(newTotal);
  };

  const addItem = () => {
    setItems([...items, {
      key: items.length,
      serviceName: '',
      description: '',
      amount: '',
    }]);
  };

  const paymentColumns = [
    {
      title: 'Date',
      dataIndex: 'payment_date',
      key: 'payment_date',
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `AED ${Number(amount).toFixed(2)}`,
    },
    {
      title: 'Payment Type',
      dataIndex: 'payment_type',
      key: 'payment_type',
    },
    {
      title: 'Notes',
      dataIndex: 'payment_notes',
      key: 'payment_notes',
      render: (notes) => notes || '-',
    },
    {
      title: 'Remaining',
      dataIndex: 'remaining_amount',
      key: 'remaining_amount',
      render: (amount) => `AED ${Number(amount).toFixed(2)}`,
    }
  ];

  return (
    <Modal
      title="Edit Invoice"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
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
                rules={[{ required: true }]}
              >
                <Input disabled />
              </Form.Item>
              
              <Form.Item
                label="Date"
                name="date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Due Date"
                name="dueDate"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          </div>
        </div>

        <div className="invoice-body">
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
            <div className="payment-section">
              <div className="payment-header">
                <h3 className="text-lg font-semibold">Payment History</h3>
                <Button
                  type="primary"
                  onClick={() => setIsPaymentModalVisible(true)}
                  style={{ 
                    backgroundColor: '#aa2478',
                    borderColor: '#aa2478'
                  }}
                >
                  Add Payment
                </Button>
              </div>

              <Table
                columns={paymentColumns}
                dataSource={paymentHistory}
                rowKey="id"
                pagination={false}
                className="payment-history-table"
              />
            </div>

            <div className="amounts-container">
              <div className="summary-section">
                <div className="summary-row">
                  <span>Amount Received:</span>
                  <span className="amount">AED {invoice?.amount_received?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="summary-row">
                  <span>Remaining Amount:</span>
                  <span className="amount">AED {invoice?.remaining_amount?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="summary-row total">
                  <span>Total:</span>
                  <span className="amount">AED {totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <Button onClick={onClose} className="mr-2">
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleUpdateInvoice}
              loading={loading}
              style={{ 
                backgroundColor: '#aa2478',
                borderColor: '#aa2478'
              }}
            >
              Update Invoice
            </Button>
          </div>
        </div>

        <AddPaymentModal
          visible={isPaymentModalVisible}
          onClose={() => {
            setIsPaymentModalVisible(false);
            form.resetFields();
          }}
          invoiceId={invoice?.id}
          remainingAmount={invoice?.remaining_amount}
          onSuccess={() => {
            fetchPaymentHistory();
            onUpdate();
            setIsPaymentModalVisible(false);
          }}
        />
      </div>
    </Modal>
  );
};

export default EditInvoice; 