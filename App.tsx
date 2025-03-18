import React from 'react';
import { NativeBaseProvider, Box, Text, StatusBar } from 'native-base';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';

// Define the StackParamList type for our navigation
type StackParamList = {
  Home: undefined;
};

const AppHeader = () => {
  return (
    <Box bg="#1E2028" pt={1} px={4} pb={3} borderBottomWidth={0} alignItems="center" justifyContent="center">
      <Text color="white" fontSize="24" fontWeight="bold">
        PR.
      </Text>
    </Box>
  );
};

// Create the Stack Navigator
const Stack = createNativeStackNavigator<StackParamList>();

// Main Navigation component
const Navigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        contentStyle: { backgroundColor: "#1E2028" },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NativeBaseProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1E2028" }}>
          <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
        </SafeAreaView>
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}
