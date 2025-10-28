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
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { WorkoutProvider, useWorkout } from "./src/contexts/WorkoutContext";
import { ElectricProvider } from "./src/electric";
import WorkoutMain from "./src/screens/WorkoutMain";
import ProgressScreen from "./src/screens/ProgressScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import BottomNavbar from "./src/components/BottomNavbar";
import ActiveWorkoutModal from "./src/components/ActiveWorkoutModal";
import ActiveWorkoutBanner from "./src/components/ActiveWorkoutBanner";
import SessionPreviewModal from "./src/components/SessionPreviewModal";
import WorkoutSummaryModal from "./src/components/WorkoutSummaryModal";
import { OverlayProvider, useOverlay } from "./src/contexts/OverlayContext";
import LoginScreen from "./src/screens/LoginScreen";
import { supabase } from "./src/utils/supabaseClient";
import {
  TouchableWithoutFeedback,
  Keyboard,
  View,
  StyleSheet,
  LogBox,
  Pressable,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ExerciseSelectionView from "./src/components/ExerciseSelectionView";
import DebugDatabaseScreen from "./src/screens/DebugDatabaseScreen";
import LiveWorkoutDebug from "./src/screens/LiveWorkoutDebug";
import DevFloatingDebug from "./src/components/DevFloatingDebug";
import { useLiveActiveSession } from "./src/db/live/workouts";
import { GluestackUIProvider, Box, Text, HStack, Button, Icon, useToast, Toast, ToastTitle, ToastDescription, VStack } from "@gluestack-ui/themed";
import { Feather } from "@expo/vector-icons";
import { config } from "./gluestack-ui.config";
import { StatusBar } from "react-native";
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBarProps,
} from "@react-navigation/material-top-tabs";
import { useElectric } from "./src/electric";
import { pullAllSnapshots } from "./src/db/sync/pull";

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

// Renders a top spacer equal to the safe area inset to ensure the status bar area is visible consistently
const TopInsetSpacer = () => {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top, backgroundColor: "#1E2028" }} />;
};

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
  Settings: undefined;
  Calendar: undefined;
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
  const { db, live } = useElectric();
  const toast = useToast();
  return (
    <Box bg="#1E2028" px="$3" width="$full" alignItems="center">
      <HStack alignItems="center" style={{ height: 25 }}>
        {/* Left refresh button to trigger a remote pull */}
        <Box style={{ width: 44 }} h="$full" alignItems="flex-start" justifyContent="center" pl="$1">
          <Button
            variant="link"
            p="$0"
            $pressed={{ opacity: 0.6 }}
            onPress={async () => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                const uid = user?.id;
                if (db && uid) {
                  await pullAllSnapshots(db, { userId: uid, log: true });
                  // Bump tables we know can change to refresh UI; conservative list
                  live.bump(['splits', 'split_day_assignments', 'split_exercises', 'workout_sessions', 'workout_exercises', 'workout_sets']);
                  toast.show({
                    placement: 'top',
                    render: ({ id }) => (
                      <Toast nativeID={id} action="success" variant="accent">
                        <VStack space="xs">
                          <ToastTitle>Sync complete</ToastTitle>
                          <ToastDescription>Latest data pulled from server</ToastDescription>
                        </VStack>
                      </Toast>
                    ),
                  });
                }
              } catch (e) {
                toast.show({
                  placement: 'top',
                  render: ({ id }) => (
                    <Toast nativeID={id} action="error" variant="accent">
                      <VStack space="xs">
                        <ToastTitle>Sync failed</ToastTitle>
                        <ToastDescription>Could not pull latest data</ToastDescription>
                      </VStack>
                    </Toast>
                  ),
                });
              }
            }}
          >
            {/* @ts-ignore: gluestack Icon typing doesn't include `name` */}
            <Icon as={Feather as any} name="refresh-ccw" color="$white" />
          </Button>
        </Box>
        {/* Centered title */}
        <Box flex={1} alignItems="center" justifyContent="center" h="$full">
          <Text color="white" fontSize="$xl" fontWeight="bold">
            {title}
          </Text>
        </Box>
        {/* Right settings button */}
        <Box style={{ width: 44 }} alignItems="flex-end" h="$full" justifyContent="center">
          <Pressable
            onPress={() => {
              // Navigate to Settings screen
              try {
                // use ref to navigate from header
                (navigationRef as any)?.current?.navigate?.('Settings');
              } catch {}
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ justifyContent: 'center', alignItems: 'center', height: '100%', width: 44, opacity: pressed ? 0.6 : 1 })}
          >
            {/* @ts-ignore gluestack Icon typing doesn't include `name` */}
            <Icon as={Feather as any} name="settings" color="$white" />
          </Pressable>
        </Box>
      </HStack>
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
          {/* Settings screen (standard push) */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          {/* Calendar screen for logging previous workouts */}
          <Stack.Screen name="Calendar" component={CalendarScreen} />
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
  // Track initial auth resolution to avoid flashing Login when a user exists
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        // Defer to next tick to avoid scheduling updates during insertion effects
        setTimeout(() => { if (mounted) setUser(user); }, 0);
      } catch {}
      finally {
        if (mounted) setAuthChecking(false);
      }
    };
    const t = setTimeout(fetchUser, 0);

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;
      setTimeout(() => { if (mounted) setUser(session?.user ?? null); }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(t);
      (authListener as any)?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GluestackUIProvider config={config}>
      <ElectricProvider>
        <WorkoutProvider>
                <OverlayProvider>
                <TopInsetSpacer />
                <SafeAreaView
                  style={{ flex: 1, backgroundColor: "#121213ff" }}
                  edges={["left", "right"]}
                >
                  <StatusBar barStyle="light-content" backgroundColor="#1E2028" />
                  <NavigationContainer ref={navigationRef}>
                    <DismissKeyboardWrapper>
                      {authChecking ? (
                        <LoadingSplash />
                      ) : user ? (
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
  const { sessionSummary, hideSessionSummary, workoutSummary, hideWorkoutSummary } = useOverlay();
  return (
    <>
      {!!sessionSummary && (
        <SessionPreviewModal
          selectedDate={sessionSummary.selectedDate}
          scheduledSplit={sessionSummary.scheduledSplit}
          onClose={hideSessionSummary}
          onStartWorkout={sessionSummary.onStartWorkout}
        />
      )}
      {!!workoutSummary && (
        <WorkoutSummaryModal
          sessionName={workoutSummary.sessionName}
          note={workoutSummary.note}
          durationMin={workoutSummary.durationMin}
          totalVolumeKg={workoutSummary.totalVolumeKg}
          startedAtMs={workoutSummary.startedAtMs}
          startedAtISO={workoutSummary.startedAtISO}
          exercises={workoutSummary.exercises}
          onClose={hideWorkoutSummary}
        />
      )}
    </>
  );
};

// Simple centered loading splash shown during initial auth resolution
const LoadingSplash = () => {
  return (
    <Box flex={1} bg="#1E2028" alignItems="center" justifyContent="center">
      <VStack space="md" alignItems="center">
        <Text color="$textLight50" fontSize="$6xl" fontWeight="$bold">
          TIGER
        </Text>
        <Text color="$textLight400" fontSize="$lg">
          Loading user…
        </Text>
      </VStack>
    </Box>
  );
};
