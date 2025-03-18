import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';

interface CustomTextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  color?: string;
  fontSize?: string | number;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  numberOfLines?: number;
}

const CustomTextInput = ({
  value,
  onChangeText,
  color = 'white',
  fontSize = 16,
  placeholder,
  style,
  multiline = false,
  numberOfLines = 1,
  ...rest
}: CustomTextInputProps) => {
  // Convert fontSize from string format (like 'xl') to number
  const parseFontSize = (size: string | number): number => {
    if (typeof size === 'number') return size;
    
    switch (size) {
      case 'xs': return 12;
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 18;
      case 'xl': return 20;
      case '2xl': return 24;
      case '3xl': return 30;
      case '4xl': return 36;
      default: return 16;
    }
  };

  const calculatedFontSize = parseFontSize(fontSize);

  return (
    <View style={[styles.container, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.input,
          {
            color: color,
            fontSize: calculatedFontSize,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor="#A0A0A0"
        multiline={multiline}
        numberOfLines={numberOfLines}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#4A4A4A',
    borderRadius: 4,
    padding: 8,
    backgroundColor: 'transparent',
  },
  input: {
    padding: 0,
  },
});

export default CustomTextInput; 