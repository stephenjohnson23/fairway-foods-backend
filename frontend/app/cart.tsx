import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || '';

interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
}

export default function CartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cartData = params.cartData ? JSON.parse(params.cartData as string) : [];
  
  const [cart, setCart] = useState<CartItem[]>(cartData);
  const [customerName, setCustomerName] = useState('');
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Generate hours (6am to 6pm for golf)
  const hours = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 6;
    return hour.toString().padStart(2, '0');
  });
  
  // Generate minutes (all 60 minutes)
  const minutes = Array.from({ length: 60 }, (_, i) => {
    return i.toString().padStart(2, '0');
  });

  const teeOffTime = `${selectedHour}:${selectedMinute}`;

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        // Pre-fill name from profile data
        if (user.profile) {
          if (user.profile.displayName) {
            setCustomerName(user.profile.displayName);
          } else if (user.name) {
            setCustomerName(user.name);
          }
        } else if (user.name) {
          setCustomerName(user.name);
        }
      }
    } catch (error) {
      console.log('Error loading profile data:', error);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!teeOffTime.trim()) {
      Alert.alert('Error', 'Please enter your tee-off time');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    setLoading(true);
    try {
      const courseId = await AsyncStorage.getItem('selectedCourseId');
      if (!courseId) {
        Alert.alert('Error', 'No golf course selected');
        return;
      }

      const orderData = {
        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        customerName,
        teeOffTime,
        totalAmount: getTotal(),
        courseId,
      };

      // Check if user is logged in
      const token = await AsyncStorage.getItem('token');
      const endpoint = token ? '/api/orders/user' : '/api/orders';
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error('Failed to place order');
      }

      Alert.alert(
        'Success',
        'Your order has been placed successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/menu'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>R{item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControl}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, -1)}
        >
          <Ionicons name="remove" size={20} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, 1)}
        >
          <Ionicons name="add" size={20} color="#2e7d32" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeItem(item.id)}
        >
          <Ionicons name="trash" size={20} color="#ff5252" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2e7d32" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {cart.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.backToMenuButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backToMenuText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={cart}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Enter your name"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tee-Off Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowTimePicker(!showTimePicker)}
                >
                  <Ionicons name="time-outline" size={20} color="#2e7d32" />
                  <Text style={styles.timePickerText}>{teeOffTime}</Text>
                  <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                </TouchableOpacity>
                
                {showTimePicker && (
                  <View style={styles.timePickerContainer}>
                    <View style={styles.timePickerRow}>
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeColumnLabel}>Hour</Text>
                        <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                          {hours.map((hour) => (
                            <TouchableOpacity
                              key={hour}
                              style={[
                                styles.timeOption,
                                selectedHour === hour && styles.timeOptionSelected
                              ]}
                              onPress={() => setSelectedHour(hour)}
                            >
                              <Text style={[
                                styles.timeOptionText,
                                selectedHour === hour && styles.timeOptionTextSelected
                              ]}>
                                {hour}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                      
                      <Text style={styles.timeSeparator}>:</Text>
                      
                      <View style={styles.timeColumn}>
                        <Text style={styles.timeColumnLabel}>Min</Text>
                        <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false}>
                          {minutes.map((minute) => (
                            <TouchableOpacity
                              key={minute}
                              style={[
                                styles.timeOption,
                                selectedMinute === minute && styles.timeOptionSelected
                              ]}
                              onPress={() => setSelectedMinute(minute)}
                            >
                              <Text style={[
                                styles.timeOptionText,
                                selectedMinute === minute && styles.timeOptionTextSelected
                              ]}>
                                {minute}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.confirmTimeButton}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text style={styles.confirmTimeText}>Confirm Time</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>R{getTotal().toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.placeOrderButton, loading && styles.disabledButton]}
              onPress={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.placeOrderText}>Place Order</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  backToMenuButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToMenuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemInfo: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#2e7d32',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  deleteButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  formSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  timePickerButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  timePickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeColumn: {
    alignItems: 'center',
    width: 80,
  },
  timeColumnLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  timeScroll: {
    maxHeight: 150,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  timeOptionSelected: {
    backgroundColor: '#2e7d32',
  },
  timeOptionText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
  },
  timeOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 8,
  },
  confirmTimeButton: {
    backgroundColor: '#2e7d32',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  confirmTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  totalSection: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  placeOrderButton: {
    backgroundColor: '#2e7d32',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});