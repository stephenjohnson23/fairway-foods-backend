import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (origin.includes('preview.emergentagent.com') || origin.includes('.ngrok')) {
      return origin;
    }
    if (API_URL && API_URL.includes('preview.emergentagent.com')) {
      return API_URL;
    }
    return origin;
  }
  return API_URL || '';
};

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface DashboardStats {
  totalUsers: number;
  pendingUsers: number;
  totalCourses: number;
  totalOrders: number;
  pendingOrders: number;
}

type ActiveTab = 'dashboard' | 'menu' | 'users' | 'orders';

export default function AdminScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    pendingUsers: 0,
    totalCourses: 0,
    totalOrders: 0,
    pendingOrders: 0,
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const userData = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');
    
    if (!userData || !token) {
      Alert.alert('Error', 'Please login to access admin panel');
      router.replace('/');
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'admin' && parsedUser.role !== 'superuser') {
      Alert.alert('Error', 'Admin access required');
      router.replace('/');
      return;
    }
    
    setUser(parsedUser);
    await loadDashboardData();
    setLoading(false);
  };

  const loadDashboardData = async () => {
    const token = await AsyncStorage.getItem('token');
    const baseUrl = getBaseUrl();
    
    try {
      // Load stats
      const [usersRes, coursesRes, ordersRes] = await Promise.all([
        fetch(`${baseUrl}/api/users`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
        fetch(`${baseUrl}/api/courses`).catch(() => null),
        fetch(`${baseUrl}/api/orders`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
      ]);

      let totalUsers = 0, pendingUsers = 0, totalCourses = 0, totalOrders = 0, pendingOrders = 0;

      if (usersRes?.ok) {
        const users = await usersRes.json();
        totalUsers = users.length;
        pendingUsers = users.filter((u: any) => u.status === 'pending').length;
      }

      if (coursesRes?.ok) {
        const courses = await coursesRes.json();
        totalCourses = courses.length;
      }

      if (ordersRes?.ok) {
        const orders = await ordersRes.json();
        totalOrders = orders.length;
        pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
      }

      setStats({ totalUsers, pendingUsers, totalCourses, totalOrders, pendingOrders });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('selectedCourseId');
      setShowLogoutModal(false);
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      router.replace('/');
    }
  };

  const isSuperuser = user?.role === 'superuser';

  const menuItems = [
    {
      id: 'menu',
      title: 'Menu Management',
      subtitle: 'Add, edit, and manage menu items',
      icon: 'restaurant',
      color: '#4CAF50',
      route: '/menu-management',
      enabled: true,
    },
    {
      id: 'users',
      title: 'User Management',
      subtitle: `${stats.pendingUsers} pending approvals`,
      icon: 'people',
      color: '#2196F3',
      route: '/user-management',
      enabled: isSuperuser,
      badge: stats.pendingUsers > 0 ? stats.pendingUsers : undefined,
    },
    {
      id: 'courses',
      title: 'Golf Courses',
      subtitle: `${stats.totalCourses} courses`,
      icon: 'golf',
      color: '#FF9800',
      route: '/course-management',
      enabled: isSuperuser,
    },
    {
      id: 'orders',
      title: 'Orders',
      subtitle: `${stats.pendingOrders} pending orders`,
      icon: 'receipt',
      color: '#9C27B0',
      route: '/orders',
      enabled: true,
      badge: stats.pendingOrders > 0 ? stats.pendingOrders : undefined,
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>
            {isSuperuser ? 'Super User' : 'Admin'} • {user?.email}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#f44336" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e7d32']} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#e3f2fd' }]}>
            <Ionicons name="receipt" size={28} color="#1976d2" />
            <Text style={styles.statNumber}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
            <Ionicons name="time" size={28} color="#f57c00" />
            <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          {isSuperuser && (
            <>
              <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="people" size={28} color="#388e3c" />
                <Text style={styles.statNumber}>{stats.totalUsers}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#fce4ec' }]}>
                <Ionicons name="golf" size={28} color="#c2185b" />
                <Text style={styles.statNumber}>{stats.totalCourses}</Text>
                <Text style={styles.statLabel}>Courses</Text>
              </View>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.menuGrid}>
          {menuItems
            .filter(item => item.enabled)
            .map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuCard}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={32} color={item.color} />
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Desktop Switch Button - Always show for navigation */}
        <TouchableOpacity
          style={styles.desktopSwitchButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.location.href = '/admin-panel';
            } else {
              router.push('/admin-panel');
            }
          }}
        >
          <Ionicons name="desktop-outline" size={20} color="#2e7d32" />
          <Text style={styles.desktopSwitchText}>Switch to Desktop View</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <View style={styles.logoutModalIconContainer}>
              <Ionicons name="log-out-outline" size={48} color="#f44336" />
            </View>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity 
                style={styles.logoutModalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.logoutModalConfirmButton}
                onPress={confirmLogout}
              >
                <Ionicons name="log-out" size={18} color="#fff" />
                <Text style={styles.logoutModalConfirmText}>Logout</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#2e7d32',
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
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
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '48%',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  desktopSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
    gap: 8,
  },
  desktopSwitchText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  logoutModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  logoutModalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  logoutModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  logoutModalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logoutModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
