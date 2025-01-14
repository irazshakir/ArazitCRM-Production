import React, { useState, useEffect } from 'react';
import { Typography, Button, Avatar, Input, DatePicker, TimePicker, Select, Switch, message } from 'antd';
import { WhatsAppOutlined, PlusCircleOutlined } from '@ant-design/icons';
import styles from './ChatInfo.module.css';
import axios from 'axios';
import dayjs from 'dayjs';
import theme from '../../theme';
import CustomUmrahPackage from '../CustomUmrah/CustomUmrahPackage';

const { Title, Text } = Typography;
const { Option } = Select;

const ChatInfo = ({ 
  contact = {}, 
}) => {
  const [products, setProducts] = useState([]);
  const [stages, setStages] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isActive, setIsActive] = useState(contact.lead_active_status);
  const [formData, setFormData] = useState({
    phone: contact.phone,
    email: contact.email,
    productId: contact.lead_product,
    stageId: contact.lead_stage,
    leadSourceId: contact.lead_source_id,
    branchId: contact.branch_id,
    followDate: contact.fu_date,
    followHour: contact.fu_hour,
    followMinutes: contact.fu_minutes,
    followPeriod: contact.fu_period
  });
  const [isPackageModalVisible, setIsPackageModalVisible] = useState(false);

  useEffect(() => {
    const fetchContactDetails = async () => {
      try {
        const response = await axios.get(`/api/leads/${contact.id}`);
        const leadDetails = response.data;
        
        console.log('Fetched lead details:', leadDetails);

        setFormData(prev => ({
          ...prev,
          phone: contact.phone || '',
          email: contact.email || '',
          productId: contact.lead_product || null,
          stageId: contact.lead_stage || null,
          leadSourceId: contact.lead_source_id || null,
          branchId: leadDetails.branch_id || null,
          followDate: contact.fu_date || null,
          followHour: contact.fu_hour || null,
          followMinutes: contact.fu_minutes || null,
          followPeriod: contact.fu_period || null
        }));
      } catch (error) {
        console.error('Error fetching lead details:', error);
      }
    };

    if (contact.id) {
      fetchContactDetails();
    }
  }, [contact.id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, stagesRes, sourcesRes, branchesRes] = await Promise.all([
          axios.get('/api/products'),
          axios.get('/api/stages'),
          axios.get('/api/lead-sources'),
          axios.get('/api/branches')
        ]);
        
        setProducts(productsRes.data);
        setStages(stagesRes.data);
        setLeadSources(sourcesRes.data);
        setBranches(branchesRes.data);

        console.log('Fetched branches:', branchesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleUpdate = async () => {
    try {
      const updateData = {
        phone: formData.phone,
        email: formData.email,
        lead_product: formData.productId,
        lead_stage: formData.stageId,
        lead_source_id: formData.leadSourceId,
        branch_id: formData.branchId ? Number(formData.branchId) : null,
        fu_date: formData.followDate,
        fu_hour: formData.followHour,
        fu_minutes: formData.followMinutes,
        fu_period: formData.followPeriod,
        lead_active_status: isActive
      };

      console.log('Updating lead with data:', updateData);
      
      const response = await axios.patch(`/api/leads/${contact.id}`, updateData);
      
      if (response.data.success) {
        message.success('Lead updated successfully');
      } else {
        message.warning('Update may not be complete');
      }
    } catch (error) {
      console.error('Failed to update lead:', error);
      message.error('Failed to update lead');
    }
  };

  const handleInputChange = (field, value) => {
    console.log(`Updating ${field} with value:`, value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTimeChange = (time) => {
    if (time) {
      const hour = time.format('hh');
      const minutes = time.format('mm');
      const period = time.format('A');

      setFormData(prev => ({
        ...prev,
        followHour: hour,
        followMinutes: minutes,
        followPeriod: period
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        followHour: null,
        followMinutes: null,
        followPeriod: null
      }));
    }
  };

  const getTimeValue = () => {
    if (formData.followHour && formData.followMinutes !== undefined) {
      // Convert numeric hour to string with leading zero if needed
      const hour = String(formData.followHour).padStart(2, '0');
      // Convert numeric minutes to string with leading zero if needed
      const minutes = String(formData.followMinutes).padStart(2, '0');
      const period = formData.followPeriod || 'AM';

      return dayjs(`${hour}:${minutes} ${period}`, 'hh:mm A');
    }
    return null;
  };

  const renderServiceButton = () => {
    switch (formData.productId) {
      case 1: // Umrah Custom Packages
        return (
          <>
            <Button 
              icon={<PlusCircleOutlined />}
              type="text"
              className={styles.serviceButton}
              onClick={() => setIsPackageModalVisible(true)}
            >
              Add Custom Package
            </Button>
            <CustomUmrahPackage
              visible={isPackageModalVisible}
              onCancel={() => {
                setIsPackageModalVisible(false);
                fetchCustomPackages();
              }}
              leadId={contact.id}
            />
          </>
        );
      case 2: // Assuming ID 2 is for "Umrah Readymade Package"
        return (
          <Button 
            icon={<PlusCircleOutlined />}
            type="text"
            className={styles.serviceButton}
          >
            Add Readymade Package
          </Button>
        );
      case 3: // Assuming ID 3 is for "Flights"
        return (
          <Button 
            icon={<PlusCircleOutlined />}
            type="text"
            className={styles.serviceButton}
          >
            Add Flight Details
          </Button>
        );
      case 4: // Assuming ID 4 is for "Visas"
        return (
          <Button 
            icon={<PlusCircleOutlined />}
            type="text"
            className={styles.serviceButton}
          >
            Add Visa Details
          </Button>
        );
      default:
        return null;
    }
  };

  const fetchCustomPackages = async () => {
    try {
      const response = await axios.get(`/api/custom-umrah/leads/${contact.id}`);
      // Handle the response data
    } catch (error) {
      message.error('Failed to fetch custom packages');
    }
  };

  return (
    <div className={styles.chatInfoContainer}>
      {/* Contact Header */}
      <div className={styles.contactHeader}>
        <Avatar size={40}>{contact.name?.[0] || 'D'}</Avatar>
        <div className={styles.contactName}>
          <Text strong>{contact.name || 'dilkumars918'}</Text>
          {contact.whatsapp && <WhatsAppOutlined className={styles.whatsappIcon} />}
        </div>
      </div>

      {/* Phone Number */}
      <div className={styles.infoSection}>
        <Text type="secondary">Phone Number</Text>
        <Input 
          value={formData.phone}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          placeholder="Enter phone number"
          className={styles.input}
        />
      </div>

      {/* Email */}
      <div className={styles.infoSection}>
        <Text type="secondary">Email</Text>
        <Input 
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          placeholder="Enter email"
          className={styles.input}
        />
      </div>

      {/* Follow Date/Time */}
      <div className={styles.infoSection}>
        <Text type="secondary">Follow Date/Time</Text>
        <div className={styles.dateTimeContainer}>
          <DatePicker 
            className={styles.datePicker}
            format="DD/MM/YYYY"
            value={formData.followDate ? dayjs(formData.followDate) : null}
            onChange={(date) => handleInputChange('followDate', date)}
          />
          <TimePicker 
            className={styles.timePicker}
            format="hh:mm A"
            use12Hours
            value={getTimeValue()}
            onChange={handleTimeChange}
          />
        </div>
      </div>

      {/* Lead Info */}
      <div className={styles.sectionHeader}>
        <Title level={5}>Lead Info</Title>
      </div>

      {/* Product Dropdown */}
      <div className={styles.infoSection}>
        <Text type="secondary">Product</Text>
        <Select
          placeholder="Select Product"
          className={styles.select}
          value={formData.productId}
          onChange={(value) => handleInputChange('productId', value)}
        >
          {products.map(product => (
            <Option key={product.id} value={product.id}>
              {product.product_name || product.name}
            </Option>
          ))}
        </Select>
      </div>

      {/* Stage Dropdown */}
      <div className={styles.infoSection}>
        <Text type="secondary">Stage</Text>
        <Select
          placeholder="Select Stage"
          className={styles.select}
          value={formData.stageId}
          onChange={(value) => handleInputChange('stageId', value)}
        >
          {stages.map(stage => (
            <Option key={stage.id} value={stage.id}>
              {stage.stage_name || stage.name}
            </Option>
          ))}
        </Select>
      </div>

      {/* Lead Source Dropdown */}
      <div className={styles.infoSection}>
        <Text type="secondary">Lead Source</Text>
        <Select
          placeholder="Select Lead Source"
          className={styles.select}
          value={formData.leadSourceId}
          onChange={(value) => handleInputChange('leadSourceId', value)}
        >
          {leadSources.map(source => (
            <Option key={source.id} value={source.id}>
              {source.lead_source_name || source.name}
            </Option>
          ))}
        </Select>
      </div>

      {/* Branch Dropdown */}
      <div className={styles.infoSection}>
        <Text type="secondary">Branch</Text>
        <Select
          placeholder="Select Branch"
          className={styles.select}
          value={formData.branchId}
          onChange={(value) => {
            console.log('Selected branch value:', value);
            handleInputChange('branchId', value);
          }}
          allowClear
        >
          {branches.map(branch => (
            <Option 
              key={branch.id} 
              value={branch.id}
            >
              {branch.branch_name}
            </Option>
          ))}
        </Select>
      </div>

      {/* Status Toggle */}
      <div className={styles.infoSection}>
        <Text type="secondary">Status</Text>
        <div className={styles.statusToggle}>
          <Switch
            checked={isActive}
            onChange={setIsActive}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
            style={{ backgroundColor: isActive ? theme.colors.primary : undefined }}
          />
        </div>
      </div>

      {/* Update Button */}
      <>
        <Button 
          type="primary" 
          size="small"
          onClick={handleUpdate}
          className={styles.updateButton}
          style={{ backgroundColor: theme.colors.primary }}
        >
          Update Lead
        </Button>

        {/* Service Details Section */}
        <div className={styles.sectionHeader} style={{ marginTop: '24px' }}>
          <Title level={5}>Service Details</Title>
        </div>
        {renderServiceButton()}
      </>
    </div>
  );
};

export default ChatInfo; 