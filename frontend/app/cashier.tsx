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
  TextInput,
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

export default function CashierDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkCashierAccess();
    fetchOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, filterStatus, searchQuery]);

  const checkCashierAccess = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      Alert.alert('Error', 'Please login to access cashier dashboard');
      router.replace('/');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'cashier' && user.role !== 'admin') {
      Alert.alert('Error', 'Cashier access required');
      router.back();
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders`);
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

  const applyFilters = () => {
    let filtered = orders;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    // Search by customer name or tee-off time
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.teeOffTime.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
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

  const getTotalRevenue = () => {
    return filteredOrders
      .filter(order => order.status === 'ready')
      .reduce((sum, order) => sum + order.totalAmount, 0);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const orderTime = new Date(item.createdAt).toLocaleString();

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.customerName}>{item.customerName}</Text>
            <Text style={styles.teeOffTime}>⏰ {item.teeOffTime}</Text>
            <Text style={styles.orderTime}>📅 {orderTime}</Text>
          </View>
          <View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.orderTotal}>${item.totalAmount.toFixed(2)}</Text>
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

        {item.status !== 'ready' && (
          <View style={styles.actionButtons}>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.preparingButton]}
                onPress={() => updateOrderStatus(item.id, 'preparing')}
              >
                <Text style={styles.actionButtonText}>Start Preparing</Text>
              </TouchableOpacity>
            )}
            {item.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.readyButton]}
                onPress={() => updateOrderStatus(item.id, 'ready')}
              >
                <Text style={styles.actionButtonText}>Mark as Ready</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
          <Text style={styles.headerTitle}>💰 Cashier Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Total Orders: {filteredOrders.length}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filteredOrders.filter(o => o.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filteredOrders.filter(o => o.status === 'preparing').length}</Text>
          <Text style={styles.statLabel}>Preparing</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filteredOrders.filter(o => o.status === 'ready').length}</Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
        <View style={[styles.statBox, styles.revenueBox]}>
          <Text style={styles.revenueValue}>${getTotalRevenue().toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or tee-off time..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'all' && styles.filterButtonTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('pending')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'pending' && styles.filterButtonTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'preparing' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('preparing')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'preparing' && styles.filterButtonTextActive]}>Preparing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'ready' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('ready')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'ready' && styles.filterButtonTextActive]}>Ready</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No orders found</Text>
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
    backgroundColor: '#1565c0',
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
    fontSize: 14,
    color: '#e3f2fd',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  revenueBox: {
    backgroundColor: '#4caf50',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  revenueValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1565c0',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
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
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
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
  orderTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'right',
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
    marginBottom: 6,
  },
  orderItemText: {
    fontSize: 14,
    color: '#333',
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
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
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});