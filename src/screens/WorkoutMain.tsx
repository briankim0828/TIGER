import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutScreen from './WorkoutScreen';
import SplitDetailScreen from './SplitDetailScreen';
import ExerciseSelectionView from '../components/ExerciseSelectionView';
import { Split } from '../types';

export type WorkoutStackParamList = {
  WorkoutMain: undefined;
  SplitDetail: { split: Split };
  ExerciseSelection: undefined;
};

const Stack = createNativeStackNavigator<WorkoutStackParamList>();

const WorkoutMain = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: "#1E2028" }
      }}
    >
      <Stack.Screen name="WorkoutMain" component={WorkoutScreen} />
      <Stack.Screen name="SplitDetail" component={SplitDetailScreen} />
      <Stack.Screen name="ExerciseSelection" component={ExerciseSelectionView} />
    </Stack.Navigator>
  );
};

export default WorkoutMain; 