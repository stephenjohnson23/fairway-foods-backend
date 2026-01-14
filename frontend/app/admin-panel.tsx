import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.EXPO_BACKEND_URL || '';

const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return window.location.origin;
  }
  return API_URL || 'http://localhost:8001';
};
const { width } = Dimensions.get('window');

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
  courseIds: string[];
  defaultCourseId?: string;
}

interface Course {
  id: string;
  name: string;
  location: string;
  description?: string;
  active: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  courseId?: string;
}

interface Order {
  id: string;
  customerName: string;
  teeOffTime: string;
  items: any[];
  total: number;
  status: string;
  createdAt: string;
}

type ActiveSection = 'dashboard' | 'users' | 'courses' | 'menu' | 'orders';

export default function AdminPanelScreen() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  
  // Modal states
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Form states
  const [userForm, setUserForm] = useState({ email: '', name: '', role: 'user', courseIds: [] as string[] });
  const [courseForm, setCourseForm] = useState({ name: '', location: '', description: '', active: true });
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: '', category: '', available: true });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCourseId) {
      loadMenuItems();
    }
  }, [selectedCourseId]);

  const checkAccess = async () => {
    const token = await AsyncStorage.getItem('token');
    const userData = await AsyncStorage.getItem('user');
    
    if (!token || !userData) {
      Alert.alert('Access Denied', 'Please login first');
      router.replace('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'superuser' && parsedUser.role !== 'admin') {
      Alert.alert('Access Denied', 'Admin access required');
      router.replace('/');
      return;
    }
    
    setUser(parsedUser);
    setLoading(false);
  };

  const loadAllData = async () => {
    const token = await AsyncStorage.getItem('token');
    
    // For web, we need to construct the API URL properly
    const baseUrl = API_URL || window.location.origin;
    
    try {
      // Load users (super user only)
      if (user?.role === 'superuser') {
        const usersRes = await fetch(`${baseUrl}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
      }
      
      // Load courses - try /all first, fall back to public
      let coursesData = [];
      try {
        const coursesRes = await fetch(`${baseUrl}/api/courses/all`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (coursesRes.ok) {
          coursesData = await coursesRes.json();
        }
      } catch (e) {
        // Fallback to public courses
        const publicRes = await fetch(`${baseUrl}/api/courses`);
        if (publicRes.ok) {
          coursesData = await publicRes.json();
        }
      }
      
      setCourses(coursesData);
      if (coursesData.length > 0 && !selectedCourseId) {
        setSelectedCourseId(coursesData[0].id);
      }
      
      // Load orders
      const ordersRes = await fetch(`${baseUrl}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadMenuItems = async () => {
    if (!selectedCourseId) return;
    
    const baseUrl = API_URL || window.location.origin;
    
    try {
      const response = await fetch(`${baseUrl}/api/menu?courseId=${selectedCourseId}`);
      if (response.ok) {
        setMenuItems(await response.json());
      }
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/');
  };

  // User Management Functions
  const handleApproveUser = async (userId: string) => {
    const token = await AsyncStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        Alert.alert('Success', 'User approved');
        loadAllData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to approve user');
    }
  };

  const handleRejectUser = async (userId: string) => {
    const token = await AsyncStorage.getItem('token');
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Rejected by admin' }),
      });
      if (response.ok) {
        Alert.alert('Done', 'User rejected');
        loadAllData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reject user');
    }
  };

  const handleSaveUser = async () => {
    const token = await AsyncStorage.getItem('token');
    try {
      if (editingItem) {
        // Update existing user
        await fetch(`${API_URL}/api/users/${editingItem.id}/role`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: userForm.role }),
        });
        await fetch(`${API_URL}/api/users/${editingItem.id}/courses`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseIds: userForm.courseIds }),
        });
      } else {
        // Create new user
        await fetch(`${API_URL}/api/users/create`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(userForm),
        });
      }
      setUserModalVisible(false);
      loadAllData();
      Alert.alert('Success', 'User saved');
    } catch (error) {
      Alert.alert('Error', 'Failed to save user');
    }
  };

  // Course Management Functions
  const handleSaveCourse = async () => {
    const token = await AsyncStorage.getItem('token');
    try {
      const url = editingItem ? `${API_URL}/api/courses/${editingItem.id}` : `${API_URL}/api/courses`;
      const method = editingItem ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm),
      });
      
      if (response.ok) {
        setCourseModalVisible(false);
        loadAllData();
        Alert.alert('Success', 'Course saved');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save course');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    Alert.alert('Delete Course', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const token = await AsyncStorage.getItem('token');
          await fetch(`${API_URL}/api/courses/${courseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          loadAllData();
        },
      },
    ]);
  };

  // Menu Management Functions
  const handleSaveMenuItem = async () => {
    const token = await AsyncStorage.getItem('token');
    try {
      const url = editingItem ? `${API_URL}/api/menu/${editingItem.id}` : `${API_URL}/api/menu`;
      const method = editingItem ? 'PUT' : 'POST';
      
      const data = {
        ...menuForm,
        price: parseFloat(menuForm.price),
        courseId: selectedCourseId,
      };
      
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.ok) {
        setMenuModalVisible(false);
        loadMenuItems();
        Alert.alert('Success', 'Menu item saved');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save menu item');
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const token = await AsyncStorage.getItem('token');
          await fetch(`${API_URL}/api/menu/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
          loadMenuItems();
        },
      },
    ]);
  };

  // Order Management
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const token = await AsyncStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadAllData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update order');
    }
  };

  // Stats
  const pendingUsers = users.filter(u => u.status === 'pending').length;
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const todayRevenue = orders
    .filter(o => {
      if (!o.createdAt) return false;
      return new Date(o.createdAt).toDateString() === new Date().toDateString();
    })
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>⛳ Fairway Foods</Text>
        <Text style={styles.sidebarSubtitle}>Admin Panel</Text>
      </View>
      
      <View style={styles.sidebarMenu}>
        {[
          { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
          { id: 'users', icon: 'people', label: 'Users', badge: pendingUsers },
          { id: 'courses', icon: 'golf', label: 'Courses' },
          { id: 'menu', icon: 'restaurant', label: 'Menu' },
          { id: 'orders', icon: 'receipt', label: 'Orders', badge: pendingOrders },
        ].map((item) => (
          (item.id !== 'users' || user?.role === 'superuser') && (
            <TouchableOpacity
              key={item.id}
              style={[styles.sidebarItem, activeSection === item.id && styles.sidebarItemActive]}
              onPress={() => setActiveSection(item.id as ActiveSection)}
            >
              <Ionicons 
                name={item.icon as any} 
                size={22} 
                color={activeSection === item.id ? '#fff' : '#666'} 
              />
              <Text style={[styles.sidebarItemText, activeSection === item.id && styles.sidebarItemTextActive]}>
                {item.label}
              </Text>
              {item.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )
        ))}
      </View>
      
      <View style={styles.sidebarFooter}>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ff5252" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDashboard = () => (
    <View style={styles.dashboardContent}>
      <Text style={styles.sectionTitle}>Dashboard Overview</Text>
      
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
          <Ionicons name="people" size={32} color="#1976d2" />
          <Text style={styles.statNumber}>{users.length}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
          <Ionicons name="time" size={32} color="#f57c00" />
          <Text style={styles.statNumber}>{pendingUsers}</Text>
          <Text style={styles.statLabel}>Pending Approvals</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
          <Ionicons name="golf" size={32} color="#388e3c" />
          <Text style={styles.statNumber}>{courses.length}</Text>
          <Text style={styles.statLabel}>Golf Courses</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fce4ec' }]}>
          <Ionicons name="receipt" size={32} color="#c2185b" />
          <Text style={styles.statNumber}>{totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f3e5f5' }]}>
          <Ionicons name="hourglass" size={32} color="#7b1fa2" />
          <Text style={styles.statNumber}>{pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending Orders</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e0f2f1' }]}>
          <Ionicons name="cash" size={32} color="#00796b" />
          <Text style={styles.statNumber}>R{todayRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Today&apos;s Revenue</Text>
        </View>
      </View>
      
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Orders</Text>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tee-Off</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Total</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
        </View>
        {orders.slice(0, 5).map((order) => (
          <View key={order.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{order.customerName}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{order.teeOffTime}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>R{(order.total || 0).toFixed(2)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: order.status === 'pending' ? '#fff3e0' : order.status === 'preparing' ? '#e3f2fd' : '#e8f5e9' }]}>
              <Text style={[styles.statusText, { color: order.status === 'pending' ? '#f57c00' : order.status === 'preparing' ? '#1976d2' : '#388e3c' }]}>
                {order.status.toUpperCase()}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderUsers = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>User Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingItem(null);
            setUserForm({ email: '', name: '', role: 'user', courseIds: [] });
            setUserModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>
      </View>
      
      {pendingUsers > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingTitle}>⏳ Pending Approvals ({pendingUsers})</Text>
          {users.filter(u => u.status === 'pending').map((u) => (
            <View key={u.id} style={styles.pendingCard}>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{u.name}</Text>
                <Text style={styles.pendingEmail}>{u.email}</Text>
              </View>
              <View style={styles.pendingActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApproveUser(u.id)}
                >
                  <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleRejectUser(u.id)}
                >
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Email</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Role</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Courses</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Actions</Text>
        </View>
        {users.filter(u => u.status !== 'pending').map((u) => (
          <View key={u.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{u.name}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{u.email}</Text>
            <View style={[styles.roleBadge, { flex: 1 }]}>
              <Text style={styles.roleText}>{u.role.toUpperCase()}</Text>
            </View>
            <Text style={[styles.tableCell, { flex: 1 }]}>{u.courseIds?.length || 0}</Text>
            <TouchableOpacity 
              style={[styles.tableCell, { flex: 1 }]}
              onPress={() => {
                setEditingItem(u);
                setUserForm({ email: u.email, name: u.name, role: u.role, courseIds: u.courseIds || [] });
                setUserModalVisible(true);
              }}
            >
              <Ionicons name="create" size={20} color="#1976d2" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );

  const renderCourses = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Golf Courses</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingItem(null);
            setCourseForm({ name: '', location: '', description: '', active: true });
            setCourseModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Course</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.coursesGrid}>
        {courses.map((course) => (
          <View key={course.id} style={[styles.courseCard, !course.active && styles.courseCardInactive]}>
            <View style={styles.courseCardHeader}>
              <Ionicons name="golf" size={24} color={course.active ? '#2e7d32' : '#999'} />
              {!course.active && <Text style={styles.inactiveLabel}>INACTIVE</Text>}
            </View>
            <Text style={styles.courseName}>{course.name}</Text>
            <Text style={styles.courseLocation}>{course.location}</Text>
            {course.description && (
              <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
            )}
            <View style={styles.courseActions}>
              <TouchableOpacity 
                style={styles.courseEditBtn}
                onPress={() => {
                  setEditingItem(course);
                  setCourseForm({ 
                    name: course.name, 
                    location: course.location, 
                    description: course.description || '', 
                    active: course.active 
                  });
                  setCourseModalVisible(true);
                }}
              >
                <Ionicons name="create" size={18} color="#1976d2" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.courseDeleteBtn}
                onPress={() => handleDeleteCourse(course.id)}
              >
                <Ionicons name="trash" size={18} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderMenu = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <View style={styles.menuHeaderLeft}>
          <Text style={styles.sectionTitle}>Menu Items</Text>
          <View style={styles.courseSelector}>
            {courses.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.coursePill, selectedCourseId === c.id && styles.coursePillActive]}
                onPress={() => setSelectedCourseId(c.id)}
              >
                <Text style={[styles.coursePillText, selectedCourseId === c.id && styles.coursePillTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            setEditingItem(null);
            setMenuForm({ name: '', description: '', price: '', category: '', available: true });
            setMenuModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Item</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Description</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Price</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Category</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Actions</Text>
        </View>
        {menuItems.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{item.name}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>R{item.price.toFixed(2)}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{item.category}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.availabilityBadge, { backgroundColor: item.available ? '#e8f5e9' : '#ffebee', color: item.available ? '#388e3c' : '#c62828' }]}>
                {item.available ? 'Available' : 'Unavailable'}
              </Text>
            </View>
            <View style={[styles.tableCell, { flex: 1, flexDirection: 'row', gap: 8 }]}>
              <TouchableOpacity onPress={() => {
                setEditingItem(item);
                setMenuForm({ 
                  name: item.name, 
                  description: item.description, 
                  price: item.price.toString(), 
                  category: item.category, 
                  available: item.available 
                });
                setMenuModalVisible(true);
              }}>
                <Ionicons name="create" size={20} color="#1976d2" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteMenuItem(item.id)}>
                <Ionicons name="trash" size={20} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderOrders = () => (
    <View style={styles.contentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Orders</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadAllData}>
          <Ionicons name="refresh" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Customer</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tee-Off</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Items</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Total</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Actions</Text>
        </View>
        {orders.map((order) => (
          <View key={order.id} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{order.customerName}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{order.teeOffTime}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
              {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
            </Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>R{(order.total || 0).toFixed(2)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderStatus, { 
                backgroundColor: order.status === 'pending' ? '#fff3e0' : order.status === 'preparing' ? '#e3f2fd' : '#e8f5e9',
                color: order.status === 'pending' ? '#f57c00' : order.status === 'preparing' ? '#1976d2' : '#388e3c'
              }]}>
                {order.status.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.tableCell, { flex: 2, flexDirection: 'row', gap: 4 }]}>
              {order.status === 'pending' && (
                <TouchableOpacity 
                  style={[styles.statusBtn, { backgroundColor: '#1976d2' }]}
                  onPress={() => handleUpdateOrderStatus(order.id, 'preparing')}
                >
                  <Text style={styles.statusBtnText}>Prepare</Text>
                </TouchableOpacity>
              )}
              {order.status === 'preparing' && (
                <TouchableOpacity 
                  style={[styles.statusBtn, { backgroundColor: '#388e3c' }]}
                  onPress={() => handleUpdateOrderStatus(order.id, 'ready')}
                >
                  <Text style={styles.statusBtnText}>Ready</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderSidebar()}
      
      <ScrollView style={styles.mainContent}>
        {activeSection === 'dashboard' && renderDashboard()}
        {activeSection === 'users' && renderUsers()}
        {activeSection === 'courses' && renderCourses()}
        {activeSection === 'menu' && renderMenu()}
        {activeSection === 'orders' && renderOrders()}
      </ScrollView>

      {/* User Modal */}
      <Modal visible={userModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit User' : 'Add User'}</Text>
            
            {!editingItem && (
              <>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={userForm.email}
                  onChangeText={(t) => setUserForm({...userForm, email: t})}
                  placeholder="email@example.com"
                />
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={userForm.name}
                  onChangeText={(t) => setUserForm({...userForm, name: t})}
                  placeholder="Full Name"
                />
              </>
            )}
            
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              {['user', 'admin', 'kitchen', 'cashier'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolePill, userForm.role === r && styles.rolePillActive]}
                  onPress={() => setUserForm({...userForm, role: r})}
                >
                  <Text style={[styles.rolePillText, userForm.role === r && styles.rolePillTextActive]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Assigned Courses</Text>
            <View style={styles.coursesCheckboxes}>
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.checkboxRow}
                  onPress={() => {
                    const ids = userForm.courseIds.includes(c.id)
                      ? userForm.courseIds.filter(id => id !== c.id)
                      : [...userForm.courseIds, c.id];
                    setUserForm({...userForm, courseIds: ids});
                  }}
                >
                  <View style={[styles.checkbox, userForm.courseIds.includes(c.id) && styles.checkboxChecked]}>
                    {userForm.courseIds.includes(c.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setUserModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUser}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Course Modal */}
      <Modal visible={courseModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Course' : 'Add Course'}</Text>
            
            <Text style={styles.inputLabel}>Course Name</Text>
            <TextInput
              style={styles.modalInput}
              value={courseForm.name}
              onChangeText={(t) => setCourseForm({...courseForm, name: t})}
              placeholder="Royal Golf Club"
            />
            
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.modalInput}
              value={courseForm.location}
              onChangeText={(t) => setCourseForm({...courseForm, location: t})}
              placeholder="Cape Town"
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              value={courseForm.description}
              onChangeText={(t) => setCourseForm({...courseForm, description: t})}
              placeholder="Optional description"
              multiline
            />
            
            <TouchableOpacity 
              style={styles.toggleRow}
              onPress={() => setCourseForm({...courseForm, active: !courseForm.active})}
            >
              <Text style={styles.inputLabel}>Active</Text>
              <View style={[styles.toggle, courseForm.active && styles.toggleActive]}>
                <View style={[styles.toggleKnob, courseForm.active && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCourseModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCourse}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal visible={menuModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</Text>
            
            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.modalInput}
              value={menuForm.name}
              onChangeText={(t) => setMenuForm({...menuForm, name: t})}
              placeholder="Club Sandwich"
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              value={menuForm.description}
              onChangeText={(t) => setMenuForm({...menuForm, description: t})}
              placeholder="Delicious sandwich with..."
            />
            
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Price (R)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={menuForm.price}
                  onChangeText={(t) => setMenuForm({...menuForm, price: t})}
                  placeholder="95.00"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.modalInput}
                  value={menuForm.category}
                  onChangeText={(t) => setMenuForm({...menuForm, category: t})}
                  placeholder="Mains"
                />
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.toggleRow}
              onPress={() => setMenuForm({...menuForm, available: !menuForm.available})}
            >
              <Text style={styles.inputLabel}>Available</Text>
              <View style={[styles.toggle, menuForm.available && styles.toggleActive]}>
                <View style={[styles.toggleKnob, menuForm.available && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMenuModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMenuItem}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingTop: 20,
  },
  sidebarHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sidebarMenu: {
    flex: 1,
    paddingTop: 16,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  sidebarItemActive: {
    backgroundColor: '#2e7d32',
  },
  sidebarItemText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  sidebarItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sidebarFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#ff5252',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    padding: 24,
  },
  dashboardContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    width: 180,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contentSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pendingSection: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 12,
  },
  pendingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  pendingEmail: {
    fontSize: 13,
    color: '#666',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  approveBtn: {
    backgroundColor: '#4caf50',
  },
  rejectBtn: {
    backgroundColor: '#f44336',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  roleBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976d2',
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  courseCard: {
    width: 280,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  courseCardInactive: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  courseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inactiveLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  courseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  courseLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  courseDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  courseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  courseEditBtn: {
    padding: 8,
  },
  courseDeleteBtn: {
    padding: 8,
  },
  menuHeaderLeft: {
    flex: 1,
  },
  courseSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  coursePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  coursePillActive: {
    backgroundColor: '#2e7d32',
  },
  coursePillText: {
    fontSize: 13,
    color: '#666',
  },
  coursePillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  availabilityBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  refreshBtn: {
    padding: 8,
  },
  orderStatus: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 450,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  rolePillActive: {
    backgroundColor: '#2e7d32',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  rolePillTextActive: {
    color: '#fff',
  },
  coursesCheckboxes: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4caf50',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    marginLeft: 22,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2e7d32',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
