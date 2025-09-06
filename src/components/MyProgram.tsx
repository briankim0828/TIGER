import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  HStack,
  Text,
  VStack,
  Pressable,
} from "@gluestack-ui/themed";
import { Icon } from "@gluestack-ui/themed";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { AntDesign } from "@expo/vector-icons";
import { WEEKDAYS, WeekDay } from "../types/base";
import { ProgramSplit, ProgramEditMode } from "../types/ui";

// Helper function to get abbreviated day names
const getAbbreviatedDay = (day: WeekDay): string => {
  return day.slice(0, 3);
};

// Get first letter of text
const getFirstLetter = (text: string) => {
  return text.charAt(0).toUpperCase();
};

// --- Sub-Components ---
const WeekdayItem = React.memo(
  ({
    day,
    splits = [],
    isSelected,
    onPress,
    isEditing,
    index,
    onMeasure,
  }: {
    day: WeekDay;
    splits: ProgramSplit[];
    isSelected: boolean;
    onPress: () => void;
    isEditing: boolean;
    index: number;
    onMeasure: (index: number, x: number, width: number) => void;
  }) => {
    const daySplits = useMemo(() => splits.filter((split) => split.days.includes(day)), [splits, day]);
    const color = useMemo(() => daySplits.length > 0 ? daySplits[0].color || "#3A3E48" : "#3A3E48", [daySplits]);
    const onLayout = (e: any) => {
      const { x, width } = e.nativeEvent.layout;
      onMeasure(index, x, width);
    };

    return (
      <Pressable 
        onPress={onPress} 
        style={{ flex: 1, marginHorizontal: 2 }}
        onLayout={onLayout}
      >
        <VStack space="xs" alignItems="center">
          <Text
            color={isSelected ? "#6B8EF2" : "#A1A1AA"}
            style={{ fontSize: 12 }}
            fontWeight="$bold"
          >
            {getAbbreviatedDay(day)}
          </Text>
          <Box
            bg="#2A2E38"
            p="$2"
            borderRadius="$lg"
            style={{ width: '100%', height: 60 }}
            justifyContent="center"
            alignItems="center"
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute"
              style={{
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 8,
                borderWidth: isSelected ? 2 : 0,
                borderColor: "#6B8EF2",
              }}
              zIndex={2}
              pointerEvents="none"
            />
            <Box
              position="absolute"
              style={{
                top: 0,
                left: 0,
                right: 0,
                height: 8,
                backgroundColor: color,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
              zIndex={1}
              pointerEvents="none"
            />
            {daySplits.length > 0 ? (
              <Text color="white" style={{ fontSize: 16 }} fontWeight="$bold" textAlign="center">
                {getFirstLetter(daySplits[0].name)}
              </Text>
            ) : (
              <>
                {/* @ts-ignore gluestack Icon typing doesn't include `name` but runtime is fine */}
                <Icon as={AntDesign as any} name="plus" color="white" size="lg" />
              </>
            )}
          </Box>
          {/* Arrow space handled globally below */}
        </VStack>
      </Pressable>
    );
  }
);

// --- Main Component ---

interface MyProgramProps {
  splits: ProgramSplit[];
  editMode: ProgramEditMode;
  selectedDay: WeekDay | null;
  onDaySelect: (day: WeekDay) => void;
}

const MyProgram: React.FC<MyProgramProps> = ({
  splits,
  editMode,
  selectedDay,
  onDaySelect,
}) => {
  // Measure day cells to position the single animated arrow
  const centersRef = useRef<number[]>(Array(WEEKDAYS.length).fill(0));
  const rowWidthRef = useRef<number>(0);

  const arrowX = useSharedValue(0);
  const arrowY = useSharedValue(-16); // hidden above by default (more distance)
  const arrowOpacity = useSharedValue(0);
  const prevModeRef = useRef<ProgramEditMode>("none");
  const prevSelectedRef = useRef<WeekDay | null>(null);
  const pendingShowIndexRef = useRef<number | null>(null);
  const [showArrow, setShowArrow] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMeasure = (index: number, x: number, width: number) => {
    const center = x + width / 2;
    centersRef.current[index] = center;
    // If this is the selected day and we're in program mode, sync arrowX immediately
    if (editMode === "program" && selectedDay && WEEKDAYS.indexOf(selectedDay) === index) {
      const clamped = Math.max(0, Math.min(center, rowWidthRef.current));
      arrowX.value = clamped;
      // If we were waiting for this measurement to show, slide down now
      if (pendingShowIndexRef.current === index) {
        arrowOpacity.value = 1;
        arrowY.value = withTiming(0, { duration: 200 });
        pendingShowIndexRef.current = null;
      }
    }
  };

  const onRowLayout = (e: any) => {
    rowWidthRef.current = e.nativeEvent.layout.width;
  };

  // Animate arrow based on mode/selection
  useEffect(() => {
    const idx = selectedDay ? WEEKDAYS.indexOf(selectedDay) : -1;
    const center = idx >= 0 ? centersRef.current[idx] : 0;
    const clamped = Math.max(0, Math.min(center, rowWidthRef.current));

    const prevMode = prevModeRef.current;
    const prevSelected = prevSelectedRef.current;

    if (editMode === "program" && idx >= 0) {
      // If just entered program mode, snap to target X before sliding down
      if (prevMode !== "program") {
        // Cancel any pending hide
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        setShowArrow(true);
  arrowOpacity.value = 0;
  arrowY.value = -16;
        arrowX.value = clamped; // try to snap immediately
        if (!center || center === 0) {
          // Wait for measurement before showing
          pendingShowIndexRef.current = idx;
          arrowY.value = -16; // keep hidden until measured
        } else {
          // Slide down into view when we have a valid center
          arrowOpacity.value = 1;
          arrowY.value = withTiming(0, { duration: 200 });
        }
      } else if (prevSelected !== selectedDay) {
        // Already in program mode and day changed -> animate horizontally
        arrowX.value = withTiming(clamped, { duration: 200 });
        // Arrow already visible; no vertical change needed
      } else {
        // Same day re-selected while in program mode; ensure visible with no jump
        arrowX.value = clamped;
        arrowOpacity.value = 1;
        arrowY.value = withTiming(0, { duration: 200 });
      }
    } else {
      // Slide up out of view on exit
      if (showArrow) {
  arrowY.value = withTiming(-16, { duration: 200 });
  arrowOpacity.value = withTiming(0, { duration: 200 });
        // Keep visible during slide-up, then hide
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setShowArrow(false);
          hideTimerRef.current = null;
        }, 210);
      }
      pendingShowIndexRef.current = null;
    }

    // Update refs for next cycle
    prevModeRef.current = editMode;
    prevSelectedRef.current = selectedDay;
  }, [editMode, selectedDay]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [
      { translateX: arrowX.value },
      { translateY: arrowY.value },
    ],
  }));

  return (
    <VStack space="md" style={{ width: '100%' }}>
      <HStack justifyContent="space-between" alignItems="center" style={{ width: '100%' }} pointerEvents="box-none">
        <Text color="white" style={{ fontSize: 24 }} fontWeight="$bold">
          My Program
        </Text>
      </HStack>

      {/* Weekday Selector + Arrow, no vertical gap between them */}
      <VStack>
  <HStack justifyContent="space-between" style={{ marginHorizontal: -2, position: 'relative', zIndex: 2 }} onLayout={onRowLayout}>
          {WEEKDAYS.map((day, index) => (
            <WeekdayItem
              key={day}
              day={day}
              splits={splits} // Always shows saved state
              isSelected={selectedDay === day}
              onPress={() => onDaySelect(day)}
              isEditing={editMode === "program"}
              index={index}
              onMeasure={onMeasure}
            />
          ))}
        </HStack>

        {/* Single animated arrow row */}
  <Box style={{ height: 10, position: 'relative', marginHorizontal: -2, marginTop: 5, zIndex: 1 }}>
          {showArrow && (
            <Animated.View
              style={[
                arrowStyle,
                { position: 'absolute', left: 0, top: 0 },
              ]}
              pointerEvents="none"
            >
              {/* Offset icon by half width (approx 6px) to center under target */}
              <Box style={{ transform: [{ translateX: -6 }] }}>
                {/* @ts-ignore */}
                <Icon as={AntDesign as any} name="up" color="#6B8EF2" size="xs" />
              </Box>
            </Animated.View>
          )}
        </Box>
      </VStack>
    </VStack>
  );
};

export default MyProgram; 