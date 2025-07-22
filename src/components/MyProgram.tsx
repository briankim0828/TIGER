import React, { useEffect, useMemo } from "react";
import {
  Box,
  HStack,
  Text,
  VStack,
  Pressable,
} from "@gluestack-ui/themed";
import { Icon } from "@gluestack-ui/themed";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { AntDesign } from "@expo/vector-icons";
import { Split, WEEKDAYS, WeekDay } from "../types";

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
  }: {
    day: WeekDay;
    splits: Split[];
    isSelected: boolean;
    onPress: () => void;
    isEditing: boolean;
  }) => {
    const daySplits = useMemo(() => splits.filter((split) => split.days.includes(day)), [splits, day]);
    const color = useMemo(() => daySplits.length > 0 ? daySplits[0].color || "#3A3E48" : "#3A3E48", [daySplits]);
    const dayIndex = useMemo(() => WEEKDAYS.indexOf(day), [day]);

    // Initialize with correct values - opacity 0 (invisible) and translateY 0 (no shift)
    const arrowOpacity = useSharedValue(isEditing ? 1 : 0);
    const arrowTranslateY = useSharedValue(0);

    useEffect(() => {
      if (isEditing) {
        // When entering edit mode, animate in with delay based on day position
        const delay = dayIndex * 50;
        arrowOpacity.value = withSequence(
          withDelay(delay + 100, withTiming(1, { duration: 200 }))
        );
        arrowTranslateY.value = withSequence(
          withDelay(delay + 100, withTiming(0, { duration: 200 }))
        );
      } else {
        // When exiting edit mode, immediately hide
        arrowOpacity.value = withTiming(0, { duration: 200 });
        // Keep position at 0 to avoid layout shift
        arrowTranslateY.value = 0;
      }
    }, [isEditing, dayIndex, arrowOpacity, arrowTranslateY]);

    const arrowAnimatedStyle = useAnimatedStyle(() => ({
      opacity: arrowOpacity.value,
      transform: [{ translateY: arrowTranslateY.value }],
    }));

    return (
      <Pressable 
        onPress={onPress} 
        style={{ flex: 1, marginHorizontal: 2 }}
        disabled={!isEditing}
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
              <Icon as={AntDesign} name="plus" color="white" size="lg" />
            )}
          </Box>
          {/* Show up arrow only if selected in edit mode */}
          <Animated.View 
            style={[
              arrowAnimatedStyle,
              { height: 15, justifyContent: 'center', alignItems: 'center' }
            ]}
          >
            <Icon
              as={AntDesign}
              name="up"
              color={isSelected ? "#6B8EF2" : "#A1A1AA"}
              size="xs"
            />
          </Animated.View>
        </VStack>
      </Pressable>
    );
  }
);

// --- Main Component ---

interface MyProgramProps {
  splits: Split[];
  editMode: "none" | "program" | "splits";
  selectedDay: WeekDay | null;
  onDaySelect: (day: WeekDay) => void;
  onToggleEditMode: () => void;
}

const MyProgram: React.FC<MyProgramProps> = ({
  splits,
  editMode,
  selectedDay,
  onDaySelect,
  onToggleEditMode,
}) => {
  return (
    <VStack space="md" style={{ width: '100%' }}>
      <HStack justifyContent="space-between" alignItems="center" style={{ width: '100%' }}>
        <Text color="white" style={{ fontSize: 24 }} fontWeight="$bold">
          My Program
        </Text>
        {/* Only show Edit button when not in Splits mode */}
        {editMode !== "splits" && (
          <Pressable onPress={onToggleEditMode}>
            <Box style={{ width: 80 }}>
              <Text
                color="#6B8EF2"
                style={{ fontSize: 14 }}
                fontWeight="$bold"
                textAlign="right"
              >
                {editMode === "program" ? "Done" : "Edit"}
              </Text>
            </Box>
          </Pressable>
        )}
      </HStack>

      {/* Weekday Selector (only interactive in program mode) */}
      <HStack justifyContent="space-between" style={{ marginHorizontal: -2 }}>
        {WEEKDAYS.map((day) => (
          <WeekdayItem
            key={day}
            day={day}
            splits={splits} // Always shows saved state
            isSelected={selectedDay === day}
            onPress={() => onDaySelect(day)}
            isEditing={editMode === "program"}
          />
        ))}
      </HStack>
    </VStack>
  );
};

export default MyProgram; 