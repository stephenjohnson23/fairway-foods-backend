import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  courseIds: string[];
}

interface GolfCourse {
  id: string;
  name: string;
  location: string;
}

export default function UserManagementScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  
  // New user creation state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserCourses, setNewUserCourses] = useState<string[]>([]);

  useEffect(() => {
    checkSuperUser();
    fetchUsers();
    fetchCourses();
  }, []);

  const checkSuperUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      Alert.alert('Error', 'Please login');
      router.replace('/');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'superuser') {
      Alert.alert('Error', 'Super user access required');
      router.back();
    }
  };

  const fetchUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.log('Failed to load courses');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setSelectedCourses(user.courseIds || []);
    setModalVisible(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedUser) return;

    const token = await AsyncStorage.getItem('token');

    try {
      // Update role
      const roleResponse = await fetch(`${API_URL}/api/users/${selectedUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      // Update courses
      const coursesResponse = await fetch(`${API_URL}/api/users/${selectedUser.id}/courses`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ courseIds: selectedCourses }),
      });

      if (roleResponse.ok && coursesResponse.ok) {
        Alert.alert('Success', 'User permissions updated');
        setModalVisible(false);
        fetchUsers();
      } else {
        Alert.alert('Error', 'Failed to update user');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update user');
    }
  };

  const toggleCourse = (courseId: string) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
    } else {
      setSelectedCourses([...selectedCourses, courseId]);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/');
  };

  const openCreateModal = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserRole('user');
    setNewUserCourses([]);
    setCreateModalVisible(true);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName) {
      Alert.alert('Error', 'Please enter email and name');
      return;
    }

    const token = await AsyncStorage.getItem('token');

    try {
      const response = await fetch(`${API_URL}/api/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          role: newUserRole,
          courseIds: newUserCourses,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create user');
      }

      Alert.alert(
        'User Created!',
        `Email: ${newUserEmail}\nDefault Password: ${data.defaultPassword}\n\nPlease share these credentials with the user.`,
        [{ text: 'OK' }]
      );
      
      setCreateModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleNewUserCourse = (courseId: string) => {
    if (newUserCourses.includes(courseId)) {
      setNewUserCourses(newUserCourses.filter(id => id !== courseId));
    } else {
      setNewUserCourses([...newUserCourses, courseId]);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superuser': return '#9c27b0';
      case 'admin': return '#f44336';
      case 'kitchen': return '#4caf50';
      case 'cashier': return '#2196f3';
      case 'user': return '#ff9800';
      default: return '#999';
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.courseChips}>
          {item.courseIds && item.courseIds.length > 0 ? (
            <Text style={styles.courseCount}>
              📍 {item.courseIds.length} course(s) assigned
            </Text>
          ) : (
            <Text style={styles.noCourses}>No courses assigned</Text>
          )}
        </View>
      </View>
      <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
        <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#9c27b0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>👤 User Management</Text>
          <Text style={styles.headerSubtitle}>Super Admin Panel</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openCreateModal} style={styles.addUserButton}>
            <Ionicons name="person-add" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User Permissions</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalUserName}>{selectedUser?.name}</Text>
              <Text style={styles.modalUserEmail}>{selectedUser?.email}</Text>

              <Text style={styles.sectionTitle}>Role</Text>
              <View style={styles.roleButtons}>
                {['user', 'admin', 'kitchen', 'cashier', 'superuser'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      selectedRole === role && styles.roleButtonActive,
                      { borderColor: getRoleColor(role) }
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        selectedRole === role && { color: getRoleColor(role) }
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Assigned Golf Courses</Text>
              <Text style={styles.sectionSubtitle}>
                Select courses this user can manage
              </Text>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.courseItem}
                  onPress={() => toggleCourse(course.id)}
                >
                  <View style={styles.courseItemInfo}>
                    <Ionicons name="golf" size={20} color="#2e7d32" />
                    <View style={styles.courseItemText}>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.courseLocation}>{course.location}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      selectedCourses.includes(course.id) && styles.checkboxChecked
                    ]}
                  >
                    {selectedCourses.includes(course.id) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveChanges}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New User</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={newUserName}
                onChangeText={setNewUserName}
                placeholder="John Doe"
                autoCapitalize="words"
              />

              <Text style={styles.sectionTitle}>Assign Role</Text>
              <View style={styles.roleButtons}>
                {['user', 'admin', 'kitchen', 'cashier', 'superuser'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      newUserRole === role && styles.roleButtonActive,
                      { borderColor: getRoleColor(role) }
                    ]}
                    onPress={() => setNewUserRole(role)}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        newUserRole === role && { color: getRoleColor(role) }
                      ]}
                    >
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Assign Golf Courses</Text>
              <Text style={styles.sectionSubtitle}>
                Select courses this user can access
              </Text>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={styles.courseItem}
                  onPress={() => toggleNewUserCourse(course.id)}
                >
                  <View style={styles.courseItemInfo}>
                    <Ionicons name="golf" size={20} color="#2e7d32" />
                    <View style={styles.courseItemText}>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.courseLocation}>{course.location}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      newUserCourses.includes(course.id) && styles.checkboxChecked
                    ]}
                  >
                    {newUserCourses.includes(course.id) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              <View style={styles.noteBox}>
                <Ionicons name="information-circle" size={20} color="#2196f3" />
                <Text style={styles.noteText}>
                  Default password "change123" will be generated. Share credentials with the user.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateUser}
              >
                <Text style={styles.saveButtonText}>Create User</Text>
              </TouchableOpacity>
            </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#9c27b0',
    padding: 16,
    paddingTop: 48,
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
    color: '#f3e5f5',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addUserButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  courseChips: {
    marginTop: 8,
  },
  courseCount: {
    fontSize: 12,
    color: '#2e7d32',
  },
  noCourses: {
    fontSize: 12,
    color: '#999',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalUserEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  roleButtonActive: {
    backgroundColor: '#f5f5f5',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  courseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  courseItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  courseItemText: {
    flex: 1,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  courseLocation: {
    fontSize: 12,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  saveButton: {
    backgroundColor: '#9c27b0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
