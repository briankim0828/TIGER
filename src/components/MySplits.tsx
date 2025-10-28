import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Box,
  HStack,
  Text,
  Pressable,
  VStack,
  Icon,
  ButtonIcon,
} from "@gluestack-ui/themed";
import {
  TextInput,
  Platform,
  Keyboard,
} from "react-native";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Keyframe,
  Layout,
} from "react-native-reanimated";
import { Feather, Entypo } from "@expo/vector-icons";
import { WeekDay } from "../types/base";
import { ProgramSplit, ProgramEditMode } from "../types/ui";
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
  dragDisabled,
    selectedDay,
    onPress,
  onNameEdit,
    onColorSelect,
    onDelete,
    onFocusScroll,
  }: {
  split: ProgramSplit;
  editMode: ProgramEditMode;
    isEditingThisSplit: boolean;
  dragDisabled: boolean;
    selectedDay: WeekDay | null;
    onPress: () => void;
  onNameEdit: (text: string) => void;
    onColorSelect: (color: string) => void;
    onDelete: () => void;
    onFocusScroll: (y: number, height: number) => void;
  }) => {
  const borderColor = useSharedValue("transparent");
  const pressBorderColor = useSharedValue("transparent");
    const arrowOpacity = useSharedValue(1);
    const arrowRotation = useSharedValue(0);
    const menuOpacity = useSharedValue(0);
    const menuTranslateX = useSharedValue(20);
    const menuWidth = useSharedValue(0);
    const contentShiftX = useSharedValue(0);
  const countTranslateX = useSharedValue(0);
    const [inputValue, setInputValue] = useState(split.name);
    const textInputRef = useRef<TextInput>(null);

    useEffect(() => {
      setInputValue(split.name);
    }, [split.name]);

    useEffect(() => {
      const inProgram = editMode === 'program' && !isEditingThisSplit;
      const hasSelectedDay = selectedDay !== null;
      const isAssignedToSelected = hasSelectedDay && split.days.includes(selectedDay as WeekDay);
      const target = inProgram && hasSelectedDay
        ? (isAssignedToSelected ? "#EF4444" : "#6B8EF2")
        : "transparent";
      borderColor.value = withTiming(target, { duration: 200 });
    }, [selectedDay, isEditingThisSplit, editMode, split.days]);

    const prevShowMenuRef = useRef<boolean>(false);
    useEffect(() => {
      const isSplitsModeActive = editMode === "splits";
      const showMenu = isSplitsModeActive && !isEditingThisSplit;
      const showArrow = editMode !== "program" && !isEditingThisSplit;

      const targetMenuWidth = 25;
      const gapReduction = 18;
      const targetContentShift = showMenu ? -targetMenuWidth + gapReduction : 0;

      const wasShowingMenu = prevShowMenuRef.current;

  const D = 200; // keep all animations in sync
  // Arrow visibility/rotation always animates
  arrowOpacity.value = withTiming(showArrow ? 1 : 0, { duration: D });
  arrowRotation.value = withTiming(isSplitsModeActive ? 90 : 0, { duration: D });

  // Content shifts left when menu appears and right when it disappears
  contentShiftX.value = withTiming(targetContentShift, { duration: D });

  // Exercise count micro-shift when arrow hides in program mode
  const countShift = 20;
  countTranslateX.value = withTiming(showArrow ? 0 : countShift, { duration: D });

      if (showMenu && !wasShowingMenu) {
        // Enter: animate width, slide, and opacity together
        menuWidth.value = withTiming(targetMenuWidth, { duration: 200 });
        menuTranslateX.value = withTiming(0, { duration: 200 }); // from 20 -> 0
        menuOpacity.value = withTiming(dragDisabled ? 0.3 : 1, { duration: 200 });
      } else if (!showMenu && wasShowingMenu) {
        // Exit: animate all together (no delayed width collapse)
        menuTranslateX.value = withTiming(20, { duration: 200 }); // 0 -> 20
        menuOpacity.value = withTiming(0, { duration: 200 });
        menuWidth.value = withTiming(0, { duration: 200 });
      } else {
        // State unchanged: keep properties consistent (also updates opacity if dragDisabled changes)
        if (showMenu) {
          menuWidth.value = withTiming(targetMenuWidth, { duration: 0 });
          menuTranslateX.value = withTiming(0, { duration: 0 });
          menuOpacity.value = withTiming(dragDisabled ? 0.3 : 1, { duration: 200 });
        } else {
          menuOpacity.value = withTiming(0, { duration: 200 });
          menuTranslateX.value = withTiming(20, { duration: 0 });
          menuWidth.value = withTiming(0, { duration: 0 });
        }
      }

      prevShowMenuRef.current = showMenu;
    }, [editMode, isEditingThisSplit, dragDisabled]);

    const borderAnimatedStyle = useAnimatedStyle(() => {
      const color = isEditingThisSplit ? 'white' : borderColor.value;
      const width = isEditingThisSplit
        ? 1
        : (selectedDay !== null && !isEditingThisSplit && editMode === 'program' ? 3 : 0);
      return {
        borderColor: color,
        borderWidth: color === 'transparent' ? 0 : width,
      };
    });

    const pressBorderAnimatedStyle = useAnimatedStyle(() => ({
      borderColor: pressBorderColor.value,
      borderWidth: pressBorderColor.value === 'transparent' ? 0 : 1,
    }));
    const arrowAnimatedStyle = useAnimatedStyle(() => ({ opacity: arrowOpacity.value, transform: [{ rotateZ: `${arrowRotation.value}deg` }] }));
    const menuAnimatedStyle = useAnimatedStyle(() => ({ width: menuWidth.value, opacity: menuOpacity.value, transform: [{ translateX: menuTranslateX.value }] }));
    const contentShiftAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: contentShiftX.value }] }));
  const countAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: countTranslateX.value }] }));

    const handlePressIn = () => {
      if (!isEditingThisSplit && editMode !== 'program') { // Don't show press effect in program mode or when editing
        pressBorderColor.value = withTiming("#6B8EF2", { duration: 150 });
      }
    };

    const handlePressOut = () => {
      if (!isEditingThisSplit && editMode !== 'program') {
        pressBorderColor.value = withTiming("transparent", { duration: 150 });
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
        style={{
          // backgroundColor: "#2A2E38", 
          backgroundColor: "#12141A", 
          padding: 12,
          paddingLeft: 24,
          borderRadius: 12,
          position: "relative",
        }}
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
              borderRadius: 12, zIndex: 3,
            },
            pressBorderAnimatedStyle,
          ]}
          pointerEvents="none"
        />
        {/* Color bar */}
        <Box
          position="absolute"
          style={{
            top: 0,
            left: 0,
            bottom: 0,
            width: 12,
            backgroundColor: split.color || "#3A3E48",
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            zIndex: 1,
          }}
          pointerEvents="none"
        />

        {/* Main Content */}
        <HStack justifyContent="space-between" alignItems="center">
          {isEditingThisSplit ? (
            // -- Editing View --
            <HStack style={{ flex: 1, gap: 8, alignItems: "center" }}>
              <Box style={{ flex: 1 }}>
                <TextInput
                  ref={textInputRef}
                  value={inputValue}
                  onChangeText={handleTextChange}
                  placeholder="Enter split name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  style={{ color: "white", fontSize: calculatedFontSize, paddingVertical: Platform.OS === 'ios' ? 0 : 4 }} // Adjust padding
                  // Do not auto-focus; only open keyboard when user taps the text input explicitly
                  autoFocus={false}
                  onFocus={measureInput} // Measure on focus
                  onSubmitEditing={Keyboard.dismiss} // Optional: dismiss keyboard on submit
                  blurOnSubmit={false} // Keep keyboard potentially for next interaction
                />
              </Box>
              {/* Show exercise count while editing */}
              <Text style={{ color: "#A1A1AA", fontSize: 14 }}>
                {split.exerciseCount} exercises
              </Text>
              <Pressable
                onPress={onDelete}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {/* @ts-ignore gluestack Icon typing doesn't include `name` but runtime is fine */}
                <Icon as={Feather as any} name="x" color="#EF4444" size="md" />
              </Pressable>
            </HStack>
          ) : (
            // -- Display View --
            [
              (
                <Text
                  key="name"
                  color="white"
                  style={{ fontSize: 18, fontWeight: "bold", flex: 1 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {split.name}
                </Text>
              ),
              (
                <HStack key="right" alignItems="center"> {/* Use style for spacing with animations */}
                  <Animated.View style={contentShiftAnimatedStyle}>
                    <HStack style={{ gap: 12, alignItems: "center" }}>
                      <Animated.View style={countAnimatedStyle}>
                        <Text color="white" style={{ fontSize: 14 }}>
                          {split.exerciseCount} exercises
                        </Text>
                      </Animated.View>
                      {/* Arrow (shown in None or Splits mode, hidden in Program mode) */}
                      <Animated.View style={arrowAnimatedStyle}>
                        {/* @ts-ignore */}
                        <Icon as={Feather as any} name="chevron-right" color="#A1A1AA" size="sm" />
                      </Animated.View>
                    </HStack>
                  </Animated.View>
                  {/* Menu Icon (shown only in Splits mode when not editing this item) */}
                  <Animated.View style={[menuAnimatedStyle, { justifyContent: 'center', alignItems: 'center' }]} >
                      {/* @ts-ignore */}
                      <Icon as={Entypo as any} name="menu" color="#A1A1AA" size="md" />
                  </Animated.View>
                </HStack>
              )
            ]
          )}
        </HStack>

        {/* Color Palette (shown only when editing this split) */}
        {isEditingThisSplit && (
          <HStack style={{ gap: 8, marginTop: 8, justifyContent: "space-between" }}>
            {COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => onColorSelect(color)}
                style={{ flex: 1 }}
                hitSlop={4}
              >
                <Box
                  style={{
                    backgroundColor: color,
                    height: 24,
                    borderRadius: 6,
                    borderWidth: split.color === color ? 2 : 0,
                    borderColor: "white"
                  }}
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
  splits: ProgramSplit[];
  editedSplits: ProgramSplit[] | null; // Use this when in splits edit mode
  editMode: ProgramEditMode;
  selectedDay: WeekDay | null;
  editingSplitId: string | null;
  onSplitPress: (split: ProgramSplit) => void;
  onNameEdit: (id: string, name: string) => void;
  onColorSelect: (id: string, color: string) => void;
  onDeleteSplit: (id: string) => void;
  onAddSplit: () => void;
  onToggleEditMode: () => void;
  onFocusScroll: (y: number, height: number) => void;
  // Persist new order to DB (index is 1-based order position)
  onPersistOrder?: (orderedIds: string[]) => void;
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
  onPersistOrder,
}) => {
  // Guard against undefined/null inputs during first render
  if (!splits) return null;

  const displaySplits = useMemo(() => editMode === 'splits' ? (editedSplits ?? splits) : splits, [editMode, editedSplits, splits]);
  const canAddMoreSplits = useMemo(() => (displaySplits?.length ?? 0) < MAX_SPLITS, [displaySplits]);

  // Local mirror of data to allow smooth post-drop settling without waiting for parent refresh
  const [listData, setListData] = useState<ProgramSplit[]>(displaySplits ?? []);
  useEffect(() => {
    setListData(displaySplits ?? []);
  }, [displaySplits]);

  // Track dynamic content height so the list reserves correct vertical space as items expand/collapse
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Add Split button press feedback
  const addBtnOpacity = useSharedValue(1);
  const addBtnAnimatedStyle = useAnimatedStyle(() => ({ opacity: addBtnOpacity.value }));

  return (
    <VStack style={{ gap: 16, width: "100%", overflow: 'visible' }}>
      {/* Splits List Section */}
      <VStack style={{ gap: 16, overflow: 'visible' }}> 
  <HStack justifyContent="space-between" alignItems="center" pointerEvents="box-none">
          <Text color="white" style={{ fontSize: 20, fontWeight: "bold" }}>
            Splits
          </Text>
          {/* Show Splits Edit/Done only when not in Program Edit */}
          {editMode !== "program" && (
            <Pressable onPress={onToggleEditMode}>
              <Box style={{ width: 80, alignItems: "flex-end" }}>
                <Text color="#6B8EF2" style={{ fontSize: 14, fontWeight: "bold" }}>
                  {editMode === "splits" ? "Done" : "Edit"}
                </Text>
              </Box>
            </Pressable>
          )}
        </HStack>

        <VStack style={{ gap: 8, overflow: 'visible' }}>
          <DraggableFlatList
            data={listData}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <Box style={{ height: 8 }} />}
            style={{ overflow: 'visible' }}
            containerStyle={contentHeight ? { height: contentHeight } : undefined}
            scrollEnabled={false}
            autoscrollSpeed={150}
            activationDistance={8}
            dragItemOverflow={false}
            // Keep container height in sync with content as rows expand/collapse (e.g., color palette)
            onContentSizeChange={(w, h) => {
              if (typeof h === 'number') setContentHeight(h);
            }}
            
            onDragEnd={({ data }) => {
              const reordered = data as ProgramSplit[];
              // Update local data immediately for smooth animation completion
              setListData(reordered);
              onPersistOrder && onPersistOrder(reordered.map((s) => s.id));
            }}
            ListEmptyComponent={
              editMode !== 'splits' ? (
                <Text
                  color="#A1A1AA"
                  style={{ fontSize: 14, textAlign: 'center', paddingVertical: 16 }}
                >
                  No splits defined yet. Tap 'Edit' to add one.
                </Text>
              ) : null
            }
            renderItem={({ item, drag, isActive }: RenderItemParams<ProgramSplit>) => {
              const isThisEditing = editMode === 'splits' && editingSplitId === item.id;
              return (
                <ScaleDecorator activeScale={1.03}>
                  <SplitItem
                    key={item.id}
                    split={item}
                    editMode={editMode}
                    isEditingThisSplit={isThisEditing}
                    dragDisabled={isThisEditing}
                    selectedDay={selectedDay}
                    onPress={() => onSplitPress(item)}
                    onNameEdit={(text: string) => onNameEdit(item.id, text)}
                    onColorSelect={(color: string) => onColorSelect(item.id, color)}
                    onDelete={() => onDeleteSplit(item.id)}
                    onFocusScroll={onFocusScroll}
                    />
                  {/* Drag handle overlay on the menu icon area (only active in splits edit mode) */}
                  {editMode === 'splits' && !isThisEditing && (
                    <Pressable
                      onLongPress={drag}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 }}
                      hitSlop={8}
                      pointerEvents="auto"
                    />
                  )}
                </ScaleDecorator>
              );
            }}
          />

          {/* Add Split Button (only in splits edit mode) */}
          {editMode === "splits" && (
            <Animated.View
              entering={new Keyframe({
                0: { opacity: 0, transform: [{ translateY: -10 }] },
                100: { opacity: 1, transform: [{ translateY: 0 }] },
              }).duration(200)}
              exiting={new Keyframe({
                0: { opacity: 1, transform: [{ translateY: 0 }] },
                100: { opacity: 0, transform: [{ translateY: -10 }] },
              }).duration(200)}
              style={addBtnAnimatedStyle}
            >
              <Pressable
                onPress={onAddSplit}
                onPressIn={() => { addBtnOpacity.value = withTiming(0.7, { duration: 80 }); }}
                onPressOut={() => { addBtnOpacity.value = withTiming(1, { duration: 120 }); }}
                style={{
                  backgroundColor: "#1E2028",
                  padding: 8,
                  marginTop: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: canAddMoreSplits ? "#6B8EF2" : "#4B5563",
                  borderStyle: "dashed",
                  opacity: canAddMoreSplits ? 1 : 0.5,
                }}
                disabled={!canAddMoreSplits}
              >
                <HStack justifyContent="center" alignItems="center" style={{ gap: 8 }}>
                  {/* @ts-ignore */}
                  <Icon as={Feather as any} name="plus" color={canAddMoreSplits ? "#6B8EF2" : "#A1A1AA"} size="sm" />
                  <Text 
                    color={canAddMoreSplits ? "#6B8EF2" : "#A1A1AA"} 
                    style={{ fontSize: 14, fontWeight: "bold" }}
                  >
                    {canAddMoreSplits ? "Add Split" : `Maximum ${MAX_SPLITS} splits reached`}
                  </Text>
                </HStack>
              </Pressable>
            </Animated.View>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
};

export default MySplits; 