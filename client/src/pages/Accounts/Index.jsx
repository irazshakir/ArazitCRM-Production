import { useState, useEffect } from 'react';
import { Card, DatePicker, Select, Space, Button, Modal, Form, Input, InputNumber, message } from 'antd';
import { DollarOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import UniversalTable from '../../components/UniversalTable';
import ActionDropdown from '../../components/ActionDropdown';
import AccountModel from '../../components/AccountModel/AccountModel';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const Accounts = () => {
  const [timeRange, setTimeRange] = useState('7days');
  const [dateRange, setDateRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    received: 0,
    expenses: 0,
    pending: 0,
    total: 0
  });

  const columns = [
    {
      title: 'SR',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (text, record, index) => index + 1,
    },
    {
      title: 'DATE',
      dataIndex: 'payment_date',
      key: 'payment_date',
      render: (date) => {
        const formattedDate = new Date(date).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        return <span>{formattedDate}</span>;
      },
    },
    {
      title: 'TYPE',
      dataIndex: 'payment_type',
      key: 'payment_type',
      render: (type) => (
        <span 
          className={`px-2 py-1 rounded-full ${
            type === 'Received' ? 'bg-green-50 text-green-600' : 
            type === 'Expenses' ? 'bg-red-50 text-red-600' : 
            'bg-blue-50 text-blue-600'
          } text-sm`}
        >
          {type}
        </span>
      ),
    },
    {
      title: 'MODE',
      dataIndex: 'payment_mode',
      key: 'payment_mode',
    },
    {
      title: 'AMOUNT',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `AED ${amount.toFixed(0)}`,
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <ActionDropdown 
          onEdit={() => handleEdit(record)}
          onDelete={() => handleDelete(record)}
        />
      ),
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounts?timeRange=${timeRange}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch data');
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data.transactions)) {
        throw new Error('Invalid transactions data received');
      }
      
      setTransactions(data.transactions);
      setStats(data.stats);
    } catch (error) {
      message.error('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    // fetchData will be triggered by useEffect
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    // Add logic to fetch data based on selected date range
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    // Add search logic here
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalOpen(false);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      type: record.payment_type,
      mode: record.payment_mode,
      amount: record.amount,
      client_name: record.client_name,
      notes: record.notes
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      
      const formattedValues = {
        payment_type: values.payment_type, // Changed from values.type
        payment_mode: values.payment_mode, // Changed from values.mode
        amount: parseFloat(values.amount),
        payment_date: values.payment_date,
        client_name: values.client_name || null,
        notes: values.notes || null,
        payment_credit_debit: ['Received', 'Refunds'].includes(values.payment_type) 
          ? 'credit' 
          : 'debit'
      };

      const url = editingRecord 
        ? `${import.meta.env.VITE_API_URL}/api/accounts/${editingRecord.id}`
        : `${import.meta.env.VITE_API_URL}/api/accounts`;

      const method = editingRecord ? 'PUT' : 'POST';

      console.log('Submitting values:', formattedValues); // Debug log

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedValues)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${editingRecord ? 'update' : 'create'} transaction`);
      }

      await response.json();
      message.success(`Transaction ${editingRecord ? 'updated' : 'created'} successfully`);
      handleModalClose();
      fetchData(); // Refresh the list
      
    } catch (error) {
      message.error(`Error ${editingRecord ? 'updating' : 'creating'} transaction: ` + error.message);
      console.error('Full error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/accounts/${record.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      message.success('Transaction deleted successfully');
    } catch (error) {
      message.error('Error deleting transaction: ' + error.message);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounts/export?timeRange=${timeRange}`,
        { method: 'GET' }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounts_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      message.success('Data exported successfully');
    } catch (error) {
      message.error('Failed to export data: ' + error.message);
    }
  };

  const modalTitle = editingRecord ? 'Edit Transaction' : 'Add New Transaction';

  useEffect(() => {
    fetchData();
  }, [timeRange]); // Refetch when timeRange changes

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleModalOpen}
            style={{ 
              backgroundColor: '#aa2478',
              borderColor: '#aa2478'
            }}
          >
            Add Transaction
          </Button>
        </div>

        <Space className="mb-6" size="middle">
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: 200 }}
            options={[
              { value: '7days', label: 'Past 7 Days' },
              { value: '30days', label: 'Past 30 Days' },
              { value: '90days', label: 'Past 90 Days' },
              { value: 'prevMonth', label: 'Previous Month' },
              { value: 'currMonth', label: 'Current Month' },
            ]}
          />
          <RangePicker onChange={handleDateRangeChange} />
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleExportData}
            style={{ 
              backgroundColor: '#aa2478',
              borderColor: '#aa2478',
              color: 'white'
            }}
          >
            Export
          </Button>
        </Space>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Received</p>
                <h2 className="text-2xl font-semibold">AED {stats.received.toFixed(0)}</h2>
              </div>
              <DollarOutlined className="text-2xl text-green-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Expenses</p>
                <h2 className="text-2xl font-semibold">AED {stats.expenses.toFixed(0)}</h2>
              </div>
              <DollarOutlined className="text-2xl text-red-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Pending</p>
                <h2 className="text-2xl font-semibold">AED {stats.pending.toFixed(0)}</h2>
              </div>
              <DollarOutlined className="text-2xl text-yellow-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600">Total</p>
                <h2 className="text-2xl font-semibold">AED {stats.total.toFixed(0)}</h2>
              </div>
              <DollarOutlined className="text-2xl text-blue-500" />
            </div>
          </Card>
        </div>
      </div>

      <UniversalTable 
        columns={columns}
        dataSource={transactions}
        loading={loading}
        onSearch={handleSearch}
        searchPlaceholder="Search transactions..."
        rowKey="id"
      />

      {/* Add Transaction Modal */}
      <AccountModel
        open={isModalOpen}
        onCancel={handleModalClose}
        onSubmit={handleSubmit}
        initialValues={editingRecord ? {
          payment_type: editingRecord.payment_type,
          payment_mode: editingRecord.payment_mode,
          amount: editingRecord.amount,
          payment_date: dayjs(editingRecord.payment_date),
          client_name: editingRecord.client_name,
          notes: editingRecord.notes
        } : undefined}
        title={editingRecord ? 'Edit Transaction' : 'Add New Transaction'}
      />
    </div>
  );
};

export default Accounts;
