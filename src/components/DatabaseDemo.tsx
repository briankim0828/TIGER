// Example component demonstrating the data access layer
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useDatabase } from '../db/queries';

interface Exercise {
  id: string;
  name: string;
  kind: string;
  modality: string;
}

export function DatabaseDemo() {
  const db = useDatabase();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [splits, setSplits] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const exerciseData = await db.getAllExercises();
      const splitData = await db.getUserSplits('demo-user-id');
      
      setExercises(exerciseData as Exercise[]);
      setSplits(splitData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const createDemoSplit = async () => {
    try {
      await db.createSplit({
        name: 'Push Day',
        userId: 'demo-user-id',
        color: '#FF6B6B'
      });
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error creating split:', error);
    }
  };

  const createWorkoutSession = async () => {
    try {
      await db.createWorkoutSession({
        userId: 'demo-user-id',
        splitId: splits[0]?.id
      });
      console.log('Workout session created!');
    } catch (error) {
      console.error('Error creating workout session:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database Demo</Text>
      
      <TouchableOpacity style={styles.button} onPress={createDemoSplit}>
        <Text style={styles.buttonText}>Create Demo Split</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={createWorkoutSession}>
        <Text style={styles.buttonText}>Start Workout</Text>
      </TouchableOpacity>
      
      <Text style={styles.sectionTitle}>Exercises ({exercises.length})</Text>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>{item.kind} • {item.modality}</Text>
          </View>
        )}
        style={styles.list}
      />
      
      <Text style={styles.sectionTitle}>Splits ({splits.length})</Text>
      <FlatList
        data={splits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>Color: {item.color}</Text>
          </View>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1E2028',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4F46E5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  list: {
    maxHeight: 150,
  },
  item: {
    backgroundColor: '#2A2D3A',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  itemName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemDetails: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
});
