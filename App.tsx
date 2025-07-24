import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DataProvider, useData } from "./src/contexts/DataContext";
import { WorkoutProvider, useWorkout } from "./src/contexts/WorkoutContext";
import WorkoutMain from "./src/screens/WorkoutMain";
import ProgressScreen from "./src/screens/ProgressScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BottomNavbar from "./src/components/BottomNavbar";
import ActiveWorkoutModal from "./src/components/ActiveWorkoutModal";
import LoginScreen from "./src/screens/LoginScreen";
import { supabase } from "./src/utils/supabaseClient";
import { TouchableWithoutFeedback, Keyboard, View, StyleSheet, LogBox } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ExerciseSelectionView from "./src/components/ExerciseSelectionView";
import { GluestackUIProvider, Box, Text } from "@gluestack-ui/themed";
import { config } from "./gluestack-ui.config";
import { StatusBar } from "react-native";

// Ignore specific warning about text strings
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component.']);

// Active Workout Modal Component
const ActiveWorkoutModalContainer = () => {
  const { isWorkoutActive, currentWorkoutSession, endWorkout } = useWorkout();
  
  // Keep track of whether endWorkout is being called internally
  const [isClosingFromSave, setIsClosingFromSave] = useState(false);

  // Custom wrapper for endWorkout to set the flag
  const handleEndWorkoutAndClose = async () => {
    setIsClosingFromSave(true);
    await endWorkout();
    // Reset the flag after a short delay to handle any cleanup
    setTimeout(() => {
      setIsClosingFromSave(false);
    }, 500);
  };

  // Added callback to handle the modal closing without saving
  const handleModalClose = () => {
    // console.log('App - Modal closed via onClose callback');
    
    // Only call endWorkout if not already closing from an endWorkout call
    if (isWorkoutActive && !isClosingFromSave) {
      // console.log('App - Modal closed externally, calling endWorkout to cleanup');
      endWorkout();
    } else {
      console.log('App - Modal already closing from save operation, skipping duplicate endWorkout call');
    }
  };

  return (
    <ActiveWorkoutModal 
      isVisible={isWorkoutActive}
      exercises={currentWorkoutSession?.exercises || []}
      onClose={handleModalClose}
      onSave={handleEndWorkoutAndClose}
    />
  );
};

// Create a wrapper component for keyboard dismissal
const DismissKeyboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

type RootStackParamList = {
  Workout: undefined;
  Progress: undefined;
  Profile: undefined;
  Login: undefined;
  ExerciseSelectionModalScreen: undefined;
};

type TabType = "workout" | "progress" | "profile";

const Stack = createNativeStackNavigator<RootStackParamList>();

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define props for GlobalHeader
interface GlobalHeaderProps {
  title: string;
}

// Global header component
const GlobalHeader = ({ title }: GlobalHeaderProps) => {
  const insets = useSafeAreaInsets();
  return (
    <Box
      bg="#1E2028"
      // pt={insets.top} // Apply top padding using safe area insets
      px={4}
      pb={3}
      // borderBottomWidth={1}
      // borderBottomColor="#3a3f4b"
    >
      <Text color="white" fontSize="$2xl" fontWeight="bold">
        {title}
      </Text>
    </Box>
  );
};

// Navigation wrapper component to use navigation hook
const AuthNavigationWrapper = () => {
  return (
    <Box flex={1} bg="#1E2028">
      <GlobalHeader title="PR." />
      <Box flex={1}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: "#232530" },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      </Box>
    </Box>
  );
};

// Navigation wrapper component to use navigation hook
const NavigationWrapper = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>("progress");
  const navigation = useNavigation<NavigationProp>();
  const { splits } = useData();

  // Add debugging logs
  React.useEffect(() => {
    console.log("Current tab:", selectedTab);
    // console.log("Data Storage State:", {
    //   splits,
    // });
  }, [selectedTab]);

  const handleTabChange = (tab: TabType) => {
    console.log("handleTabChange");
    setSelectedTab(tab);
    // Navigate to the corresponding screen
    switch (tab) {
      case "workout":
        navigation.navigate("Workout");
        break;
      case "progress":
        navigation.navigate("Progress");
        break;
      case "profile":
        navigation.navigate("Profile");
        break;
    }
  };

  return (
    <Box flex={1} bg="#1E2028">
      <Box alignItems="center">
      <GlobalHeader title="PR." />
      </Box>
      <Box flex={1}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: "slide_from_bottom",
            contentStyle: { backgroundColor: "#232530" },
          }}
          initialRouteName="Progress"
        >
          <Stack.Group>
            <Stack.Screen name="Workout" component={WorkoutMain} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </Stack.Group>

          <Stack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
            <Stack.Screen
              name="ExerciseSelectionModalScreen"
              component={ExerciseSelectionView}
            />
          </Stack.Group>
        </Stack.Navigator>
      </Box>
      
      {/* Active Workout Modal */}
      <ActiveWorkoutModalContainer />

      <BottomNavbar selectedTab={selectedTab} onTabChange={handleTabChange} />
    </Box>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if the user is logged in on app load
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser(); // Using the new method
      setUser(user); // Set user state
    };

    fetchUser(); // Check on app load

    // Listen for authentication state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null); // Update user state based on session
    });

    // Cleanup listener on unmount
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe(); // Proper cleanup
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider config={config}>
          <DataProvider>
            <WorkoutProvider>
              <SafeAreaView 
                style={{ flex: 0, backgroundColor: "#1E2028" }}
                edges={["top"]}
              />
              <SafeAreaView
                style={{ flex: 1, backgroundColor: "#121213ff" }}
                edges={[ "left", "right", "bottom"]}
              >
                <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
                <NavigationContainer>
                  <DismissKeyboardWrapper>
                    {user ? <NavigationWrapper /> : <AuthNavigationWrapper />}
                  </DismissKeyboardWrapper>
                </NavigationContainer>
              </SafeAreaView>
            </WorkoutProvider>
          </DataProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
