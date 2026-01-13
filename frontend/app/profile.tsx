import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    displayName: '',
    phone: '',
    membershipNumber: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (!token || !userData) {
        Alert.alert('Error', 'Please login first');
        router.replace('/');
        return;
      }
      
      setUser(JSON.parse(userData));

      const response = await fetch(`${API_URL}/api/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile({
          displayName: data.displayName || '',
          phone: data.phone || '',
          membershipNumber: data.membershipNumber || '',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local storage with new profile data
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          user.profile = data.profile;
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
        
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'superuser': return 'Super User';
      case 'admin': return 'Administrator';
      case 'kitchen': return 'Kitchen Staff';
      case 'cashier': return 'Cashier';
      default: return 'Member';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={50} color="#2e7d32" />
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleDisplay(user?.role)}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={profile.displayName}
              onChangeText={(text) => setProfile({ ...profile, displayName: text })}
              placeholder="How should we call you?"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>This name will appear on your orders</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => setProfile({ ...profile, phone: text })}
              placeholder="e.g., 082 123 4567"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>For order notifications</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Membership</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Membership Number</Text>
            <TextInput
              style={styles.input}
              value={profile.membershipNumber}
              onChangeText={(text) => setProfile({ ...profile, membershipNumber: text })}
              placeholder="e.g., MEM-12345"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>Optional - for member benefits</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#1976d2" />
            <Text style={styles.infoText}>
              Your profile data is saved securely and used to make ordering faster. You stay logged in for 30 days.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#2e7d32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976d2',
    lineHeight: 18,
  },
});
