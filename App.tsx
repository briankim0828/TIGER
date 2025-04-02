import React, { useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NativeBaseProvider, Box, StatusBar, Text } from 'native-base';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DataProvider } from './src/contexts/DataContext';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SplitDetailScreen from './src/screens/SplitDetailScreen';
import ExerciseSelectionView from './src/components/ExerciseSelectionView';
import BottomNavbar from './src/components/BottomNavbar';
import { Split, Exercise } from './src/types';

type RootStackParamList = {
  Workout: undefined;
  Progress: undefined;
  Profile: undefined;
  SplitDetail: { split: Split; onClose: () => void; onUpdate: (split: Split) => void };
  ExerciseSelection: { onClose: () => void; onAddExercise: (exercises: Exercise[]) => void };
};

type TabType = 'workout' | 'progress' | 'profile';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Global header component
const GlobalHeader = () => {
  const insets = useSafeAreaInsets();
  return (
    <Box 
      bg="#1E2028" 
      pt={0.2}
      px={4} 
      pb={2} 
      borderBottomWidth={0} 
      alignItems="center" 
      justifyContent="center"
    >
      <Text color="white" fontSize="24" fontWeight="bold">
        PR.
      </Text>
    </Box>
  );
};

// Navigation wrapper component to use navigation hook
const NavigationWrapper = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>('workout'); // this is where the default tab is set
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Add debugging logs
  React.useEffect(() => {
    console.log('Current tab:', selectedTab);
  }, [selectedTab]);

  const handleTabChange = (tab: TabType) => {
    console.log('handleTabChange');
    setSelectedTab(tab);
    // Navigate to the corresponding screen
    switch (tab) {
      case 'workout':
        navigation.navigate('Workout');
        break;
      case 'progress':
        navigation.navigate('Progress');
        break;
      case 'profile':
        navigation.navigate('Profile');
        break;
    }
  };

  return (
    <Box flex={1} bg="#1E2028">
      <GlobalHeader />
      <Box flex={1}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#1E2028" },
          }}
        >
          <Stack.Screen name="Workout" component={WorkoutScreen} />
          <Stack.Screen name="Progress" component={ProgressScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen 
            name="SplitDetail" 
            component={SplitDetailScreen as React.ComponentType<any>} 
          />
          <Stack.Screen 
            name="ExerciseSelection" 
            component={ExerciseSelectionView as React.ComponentType<any>} 
          />
        </Stack.Navigator>
      </Box>
      <BottomNavbar selectedTab={selectedTab} onTabChange={handleTabChange} />
    </Box>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NativeBaseProvider>
        <DataProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#1E2028" }} edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
            <NavigationContainer>
              <NavigationWrapper />
            </NavigationContainer>
          </SafeAreaView>
        </DataProvider>
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}
