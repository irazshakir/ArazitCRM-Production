import { useState, useEffect } from 'react';
import { 
  Typography, 
  Table, 
  Button, 
  Space, 
  Dropdown, 
  Menu,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Layout,
  Tag,
  Drawer
} from 'antd';
import { 
  FilterOutlined, 
  ExportOutlined, 
  ImportOutlined, 
  PlusOutlined,
  MoreOutlined 
} from '@ant-design/icons';
import theme from '../../theme';
import axios from 'axios';
import TableSkeleton from '../../components/TableSkeleton';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash/debounce';
import moment from 'moment';

const { Title } = Typography;
const { TextArea } = Input;

axios.defaults.baseURL = import.meta.env.VITE_API_URL;  // Your backend URL

// Move the debounced function outside the component to prevent recreation
const debouncedFetchLeads = debounce(async (value, callback) => {
  callback(value);
}, 500);

const getStageColor = (stageName) => {
  const stageColors = {
    'New Lead': 'blue',
    'Hot Lead': 'volcano',
    'Cold Lead': 'default',
    'Warm Lead': 'orange',
    'Won': 'success',
    'Lost': 'error',
    'Follow Up': 'processing',
    'Proposal Sent': 'warning'
  };
  return stageColors[stageName] || 'default';
};

// Add this style object for scrollbar customization
const scrollbarStyle = {
  /* For Webkit browsers like Chrome/Safari */
  '&::-webkit-scrollbar': {
    width: '6px',
    height: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#c1c1c1',
    borderRadius: '3px',
    '&:hover': {
      background: '#a8a8a8',
    },
  },
  /* For Firefox */
  scrollbarWidth: 'thin',
  scrollbarColor: '#c1c1c1 #f1f1f1',
};

const Leads = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingLead, setEditingLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // State for dropdown data
  const [products, setProducts] = useState([]);
  const [stages, setStages] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [branches, setBranches] = useState([]);

  // Add these state variables
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    lead_product: null,
    lead_stage: null,
    assigned_user: null,
    lead_active_status: null
  });

  // Fetch dropdown data
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [productsRes, stagesRes, sourcesRes, usersRes, branchesRes] = await Promise.all([
          axios.get('/api/products'),
          axios.get('/api/stages'),
          axios.get('/api/lead-sources'),
          axios.get('/api/users'),
          axios.get('/api/branches')
        ]);

        setProducts(productsRes.data || []);
        setStages(stagesRes.data || []);
        setLeadSources(sourcesRes.data || []);
        setUsers(usersRes.data || []);
        setBranches(branchesRes.data || []);
      } catch (error) {
        message.error('Failed to fetch dropdown data');
      }
    };

    fetchDropdownData();
  }, []);

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/leads');
      setLeads(sortLeads(response.data)); // Apply sorting here
    } catch (error) {
      message.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleAddEdit = async (values) => {
    try {
      const formattedValues = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        lead_product: values.lead_product,
        lead_stage: values.lead_stage,
        lead_source_id: values.lead_source_id,
        assigned_user: values.assigned_user,
        initial_remarks: values.initial_remarks,
        lead_active_status: values.lead_active_status,
        branch_id: values.branch_id,
        fu_date: values.fu_date ? new Date(values.fu_date).toISOString().split('T')[0] : null
      };

      if (editingLead) {
        await axios.put(`/api/leads/${editingLead.id}`, formattedValues);
        message.success('Lead updated successfully');
      } else {
        await axios.post('/api/leads', formattedValues);
        message.success('Lead added successfully');
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingLead(null);
      fetchLeads();
    } catch (error) {
      message.error('Operation failed: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  // When opening the edit modal, format the date for the form
  const handleEdit = (record) => {
    const formData = {
      name: record.name,
      email: record.email,
      phone: record.phone,
      lead_product: record.lead_product,
      lead_stage: record.lead_stage,
      lead_source_id: record.lead_source_id,
      assigned_user: record.assigned_user,
      initial_remarks: record.initial_remarks,
      lead_active_status: record.lead_active_status,
      branch_id: record.branch_id,
      fu_date: record.fu_date ? record.fu_date.split('T')[0] : null
    };
    
    setEditingLead(record);
    form.setFieldsValue(formData);
    setIsModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/leads/${id}`);
      message.success('Lead deleted successfully');
      fetchLeads();
    } catch (error) {
      message.error('Delete failed');
    }
  };

  // Add this sorting helper function
  const sortLeads = (leads) => {
    return leads.sort((a, b) => {
      // First, sort by active status
      if (a.lead_active_status !== b.lead_active_status) {
        return a.lead_active_status ? -1 : 1;
      }

      // For leads with same active status, sort by followup date
      const dateA = new Date(a.fu_date);
      const dateB = new Date(b.fu_date);
      return dateA - dateB;
    });
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    debouncedFetchLeads(value, async (searchTerm) => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/leads${searchTerm ? `?search=${searchTerm}` : ''}`);
        setLeads(sortLeads(response.data)); // Apply sorting here
      } catch (error) {
        message.error('Failed to fetch leads');
      } finally {
        setLoading(false);
      }
    });
  };

  // Add this function to handle filter changes
  const handleFilterChange = async () => {
    setLoading(true);
    try {
      let query = '/api/leads?';
      
      // Build query string from filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null) {
          query += `${key}=${value}&`;
        }
      });

      const response = await axios.get(query.slice(0, -1)); // Remove last &
      setLeads(sortLeads(response.data)); // Apply sorting here
    } catch (error) {
      message.error('Failed to apply filters');
    } finally {
      setLoading(false);
    }
  };

  // Add this function to reset filters
  const resetFilters = () => {
    setFilters({
      lead_product: null,
      lead_stage: null,
      assigned_user: null,
      lead_active_status: null
    });
    fetchLeads(); // Fetch all leads without filters
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => {
        const followupDate = record.fu_date ? new Date(record.fu_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return (
          <Space>
            {text}
            {followupDate && followupDate < today && record.lead_active_status && (
              <Tag color="error" style={{ marginLeft: 8 }}>
                Alert !
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Product',
      dataIndex: ['products', 'product_name'],
      key: 'product',
    },
    {
      title: 'Stage',
      dataIndex: ['stages', 'stage_name'],
      key: 'stage',
      render: (text) => (
        <Tag color={getStageColor(text)}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: ['users', 'name'],
      key: 'assigned_user',
    },
    {
      title: 'Status',
      dataIndex: 'lead_active_status',
      key: 'status',
      render: (status) => (
        <span style={{ 
          color: status ? '#52c41a' : '#ff4d4f',
          fontWeight: '500'
        }}>
          {status ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      title: 'Followup Date',
      dataIndex: 'fu_date',
      key: 'followup',
      render: (text) => text ? moment(text).format('D MMM YY') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item 
                key="view" 
                onClick={() => navigate(`/admin/leads/${record.id}`)}
              >
                View & Edit
              </Menu.Item>
              <Menu.Item 
                key="delete" 
                danger 
                onClick={() => handleDelete(record.id)}
              >
                Delete
              </Menu.Item>
            </Menu>
          }
          trigger={['click']}
          placement="bottomRight"
        >
          <Button 
            type="text" 
            icon={<MoreOutlined />}
            style={{ padding: '4px 8px' }}
          />
        </Dropdown>
      ),
    },
  ];

  const headerStyle = {
    padding: '16px 24px',
    background: '#fff',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: 0,
    height: '64px', // Fixed header height
    position: 'sticky',
    top: 0,
    zIndex: 1
  };

  const actionButtonStyle = {
    display: 'flex',
    gap: '8px',
  };

  return (
    <Layout style={{ 
      margin: 0, 
      padding: 0, 
      height: '100vh',
      overflow: 'hidden', // Prevent main scroll
      backgroundColor: '#fff'
    }}>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // Take full height
        overflow: 'hidden' // Prevent scroll here
      }}>
        {/* Header Section - Fixed height */}
        <div style={{
          ...headerStyle,
          flex: '0 0 64px', // Fixed header height
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Title level={4} style={{ margin: 0 }}>Leads</Title>
            <Input.Search
              placeholder="Search leads..."
              allowClear
              style={{ width: 250 }}
              onChange={(e) => handleSearch(e.target.value)}
              value={searchQuery}
            />
          </div>
          <div style={actionButtonStyle}>
            <Button 
              icon={<FilterOutlined />} 
              onClick={() => setIsFilterDrawerOpen(true)}
            >
              Filter
            </Button>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button icon={<ImportOutlined />}>Import</Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setIsModalVisible(true);
                setEditingLead(null);
                form.resetFields();
              }}
              style={{ background: theme.colors.primary }}
            >
              Add Lead
            </Button>
          </div>
        </div>

        {/* Table Container - Flexible height with scroll */}
        <div style={{ 
          flex: '1 1 auto',
          overflow: 'hidden', // Hide overflow
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {loading ? (
            <TableSkeleton />
          ) : (
            <Table
              columns={columns}
              dataSource={leads}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              rowKey="id"
              pagination={{
                total: leads.length,
                showTotal: (total) => `Total ${total} items`,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSize: 10,
                style: { 
                  marginBottom: 0,
                  padding: '16px 0'
                }
              }}
              scroll={{ 
                y: 'calc(100vh - 200px)' // Adjusted calculation
              }}
              style={{ 
                margin: 0,
                padding: 0,
                flex: 1
              }}
            />
          )}
        </div>
      </div>

      {/* Add/Edit Lead Modal */}
      <Modal
        title={editingLead ? 'Edit Lead' : 'Add Lead'}
        visible={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingLead(null);
          form.resetFields();
        }}
        footer={null}
        width={720}
        bodyStyle={{ 
          maxHeight: 'calc(100vh - 200px)',
          overflow: 'auto'
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddEdit}
          initialValues={{ lead_active_status: true }}
          style={{ padding: '20px 0' }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input name!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Please input valid email!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ required: true, message: 'Please input phone!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="lead_product"
            label="Product"
            rules={[{ required: true, message: 'Please select product!' }]}
          >
            <Select>
              {products.map(product => (
                <Select.Option key={product.id} value={product.id}>
                  {product.product_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="lead_stage"
            label="Stage"
            rules={[{ required: true, message: 'Please select stage!' }]}
          >
            <Select>
              {stages.map(stage => (
                <Select.Option key={stage.id} value={stage.id}>
                  {stage.stage_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="lead_source_id"
            label="Lead Source"
            rules={[{ required: true, message: 'Please select lead source!' }]}
          >
            <Select>
              {leadSources.map(source => (
                <Select.Option key={source.id} value={source.id}>
                  {source.lead_source_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="assigned_user"
            label="Lead Assigned"
            rules={[{ required: true, message: 'Please select user!' }]}
          >
            <Select>
              {users.map(user => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="branch_id"
            label="Branch"
            rules={[{ required: true, message: 'Please select branch!' }]}
          >
            <Select>
              {branches.map(branch => (
                <Select.Option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="fu_date"
            label="Followup Date"
            rules={[{ required: true, message: 'Please select followup date!' }]}
          >
            <Input type="date" />
          </Form.Item>

          <Form.Item
            name="initial_remarks"
            label="Note"
          >
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name="lead_active_status"
            label="Status"
            valuePropName="checked"
          >
            <Switch 
              checkedChildren="Active" 
              unCheckedChildren="Inactive"
              style={{ backgroundColor: theme.colors.primary }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" style={{ background: theme.colors.primary }}>
                {editingLead ? 'Update' : 'Submit'}
              </Button>
              <Button onClick={() => {
                setIsModalVisible(false);
                setEditingLead(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Filter Drawer */}
      <Drawer
        title="Filter Leads"
        placement="right"
        onClose={() => setIsFilterDrawerOpen(false)}
        open={isFilterDrawerOpen}
        width={400}
        extra={
          <Space>
            <Button onClick={resetFilters}>Reset</Button>
            <Button 
              type="primary" 
              onClick={() => {
                handleFilterChange();
                setIsFilterDrawerOpen(false);
              }}
              style={{ background: theme.colors.primary }}
            >
              Apply
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Typography.Text strong>Product</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select Product"
              allowClear
              value={filters.lead_product}
              onChange={(value) => setFilters({ ...filters, lead_product: value })}
            >
              {products.map(product => (
                <Select.Option key={product.id} value={product.id}>
                  {product.product_name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Typography.Text strong>Stage</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select Stage"
              allowClear
              value={filters.lead_stage}
              onChange={(value) => setFilters({ ...filters, lead_stage: value })}
            >
              {stages.map(stage => (
                <Select.Option key={stage.id} value={stage.id}>
                  {stage.stage_name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Typography.Text strong>Assigned User</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select User"
              allowClear
              value={filters.assigned_user}
              onChange={(value) => setFilters({ ...filters, assigned_user: value })}
            >
              {users.map(user => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Typography.Text strong>Status</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Select Status"
              allowClear
              value={filters.lead_active_status}
              onChange={(value) => setFilters({ ...filters, lead_active_status: value })}
            >
              <Select.Option value={true}>Active</Select.Option>
              <Select.Option value={false}>Inactive</Select.Option>
            </Select>
          </div>
        </Space>
      </Drawer>
    </Layout>
  );
};

export default Leads; 