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
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
}

interface GolfCourse {
  id: string;
  name: string;
  location: string;
}

export default function MenuManagementScreen() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true,
  });

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchMenu();
    }
  }, [selectedCourseId]);

  const checkAccess = async () => {
    const userData = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');
    
    if (!userData || !token) {
      Alert.alert('Error', 'Please login to access menu management');
      router.replace('/');
      return;
    }
    
    const user = JSON.parse(userData);
    
    if (user.role !== 'admin' && user.role !== 'superuser') {
      Alert.alert('Error', 'Admin or Super User access required');
      router.back();
      return;
    }
    
    // Fetch courses the user can manage
    const baseUrl = getBaseUrl();
    try {
      const response = await fetch(`${baseUrl}/api/courses/my-courses`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const coursesData = await response.json();
        setCourses(coursesData);
        
        if (coursesData.length > 0) {
          const savedCourseId = await AsyncStorage.getItem('adminSelectedCourseId');
          const validCourse = coursesData.find((c: GolfCourse) => c.id === savedCourseId);
          
          if (validCourse) {
            setSelectedCourseId(savedCourseId as string);
          } else {
            setSelectedCourseId(coursesData[0].id);
          }
        } else {
          Alert.alert(
            'No Courses Assigned',
            'You have not been assigned to any golf courses.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load courses');
    }
  };

  const fetchMenu = async () => {
    if (!selectedCourseId) return;
    
    setLoading(true);
    const baseUrl = getBaseUrl();
    try {
      const response = await fetch(`${baseUrl}/api/menu?courseId=${selectedCourseId}`);
      if (response.ok) {
        const data = await response.json();
        setMenuItems(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseChange = async (courseId: string) => {
    setSelectedCourseId(courseId);
    await AsyncStorage.setItem('adminSelectedCourseId', courseId);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      available: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      category: item.category,
      available: item.available,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const token = await AsyncStorage.getItem('token');
    if (!token) {
      Alert.alert('Error', 'Please login again');
      return;
    }

    const baseUrl = getBaseUrl();
    try {
      const url = editingItem
        ? `${baseUrl}/api/menu/${editingItem.id}`
        : `${baseUrl}/api/menu`;
      const method = editingItem ? 'PUT' : 'POST';

      const itemData: any = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        available: formData.available,
      };
      
      if (!editingItem) {
        itemData.courseId = selectedCourseId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save menu item');
      }

      Alert.alert('Success', `Menu item ${editingItem ? 'updated' : 'created'} successfully`);
      setModalVisible(false);
      fetchMenu();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = async (itemId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await AsyncStorage.getItem('token');
            const baseUrl = getBaseUrl();
            try {
              const response = await fetch(`${baseUrl}/api/menu/${itemId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                throw new Error('Failed to delete item');
              }

              Alert.alert('Success', 'Menu item deleted');
              fetchMenu();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.menuItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
        <Text style={styles.itemPrice}>R{item.price.toFixed(2)}</Text>
        <Text style={[styles.availabilityText, !item.available && styles.unavailable]}>
          {item.available ? 'Available' : 'Unavailable'}
        </Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create" size={20} color="#2196f3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash" size={20} color="#ff5252" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {courses.length > 1 && (
        <View style={styles.courseSelectorContainer}>
          <Text style={styles.courseSelectorLabel}>Managing menu for:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseChipsScroll}>
            {courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseChip,
                  selectedCourseId === course.id && styles.courseChipActive
                ]}
                onPress={() => handleCourseChange(course.id)}
              >
                <Ionicons 
                  name="golf" 
                  size={16} 
                  color={selectedCourseId === course.id ? '#fff' : '#2e7d32'} 
                />
                <Text style={[
                  styles.courseChipText,
                  selectedCourseId === course.id && styles.courseChipTextActive
                ]}>
                  {course.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {courses.length === 1 && (
        <View style={styles.singleCourseHeader}>
          <Ionicons name="golf" size={18} color="#2e7d32" />
          <Text style={styles.singleCourseName}>{selectedCourse?.name}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      ) : (
        <FlatList
          data={menuItems}
          renderItem={renderMenuItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No menu items yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first item</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Item name"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Item description"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Price *</Text>
              <TextInput
                style={styles.input}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                value={formData.category}
                onChangeText={(text) => setFormData({ ...formData, category: text })}
                placeholder="e.g., Appetizer, Main Course, Beverage"
              />

              <View style={styles.switchContainer}>
                <Text style={styles.label}>Available</Text>
                <TouchableOpacity
                  style={[
                    styles.switch,
                    formData.available && styles.switchActive,
                  ]}
                  onPress={() =>
                    setFormData({ ...formData, available: !formData.available })
                  }
                >
                  <View
                    style={[
                      styles.switchThumb,
                      formData.available && styles.switchThumbActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save Item</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    padding: 16,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  courseSelectorContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  courseSelectorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  courseChipsScroll: {
    flexDirection: 'row',
  },
  courseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  courseChipActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  courseChipText: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '500',
  },
  courseChipTextActive: {
    color: '#fff',
  },
  singleCourseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  singleCourseName: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  availabilityText: {
    fontSize: 12,
    color: '#4caf50',
  },
  unavailable: {
    color: '#ff5252',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#2e7d32',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
