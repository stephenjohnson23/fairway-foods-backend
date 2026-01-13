import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

interface Order {
  id: string;
  customerName: string;
  teeOffTime: string;
  status: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user !== null) {
      fetchOrders();
    }
  }, [user]);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setUser(false); // Guest user
    }
  };

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // If user is a regular user, fetch only their orders
      // If admin/kitchen/cashier, fetch all orders
      // If guest, show empty state
      let endpoint = '/api/orders';
      let headers: any = {};
      
      if (user && user.role === 'user') {
        // Regular user - fetch only their orders
        endpoint = '/api/orders/my-orders';
        headers = {
          'Authorization': `Bearer ${token}`,
        };
      } else if (!user) {
        // Guest user - no orders to show
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      // admin/kitchen/cashier get all orders (no special endpoint needed)

      const response = await fetch(`${API_URL}${endpoint}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchOrders();
      } else {
        Alert.alert('Error', 'Failed to update order status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            router.replace('/');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'preparing':
        return '#2196f3';
      case 'ready':
        return '#4caf50';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'preparing':
        return 'restaurant';
      case 'ready':
        return 'checkmark-circle';
      default:
        return 'ellipse';
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.teeOffTime}>Tee-Off: {item.teeOffTime}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status)} size={16} color="#fff" />
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.itemsList}>
        {item.items.map((orderItem, index) => (
          <View key={index} style={styles.orderItem}>
            <Text style={styles.orderItemText}>
              {orderItem.quantity}x {orderItem.name}
            </Text>
            <Text style={styles.orderItemPrice}>
              ${(orderItem.price * orderItem.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalText}>Total: ${item.totalAmount.toFixed(2)}</Text>
        <View style={styles.actionButtons}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.preparingButton]}
              onPress={() => updateOrderStatus(item.id, 'preparing')}
            >
              <Text style={styles.actionButtonText}>Start</Text>
            </TouchableOpacity>
          )}
          {item.status === 'preparing' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.readyButton]}
              onPress={() => updateOrderStatus(item.id, 'ready')}
            >
              <Text style={styles.actionButtonText}>Ready</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {user && user.role === 'user' ? 'My Orders' : 'Kitchen Orders'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#2e7d32" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#d32f2f" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {user === false 
                ? 'Please login to view your order history' 
                : user && user.role === 'user'
                ? 'You have no orders yet'
                : 'No orders yet'}
            </Text>
            {user === false && (
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.loginButtonText}>Go to Login</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  teeOffTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderItemText: {
    fontSize: 14,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  preparingButton: {
    backgroundColor: '#2196f3',
  },
  readyButton: {
    backgroundColor: '#4caf50',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});