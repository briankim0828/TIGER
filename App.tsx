// App.tsx
import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "./src/navigation/rootNavigation";
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
import { WorkoutProvider, useWorkout } from "./src/contexts/WorkoutContext";
import { ElectricProvider } from "./src/electric";
import WorkoutMain from "./src/screens/WorkoutMain";
import ProgressScreen from "./src/screens/ProgressScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BottomNavbar from "./src/components/BottomNavbar";
import ActiveWorkoutModal from "./src/components/ActiveWorkoutModal";
import ActiveWorkoutBanner from "./src/components/ActiveWorkoutBanner";
import SessionSummaryModal from "./src/components/SessionSummaryModal";
import { OverlayProvider, useOverlay } from "./src/contexts/OverlayContext";
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
import DebugDatabaseScreen from "./src/screens/DebugDatabaseScreen";
import LiveWorkoutDebug from "./src/screens/LiveWorkoutDebug";
import DevFloatingDebug from "./src/components/DevFloatingDebug";
import { useLiveActiveSession } from "./src/db/live/workouts";
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
  "[Reanimated] Reading from `value` during component render.",
  "Reading from `value` during component render.",
  // Silence noisy Reanimated ref shareable warning
  "Tried to modify key `current` of an object which has been already passed to a worklet",
  "[Reanimated] Tried to modify key `current` of an object which has been already passed to a worklet",
]);

// Reanimated logger configuration to silence repetitive render warnings
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RNReanimated = require('react-native-reanimated');
  if (RNReanimated && RNReanimated.configureReanimatedLogger) {
    RNReanimated.configureReanimatedLogger({
      // keep errors on, silence noisy warnings
      level: 'error',
      strict: false,
    });
  }
} catch {}

// -----------------------------
// Active Workout Modal Container
// -----------------------------
const ActiveWorkoutModalContainer = () => {
  const { endWorkout, getSessionInfo, getSplitName } = useWorkout();
  const [isVisible, setIsVisible] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isClosingFromSave, setIsClosingFromSave] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerSplitName, setBannerSplitName] = useState('Active Workout');
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState<number | null>(null);
  const [isSuppressed, setIsSuppressed] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthUserId(user?.id ?? null);
      } catch {}
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => { (listener as any)?.subscription?.unsubscribe?.(); };
  }, []);
  const prevSessionIdRef = React.useRef<string | null>(null);

  // Live active session (no polling)
  const { session } = useLiveActiveSession(authUserId || '');

  useEffect(() => {
    const sid = session?.id ?? null;
    setSessionId(sid);
    const prevSid = prevSessionIdRef.current;
    const hasActive = !!sid;
    if (hasActive && sid !== prevSid) {
      // New session started -> open modal immediately and reset suppression
      setIsSuppressed(false);
      setBannerVisible(false);
      setIsVisible(true);
    }
    prevSessionIdRef.current = sid;
  }, [session?.id]);

  // Update banner title and timer from live session
  useEffect(() => {
    const sid = session?.id;
    if (!sid) {
      setBannerVisible(false);
      setIsVisible(false);
      setSessionStartedAtMs(null);
      return;
    }
    (async () => {
      try {
        const info = await getSessionInfo(sid);
        if (info?.splitId) {
          const name = (await getSplitName(info.splitId)) || 'Active Workout';
          setBannerSplitName(name);
        } else {
          setBannerSplitName('Active Workout');
        }
        if (info?.startedAt) setSessionStartedAtMs(Date.parse(info.startedAt));
      } catch {}
    })();
  }, [session?.id, getSessionInfo, getSplitName]);

  const handleEndWorkoutAndClose = async () => {
    if (!sessionId) return;
    setIsClosingFromSave(true);
    await endWorkout(sessionId, { status: 'completed' });
    setTimeout(() => setIsClosingFromSave(false), 500);
  // Hide banner and suppression after ending
  setIsSuppressed(false);
  setBannerVisible(false);
  setIsVisible(false);
  setSessionStartedAtMs(null);
  };

  const handleModalClose = () => {
  // On swipe-down, keep session active but suppress the modal and show banner
  setIsVisible(false);
  setIsSuppressed(true);
  if (sessionId) setBannerVisible(true);
  };

  return (
    <>
      <ActiveWorkoutModal
        isVisible={isVisible}
        onClose={handleModalClose}
        onSave={handleEndWorkoutAndClose}
      />
      <ActiveWorkoutBanner
        visible={bannerVisible}
        splitName={bannerSplitName}
  startedAtMs={sessionStartedAtMs}
        onPress={() => {
          setIsSuppressed(false);
          setBannerVisible(false);
          setIsVisible(true);
        }}
      />
    </>
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
  DebugDatabase: undefined;
  LiveWorkoutDebug: undefined;
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
      <GlobalHeader title="TIGER" />
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
        <GlobalHeader title="TIGER" />
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
            <Stack.Screen name="DebugDatabase" component={DebugDatabaseScreen} />
            <Stack.Screen name="LiveWorkoutDebug" component={LiveWorkoutDebug} />
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
      <ElectricProvider>
        <WorkoutProvider>
                <OverlayProvider>
                <SafeAreaView
                  style={{ flex: 0, backgroundColor: "#1E2028" }}
                  edges={["top"]}
                />
                <SafeAreaView
                  style={{ flex: 1, backgroundColor: "#121213ff" }}
                  edges={["left", "right", "bottom"]}
                >
                  <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
                  <NavigationContainer ref={navigationRef}>
                    <DismissKeyboardWrapper>
                      {user ? (
                        <NavigationWrapper />
                      ) : (
                        <AuthNavigationWrapper />
                      )}
                    </DismissKeyboardWrapper>
                  </NavigationContainer>
                </SafeAreaView>
                {/* Render overlays outside the bottom SafeAreaView so they cover the entire screen incl. insets */}
                <GlobalOverlays />
                  <ActiveWorkoutModalContainer />
                  <DevFloatingDebug />
                </OverlayProvider>
              </WorkoutProvider>
          </ElectricProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Render overlays at root using OverlayContext state
const GlobalOverlays = () => {
  const { sessionSummary, hideSessionSummary } = useOverlay();
  if (!sessionSummary) return null;
  return (
    <SessionSummaryModal
      selectedDate={sessionSummary.selectedDate}
      scheduledSplit={sessionSummary.scheduledSplit}
      onClose={hideSessionSummary}
      onStartWorkout={sessionSummary.onStartWorkout}
    />
  );
};
