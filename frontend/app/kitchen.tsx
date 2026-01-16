import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

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

export default function KitchenDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const previousOrderCount = useRef(0);
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkKitchenAccess();
    fetchOrders();
    
    // Auto-refresh every 10 seconds
    autoRefreshInterval.current = setInterval(() => {
      fetchOrders(true);
    }, 10000);

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, []);

  const checkKitchenAccess = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      Alert.alert('Error', 'Please login to access kitchen dashboard');
      router.replace('/');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'kitchen' && user.role !== 'admin') {
      Alert.alert('Error', 'Kitchen access required');
      router.back();
    }
  };

  const fetchOrders = async (isAutoRefresh = false) => {
    try {
      const response = await fetch(`${API_URL}/api/orders`);
      if (response.ok) {
        const data = await response.json();
        const pendingOrders = data.filter((order: Order) => 
          order.status === 'pending' || order.status === 'preparing'
        );
        
        // Check for new orders
        if (isAutoRefresh && pendingOrders.length > previousOrderCount.current) {
          const newOrders = pendingOrders.length - previousOrderCount.current;
          setNewOrderCount(newOrders);
          
          // Show notification
          Alert.alert(
            '🔔 New Order!',
            `${newOrders} new order(s) received`,
            [{ text: 'OK', onPress: () => setNewOrderCount(0) }]
          );
        }
        
        previousOrderCount.current = pendingOrders.length;
        setOrders(pendingOrders);
      }
    } catch (error) {
      if (!isAutoRefresh) {
        Alert.alert('Error', 'Failed to load orders');
      }
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

  const renderOrder = ({ item, index }: { item: Order; index: number }) => {
    const orderTime = new Date(item.createdAt).toLocaleTimeString();
    const isNew = index < newOrderCount;
    
    return (
      <View style={[styles.orderCard, isNew && styles.newOrderCard]}>
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
        
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.teeOffTime}>⏰ Tee-Off: {item.teeOffTime}</Text>
            <Text style={styles.orderTime}>📅 Ordered: {orderTime}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.itemsList}>
          <Text style={styles.itemsTitle}>Order Items:</Text>
          {item.items.map((orderItem, idx) => (
            <View key={idx} style={styles.orderItem}>
              <Text style={styles.orderItemQuantity}>{orderItem.quantity}x</Text>
              <Text style={styles.orderItemText}>{orderItem.name}</Text>
              <Text style={styles.orderItemPrice}>
                R{(orderItem.price * orderItem.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.totalText}>Total: R{item.totalAmount.toFixed(2)}</Text>
          <View style={styles.actionButtons}>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.preparingButton]}
                onPress={() => updateOrderStatus(item.id, 'preparing')}
              >
                <Ionicons name="restaurant" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Start Cooking</Text>
              </TouchableOpacity>
            )}
            {item.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.readyButton]}
                onPress={() => updateOrderStatus(item.id, 'ready')}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Mark Ready</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

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
        <View>
          <Text style={styles.headerTitle}>🍳 Kitchen Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Auto-refreshing every 10s
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileButton}>
            <Ionicons name="person-circle" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {newOrderCount > 0 && (
        <View style={styles.notificationBanner}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <Text style={styles.notificationText}>
            {newOrderCount} New Order{newOrderCount > 1 ? 's' : ''}!
          </Text>
        </View>
      )}

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
            <Ionicons name="checkmark-circle" size={64} color="#4caf50" />
            <Text style={styles.emptyTitle}>All Caught Up! 🎉</Text>
            <Text style={styles.emptyText}>No pending orders at the moment</Text>
            <Text style={styles.emptySubtext}>
              New orders will appear here automatically
            </Text>
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
    backgroundColor: '#2e7d32',
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e8f5e9',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  profileButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  notificationBanner: {
    backgroundColor: '#ff5252',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notificationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  newOrderCard: {
    borderWidth: 3,
    borderColor: '#ff5252',
  },
  newBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#ff5252',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  teeOffTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orderTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
  itemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  orderItemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    width: 40,
  },
  orderItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    padding: 48,
    alignItems: 'center',
    marginTop: 50,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
