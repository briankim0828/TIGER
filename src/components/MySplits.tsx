import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Box,
  HStack,
  Text,
  Pressable,
  VStack,
  Icon,
  IconButton,
} from "native-base";
import {
  TextInput,
  Platform,
  Keyboard,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { AntDesign, Entypo } from "@expo/vector-icons";
import { Split, WeekDay } from "../types";
import { parseFontSize } from "../../helper/fontsize";

// Constants
const COLORS = [
  "#1254a1",
  "#00C2C7",
  "#1d7322",
  "#b0b02a",
  "#db7e2c",
  "#D72638",
];
const MAX_SPLITS = 7;

// --- Sub-Components ---

const SplitItem = React.memo(
  ({
    split,
    editMode,
    isEditingThisSplit,
    selectedDay,
    onPress,
    onNameEdit,
    onColorSelect,
    onDelete,
    onFocusScroll,
  }: {
    split: Split;
    editMode: "none" | "program" | "splits";
    isEditingThisSplit: boolean;
    selectedDay: WeekDay | null;
    onPress: () => void;
    onNameEdit: (text: string) => void;
    onColorSelect: (color: string) => void;
    onDelete: () => void;
    onFocusScroll: (y: number, height: number) => void;
  }) => {
    const borderColor = useSharedValue("#3A3E48");
    const pressBorderColor = useSharedValue("#3A3E48");
    const arrowOpacity = useSharedValue(1);
    const arrowRotation = useSharedValue(0);
    const menuOpacity = useSharedValue(0);
    const menuTranslateX = useSharedValue(20);
    const menuWidth = useSharedValue(0);
    const contentShiftX = useSharedValue(0);
    const [inputValue, setInputValue] = useState(split.name);
    const textInputRef = useRef<TextInput>(null);

    useEffect(() => {
      setInputValue(split.name);
    }, [split.name]);

    useEffect(() => {
      borderColor.value = withTiming(
        selectedDay !== null && !isEditingThisSplit && editMode === 'program' ? "#6B8EF2" : "#3A3E48",
        { duration: 200 }
      );
    }, [selectedDay, isEditingThisSplit, editMode]);

    useEffect(() => {
      const isSplitsModeActive = editMode === "splits";
      const showMenu = isSplitsModeActive && !isEditingThisSplit;
      const showArrow = editMode !== "program" && !isEditingThisSplit;

      const targetMenuWidth = showMenu ? 25 : 0;
      const gapReduction = 18;
      const targetContentShift = showMenu ? -targetMenuWidth + gapReduction : 0;

      menuOpacity.value = withTiming(showMenu ? 1 : 0, { duration: 200 });
      menuTranslateX.value = withTiming(showMenu ? 0 : 20, { duration: 200 });
      menuWidth.value = withTiming(targetMenuWidth, { duration: 200 });

      arrowOpacity.value = withTiming(showArrow ? 1 : 0, { duration: 200 });
      arrowRotation.value = withTiming(isSplitsModeActive ? 90 : 0, { duration: 200 });

      contentShiftX.value = withTiming(targetContentShift, { duration: 200 });
    }, [editMode, isEditingThisSplit]);

    const borderAnimatedStyle = useAnimatedStyle(() => ({
      borderColor: isEditingThisSplit ? "white" : borderColor.value,
      borderWidth: isEditingThisSplit ? 1 : (selectedDay !== null && !isEditingThisSplit && editMode === 'program' ? 2 : 0),
    }));

    const pressBorderAnimatedStyle = useAnimatedStyle(() => ({ borderColor: pressBorderColor.value }));
    const arrowAnimatedStyle = useAnimatedStyle(() => ({ opacity: arrowOpacity.value, transform: [{ rotateZ: `${arrowRotation.value}deg` }] }));
    const menuAnimatedStyle = useAnimatedStyle(() => ({ width: menuWidth.value, opacity: menuOpacity.value, transform: [{ translateX: menuTranslateX.value }] }));
    const contentShiftAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: contentShiftX.value }] }));

    const handlePressIn = () => {
      if (!isEditingThisSplit && editMode !== 'program') { // Don't show press effect in program mode or when editing
        pressBorderColor.value = withTiming("#6B8EF2", { duration: 150 });
      }
    };

    const handlePressOut = () => {
      if (!isEditingThisSplit && editMode !== 'program') {
        pressBorderColor.value = withTiming("#3A3E48", { duration: 150 });
      }
    };

    const handleTextChange = (text: string) => {
      setInputValue(text);
      onNameEdit(text);
    };

    const calculatedFontSize = useMemo(() => parseFontSize("lg"), []);

    // Measure input position for scrolling
    const measureInput = () => {
      if (textInputRef.current) {
        textInputRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
           // Note: measureInWindow gives coordinates relative to the window,
           // not the ScrollView. This might need adjustment depending on where
           // the ScrollView starts in the window. For now, we pass `y`.
          onFocusScroll(y, height);
        });
      }
    }

    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        bg="#2A2E38"
        p={3}
        pl={6} // Keep padding for the color bar space
        borderRadius={12}
        position="relative"
      >
        {/* Border for selection/edit state */}
        <Animated.View
          style={[
            {
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 12, zIndex: 2,
            },
            borderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        {/* Border for press effect */}
        <Animated.View
          style={[
            {
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 12, borderWidth: 1, zIndex: 3,
            },
            pressBorderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        {/* Color bar */}
        <Box
          position="absolute" top={0} left={0} bottom={0} w="3"
          bg={split.color || "#3A3E48"}
          borderTopLeftRadius={12}
          borderBottomLeftRadius={12}
          zIndex={1}
          pointerEvents="none"
        />

        {/* Main Content */}
        <HStack justifyContent="space-between" alignItems="center">
          {isEditingThisSplit ? (
            // -- Editing View --
            <HStack flex={1} space={2} alignItems="center">
              <Box flex={1}>
                <TextInput
                  ref={textInputRef}
                  value={inputValue}
                  onChangeText={handleTextChange}
                  placeholder="Enter split name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  style={{ color: "white", fontSize: calculatedFontSize, paddingVertical: Platform.OS === 'ios' ? 0 : 4 }} // Adjust padding
                  autoFocus={true}
                  onFocus={measureInput} // Measure on focus
                  onSubmitEditing={Keyboard.dismiss} // Optional: dismiss keyboard on submit
                  blurOnSubmit={false} // Keep keyboard potentially for next interaction
                />
              </Box>
              {/* Show exercise count while editing */}
              <Text color="gray.400" fontSize="sm">
                {split.exercises.length} exercises
              </Text>
              <IconButton
                icon={<Icon as={AntDesign} name="close" color="red.500" size="md" />}
                onPress={onDelete}
                variant="ghost"
                size="sm"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase touch area
              />
            </HStack>
          ) : (
            // -- Display View --
            <>
              <Text color="white" fontSize="lg" fontWeight="bold" flex={1} numberOfLines={1} ellipsizeMode="tail">
                {split.name}
              </Text>
              <HStack alignItems="center" space={0}> {/* Use space={0} to control spacing with animations */}
                <Animated.View style={contentShiftAnimatedStyle}>
                  <HStack space={3} alignItems="center">
                    <Text color="white" fontSize="sm">
                      {split.exercises.length} exercises
                    </Text>
                    {/* Arrow (shown in None or Splits mode, hidden in Program mode) */}
                    <Animated.View style={arrowAnimatedStyle}>
                      <Icon as={AntDesign} name="right" color="gray.400" size="sm" />
                    </Animated.View>
                  </HStack>
                </Animated.View>
                {/* Menu Icon (shown only in Splits mode when not editing this item) */}
                <Animated.View style={[menuAnimatedStyle, { justifyContent: 'center', alignItems: 'center' }]} >
                    <Icon as={Entypo} name="menu" color="gray.400" size="md" />
                </Animated.View>
              </HStack>
            </>
          )}
        </HStack>

        {/* Color Palette (shown only when editing this split) */}
        {isEditingThisSplit && (
          <HStack space={2} mt={2} justifyContent="space-between">
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => onColorSelect(color)}
                flex={1}
                hitSlop={4}
              >
                <Box
                  bg={color}
                  h="6"
                  borderRadius="md"
                  borderWidth={split.color === color ? 2 : 0}
                  borderColor="white"
                />
              </Pressable>
            ))}
          </HStack>
        )}
      </Pressable>
    );
  }
);


// --- Main Component ---

interface MySplitsProps {
  splits: Split[];
  editedSplits: Split[] | null; // Use this when in splits edit mode
  editMode: "none" | "program" | "splits";
  selectedDay: WeekDay | null;
  editingSplitId: string | null;
  onSplitPress: (split: Split) => void;
  onNameEdit: (id: string, name: string) => void;
  onColorSelect: (id: string, color: string) => void;
  onDeleteSplit: (id: string) => void;
  onAddSplit: () => void;
  onToggleEditMode: () => void;
  onFocusScroll: (y: number, height: number) => void;
}

const MySplits: React.FC<MySplitsProps> = ({
  splits,
  editedSplits,
  editMode,
  selectedDay,
  editingSplitId,
  onSplitPress,
  onNameEdit,
  onColorSelect,
  onDeleteSplit,
  onAddSplit,
  onToggleEditMode,
  onFocusScroll,
}) => {

  const displaySplits = useMemo(() => editMode === 'splits' ? editedSplits : splits, [editMode, editedSplits, splits]);
  const canAddMoreSplits = useMemo(() => (displaySplits?.length ?? 0) < MAX_SPLITS, [displaySplits]);

  return (
    <VStack space={4} width="100%">
      {/* Splits List Section */}
      <VStack space={4}> 
        <HStack justifyContent="space-between" alignItems="center">
          <Text color="white" fontSize="xl" fontWeight="bold">
            My Splits
          </Text>
          {/* Show Splits Edit/Done only when not in Program Edit */}
          {editMode !== "program" && (
            <Pressable onPress={onToggleEditMode}>
              <Box w="20" alignItems="flex-end">
                <Text color="#6B8EF2" fontSize="14" fontWeight="bold">
                  {editMode === "splits" ? "Done" : "Edit"}
                </Text>
              </Box>
            </Pressable>
          )}
        </HStack>

        <VStack space={2}>
          {(displaySplits?.length === 0 && editMode !== 'splits') ? (
            <Text color="gray.400" fontSize="sm" textAlign="center" py={4}>
              No splits defined yet. Tap 'Edit' to add one.
            </Text>
          ) : (
            displaySplits?.map((split) => (
              <SplitItem
                key={split.id}
                split={split}
                editMode={editMode}
                isEditingThisSplit={editMode === "splits" && editingSplitId === split.id}
                selectedDay={selectedDay}
                onPress={() => onSplitPress(split)}
                onNameEdit={(text: string) => onNameEdit(split.id, text)}
                onColorSelect={(color: string) => onColorSelect(split.id, color)}
                onDelete={() => onDeleteSplit(split.id)}
                onFocusScroll={onFocusScroll}
              />
            ))
          )}

          {/* Add Split Button (only in splits edit mode) */}
          {editMode === "splits" && (
            <Pressable
              onPress={onAddSplit}
              bg="#1E2028" // Match theme background
              p={2}
              mt={2} // Add margin top
              borderRadius="md"
              borderWidth={1}
              borderColor={canAddMoreSplits ? "#6B8EF2" : "gray.600"}
              borderStyle="dashed"
              opacity={canAddMoreSplits ? 1 : 0.5}
              disabled={!canAddMoreSplits}
            >
              <HStack justifyContent="center" alignItems="center" space={2}>
                <Icon as={AntDesign} name="plus" color={canAddMoreSplits ? "#6B8EF2" : "gray.400"} size="sm" />
                <Text color={canAddMoreSplits ? "#6B8EF2" : "gray.400"} fontSize="sm" fontWeight="bold">
                  {canAddMoreSplits ? "Add Split" : `Maximum ${MAX_SPLITS} splits reached`}
                </Text>
              </HStack>
            </Pressable>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
};

export default MySplits; 