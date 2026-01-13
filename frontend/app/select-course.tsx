import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

interface GolfCourse {
  id: string;
  name: string;
  location: string;
  description?: string;
  active: boolean;
}

export default function CourseSelectionScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      } else {
        Alert.alert('Error', 'Failed to load golf courses');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCourse = async (course: GolfCourse) => {
    try {
      await AsyncStorage.setItem('selectedCourseId', course.id);
      await AsyncStorage.setItem('selectedCourseName', course.name);
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save course selection');
    }
  };

  const renderCourse = ({ item }: { item: GolfCourse }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => handleSelectCourse(item)}
      activeOpacity={0.7}
    >
      <View style={styles.courseIcon}>
        <Ionicons name="golf" size={40} color="#2e7d32" />
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{item.name}</Text>
        <Text style={styles.courseLocation}>
          <Ionicons name="location" size={14} color="#666" /> {item.location}
        </Text>
        {item.description && (
          <Text style={styles.courseDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color="#999" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading golf courses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Golf Course</Text>
        <Text style={styles.subtitle}>Choose where you're playing today</Text>
      </View>

      <FlatList
        data={courses}
        renderItem={renderCourse}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="golf" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No golf courses available</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2e7d32',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e8f5e9',
  },
  listContent: {
    padding: 16,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  courseIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  courseLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  courseDescription: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});
