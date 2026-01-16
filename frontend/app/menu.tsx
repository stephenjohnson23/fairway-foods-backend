import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function MenuScreen() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    loadUserAndCourse();
    fetchMenu();
  }, []);

  const loadUserAndCourse = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    const courseName = await AsyncStorage.getItem('selectedCourseName');
    if (courseName) {
      setSelectedCourseName(courseName);
    }
  };

  const fetchMenu = async () => {
    try {
      const courseId = await AsyncStorage.getItem('selectedCourseId');
      const response = await fetch(`${API_URL}/api/menu?courseId=${courseId}`);
      if (response.ok) {
        const data = await response.json();
        setMenuItems(data.filter((item: MenuItem) => item.available));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const navigateToCart = () => {
    router.push({
      pathname: '/cart',
      params: { cartData: JSON.stringify(cart) },
    });
  };

  const handleLogout = async () => {
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

  const handleSwitchCourse = () => {
    router.push('/select-course');
  };

  const canSwitchCourse = () => {
    // Only regular users, guests, and super users can switch courses
    // Kitchen, Cashier, and Admin are locked to their assigned courses
    return !user || user.role === 'user' || user.role === 'superuser';
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuItem}>
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.itemImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.itemImage, styles.placeholderImage]}>
          <Ionicons name="restaurant" size={32} color="#999" />
        </View>
      )}
      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.itemPrice}>R{item.price.toFixed(2)}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addToCart(item)}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
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
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Menu</Text>
          {canSwitchCourse() ? (
            <TouchableOpacity
              style={styles.courseSelector}
              onPress={handleSwitchCourse}
            >
              <Ionicons name="golf" size={14} color="#2e7d32" />
              <Text style={styles.courseName}>{selectedCourseName || 'Select Course'}</Text>
              <Ionicons name="chevron-down" size={14} color="#2e7d32" />
            </TouchableOpacity>
          ) : (
            <View style={styles.courseDisplay}>
              <Ionicons name="golf" size={14} color="#2e7d32" />
              <Text style={styles.courseName}>{selectedCourseName}</Text>
            </View>
          )}
          <Text style={styles.headerSubtitle}>
            {user ? `Welcome, ${user.name}` : 'Guest User'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {user && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/profile')}
            >
              <Ionicons name="person-circle" size={24} color="#2e7d32" />
            </TouchableOpacity>
          )}
          {user?.role === 'admin' && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="settings" size={24} color="#2e7d32" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/orders')}
          >
            <Ionicons name="receipt" size={24} color="#2e7d32" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#ff5252" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={menuItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No menu items available</Text>
          </View>
        }
      />

      {cart.length > 0 && (
        <TouchableOpacity style={styles.cartButton} onPress={navigateToCart}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{getCartCount()}</Text>
          </View>
          <Ionicons name="cart" size={24} color="#fff" />
          <Text style={styles.cartButtonText}>
            View Cart - R{getCartTotal().toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  courseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  courseDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
    gap: 4,
  },
  courseName: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  addButton: {
    backgroundColor: '#2e7d32',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  cartButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    left: 16,
    backgroundColor: '#ff5252',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});