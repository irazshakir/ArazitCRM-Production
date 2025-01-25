import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  UserOutlined,
  MessageOutlined,
  BarChartOutlined,
  FileTextOutlined,
  BankOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PieChartOutlined,
  HistoryOutlined,
  DollarOutlined,
  TeamOutlined,
  BranchesOutlined,
  HomeOutlined as HotelOutlined,
  GiftOutlined
} from '@ant-design/icons';
import Logo from './Logo';
import { useState, useEffect } from 'react';
import theme from '../../theme';
import UserProfile from './UserProfile';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import PropTypes from 'prop-types';

const { Sider } = Layout;

const Sidebar = () => {
  const [userRole, setUserRole] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const currentUser = await authService.getCurrentUser();
        if (currentUser && currentUser.userData.roles.role_name) {
          setUserRole(currentUser.userData.roles.role_name);
        } else {
          navigate('/login');
        }
      } catch (error) {
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  if (!userRole) {
    return null;
  }

  const handleToggle = () => {
    if (typeof onCollapse === 'function') {
      onCollapse(!collapsed);
    }
  };

  // Helper function to create menu items with NavLink
  const createMenuItem = (item) => {
    if (item.children) {
      return {
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: item.children.map(child => createMenuItem(child))
      };
    }

    return {
      key: item.key,
      icon: item.icon,
      label: (
        <NavLink 
          to={item.path}
          style={({ isActive }) => ({
            color: isActive ? theme.colors.primary : 'inherit',
            textDecoration: 'none'
          })}
        >
          {item.label}
        </NavLink>
      )
    };
  };

  const adminMenuItems = [
    { 
      key: '/admin/dashboard',
      icon: <HomeOutlined />, 
      label: 'Dashboard',
      path: '/admin/dashboard'
    },
    { 
      key: '/admin/leads',
      icon: <UserOutlined />, 
      label: 'Leads',
      path: '/admin/leads'
    },
    { 
      key: '/admin/conversations',
      icon: <MessageOutlined />, 
      label: 'Conversations',
      path: '/admin/conversations'
    },
    { 
      key: 'analytics', 
      icon: <BarChartOutlined />, 
      label: 'Analytics',
      children: [
        { 
          key: '/admin/reports',
          icon: <PieChartOutlined />,
          label: 'Reports',
          path: '/admin/reports'
        },
        { 
          key: '/admin/analytics/logs', 
          icon: <HistoryOutlined />,
          label: 'Logs',
          path: '/admin/analytics/logs' 
        }
      ]
    },
    { 
      key: '/admin/invoices',
      icon: <FileTextOutlined />, 
      label: 'Invoices',
      path: '/admin/invoices'
    },
    { 
      key: '/admin/accounts',
      icon: <BankOutlined />, 
      label: 'Accounts',
      path: '/admin/accounts'
    },
    { 
      key: 'settings', 
      icon: <SettingOutlined />, 
      label: 'Settings',
      children: [
        { 
          key: '/admin/settings/general', 
          icon: <SettingOutlined />,
          label: 'General',
          path: '/admin/settings/general' 
        },
        { 
          key: '/admin/settings/accounts', 
          icon: <DollarOutlined />,
          label: 'Accounts',
          path: '/admin/settings/accounts' 
        },
        { 
          key: '/admin/settings/canned-messages', 
          icon: <BranchesOutlined />,
          label: 'Canned Messages',
          path: '/admin/settings/canned-messages' 
        },
        { 
          key: '/admin/settings/template-messages', 
          icon: <HotelOutlined />,
          label: 'Template Messages',
          path: '/admin/settings/template-messages' 
        }
      ]
    },
  ];

  const userMenuItems = [
    { 
      key: '/user/dashboard',
      icon: <HomeOutlined />, 
      label: 'Dashboard',
      path: '/user/dashboard'
    },
    { 
      key: '/user/leads',
      icon: <UserOutlined />, 
      label: 'Leads',
      path: '/user/leads'
    },
    { 
      key: '/user/conversations',
      icon: <MessageOutlined />, 
      label: 'Conversations',
      path: '/user/conversations'
    },
    { 
      key: 'analytics', 
      icon: <BarChartOutlined />, 
      label: 'Analytics',
      children: [
        { 
          key: '/user/reports',
          icon: <PieChartOutlined />,
          label: 'Reports',
          path: '/user/reports'
        }
      ]
    }
  ];

  const getMenuItems = () => {
    const items = {
      admin: adminMenuItems,
      manager: [], // Add manager menu items when needed
      user: userMenuItems
    }[userRole] || [];

    return items.map(item => createMenuItem(item));
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      localStorage.removeItem('token');
      localStorage.removeItem('user_jwt');
      navigate('/login');
    } catch (error) {
      navigate('/login');
    }
  };

   // Add this new function to determine which keys should be open
   const getDefaultOpenKeys = () => {
    const pathname = location.pathname;
    const openKeys = [];
    
    if (pathname.includes('/analytics')) {
      openKeys.push('analytics');
    }
    if (pathname.includes('/settings')) {
      openKeys.push('settings');
    }
    
    return openKeys;
  };

  return (
    <Sider
      width={80}
      collapsedWidth={80}
      collapsed={true}
      theme="light"
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#fff',
        zIndex: 1000,
        borderRight: '1px solid #f0f0f0'
      }}
    >
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        height: '56px'
      }}>
        <Logo collapsed={true} />
      </div>

      <div style={{ 
        height: 'calc(100vh - 112px)',
        overflowY: 'auto'
      }}>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={getDefaultOpenKeys()}
          style={{ border: 'none' }}
          items={getMenuItems()}
        />
      </div>

      <div style={{ 
        height: '56px',
        borderTop: '1px solid #f0f0f0'
      }}>
        <UserProfile 
          collapsed={true}
          onLogout={handleLogout}
        />
      </div>
    </Sider>
  );
};

Sidebar.propTypes = {
  collapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

Sidebar.defaultProps = {
  collapsed: true,
  onCollapse: () => {}
};

export default Sidebar; 