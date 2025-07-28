// App.tsx
import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import type { NavigatorScreenParams } from "@react-navigation/native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { DataProvider } from "./src/contexts/DataContext";
import { WorkoutProvider, useWorkout } from "./src/contexts/WorkoutContext";
import WorkoutMain from "./src/screens/WorkoutMain";
import ProgressScreen from "./src/screens/ProgressScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BottomNavbar from "./src/components/BottomNavbar";
import ActiveWorkoutModal from "./src/components/ActiveWorkoutModal";
import LoginScreen from "./src/screens/LoginScreen";
import { supabase } from "./src/utils/supabaseClient";
import {
  TouchableWithoutFeedback,
  Keyboard,
  View,
  StyleSheet,
  LogBox,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ExerciseSelectionView from "./src/components/ExerciseSelectionView";
import { GluestackUIProvider, Box, Text } from "@gluestack-ui/themed";
import { config } from "./gluestack-ui.config";
import { StatusBar } from "react-native";
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBarProps,
} from "@react-navigation/material-top-tabs";

// Ignore specific warning about text strings
LogBox.ignoreLogs([
  "Text strings must be rendered within a <Text> component.",
]);

// -----------------------------
// Active Workout Modal Container
// -----------------------------
const ActiveWorkoutModalContainer = () => {
  const { isWorkoutActive, currentWorkoutSession, endWorkout } = useWorkout();
  const [isClosingFromSave, setIsClosingFromSave] = useState(false);

  const handleEndWorkoutAndClose = async () => {
    setIsClosingFromSave(true);
    await endWorkout();
    setTimeout(() => setIsClosingFromSave(false), 500);
  };

  const handleModalClose = () => {
    if (isWorkoutActive && !isClosingFromSave) {
      endWorkout();
    } else {
      console.log(
        "App - Modal already closing from save operation, skipping duplicate endWorkout call"
      );
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

// -----------------------------
// Keyboard Dismiss Wrapper
// -----------------------------
const DismissKeyboardWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>{children}</View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

// -----------------------------
// Types
// -----------------------------
type TabType = "workout" | "progress" | "profile";

type MainTabParamList = {
  Workout: undefined;
  Progress: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  Login: undefined;
  ExerciseSelectionModalScreen: undefined;
};

// -----------------------------
// Navigators
// -----------------------------
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createMaterialTopTabNavigator<MainTabParamList>();

// -----------------------------
// Global Header
// -----------------------------
interface GlobalHeaderProps {
  title: string;
}
const GlobalHeader = ({ title }: GlobalHeaderProps) => {
  const insets = useSafeAreaInsets();
  return (
    <Box bg="#1E2028" px={4} pb={3}>
      <Text color="white" fontSize="$2xl" fontWeight="bold">
        {title}
      </Text>
    </Box>
  );
};

// -----------------------------
// Auth (Login) wrapper
// -----------------------------
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

// -----------------------------
// Bottom tab-bar adapter
// -----------------------------
const tabRouteMap = {
  workout: "Workout",
  progress: "Progress",
  profile: "Profile",
} as const;

const BottomTabBarAdapter = ({
  state,
  navigation,
}: MaterialTopTabBarProps) => {
  const routeName = state.routeNames[state.index] as keyof MainTabParamList;
  const selectedTab = routeName.toLowerCase() as TabType;

  const onTabChange = (tab: TabType) => {
    navigation.navigate(tabRouteMap[tab]);
  };

  return (
    <BottomNavbar selectedTab={selectedTab} onTabChange={onTabChange} />
  );
};

// -----------------------------
// Main Tabs (Workout / Progress / Profile)
// -----------------------------
function MainTabs() {
  return (
    <Box flex={1} bg="#1E2028">
      <Box alignItems="center">
        <GlobalHeader title="PR." />
      </Box>
      <Box flex={1}>
        <Tab.Navigator
          initialRouteName="Progress"
          tabBarPosition="bottom"
          tabBar={(props) => <BottomTabBarAdapter {...props} />}
          screenOptions={{
            swipeEnabled: true, // left/right gestures + slide animation
          }}
        >
          <Tab.Screen name="Workout" component={WorkoutMain} />
          <Tab.Screen name="Progress" component={ProgressScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </Box>

      {/* Keep the active workout modal overlayed above tabs */}
      <ActiveWorkoutModalContainer />
    </Box>
  );
}

// -----------------------------
// App Shell (tabs + modal in a native-stack)
// -----------------------------
const NavigationWrapper = () => {
  return (
    <Box flex={1} bg="#1E2028">
      <Box flex={1}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#232530" },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Group
            screenOptions={{ presentation: "modal", headerShown: false }}
          >
            <Stack.Screen
              name="ExerciseSelectionModalScreen"
              component={ExerciseSelectionView}
            />
          </Stack.Group>
        </Stack.Navigator>
      </Box>
    </Box>
  );
};

// -----------------------------
// Root App
// -----------------------------
export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      if (authListener && (authListener as any).subscription) {
        (authListener as any).subscription.unsubscribe();
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
                edges={["left", "right", "bottom"]}
              >
                <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
                <NavigationContainer>
                  <DismissKeyboardWrapper>
                    {user ? (
                      <NavigationWrapper />
                    ) : (
                      <AuthNavigationWrapper />
                    )}
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
