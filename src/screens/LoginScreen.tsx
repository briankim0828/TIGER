import React, { useState } from "react";
import {
  Box,
  VStack,
  Button,
  ButtonText,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
  Center,
  Heading,
  Text,
} from "@gluestack-ui/themed";
import { supabase } from "../utils/supabaseClient";
import { StyleSheet, TextInput } from "react-native";
import { parseFontSize } from "../../helper/fontsize";
import { useNavigation } from "@react-navigation/native";

const LoginScreen = () => {
  const toast = useToast();
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  console.log("🚀 ~ LoginScreen ~ email:", email);

  const handleAuth = async () => {
    try {
      let result;
      if (isSignUp) {
        if (!displayName.trim()) {
          toast.show({
            placement: "top",
            render: ({ id }) => (
              <Toast nativeID={id} action="warning" variant="accent">
                <VStack space="xs">
                  <ToastTitle>Input Required</ToastTitle>
                  <ToastDescription>Please provide a display name</ToastDescription>
                </VStack>
              </Toast>
            ),
          });
          return;
        }

        console.log("Starting signup process with email:", email);
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim(),
            },
          },
        });
        
        if (result.error) {
          console.error("Auth signup error:", result.error);
          throw result.error;
        }
        
        console.log("Auth signup successful, user created:", result.data.user?.id);

        console.log("Signup process completed successfully");
      } else {
        console.log("Starting sign in process with email:", email);
        result = await supabase.auth.signInWithPassword({ email, password });
        
        if (result.error) {
          console.error("Sign in error:", result.error);
          throw result.error;
        }
        
        console.log("Sign in successful for user:", result.data.user?.id);
      }

      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>{isSignUp ? "Signup Successful!" : "Signed In Successfully!"}</ToastTitle>
            </VStack>
          </Toast>
        ),
      });
    } catch (error) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="solid">
            <VStack space="xs">
              <ToastTitle>Authentication Failed</ToastTitle>
              <ToastDescription>
                {error instanceof Error ? error.message : "An unknown error occurred"}
              </ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  };

  return (
    <Box flex={1} bg="#1E2028" pt={20} testID="login-screen-box">
      <Center flex={1} px="$4">
        <VStack space="md" w="100%">
          <Heading color="$textLight50" size="2xl" mb="$8" textAlign="center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Heading>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="gray"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Password"
            value={password}
            style={styles.input}
            placeholderTextColor="gray"
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          {isSignUp && (
            <TextInput
              placeholder="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholderTextColor="gray"
            />
          )}

          <Button
            size="lg"
            variant="solid"
            action="primary"
            onPress={handleAuth}
            bg="$primary500"
            $pressed={{ bg: "$primary600" }}
          >
            <ButtonText>{isSignUp ? "Sign Up" : "Sign In"}</ButtonText>
          </Button>

          <Button
            size="lg"
            variant="link"
            onPress={() => {
              setIsSignUp(!isSignUp);
              if (!isSignUp) setDisplayName("");
            }}
          >
            <ButtonText color="$primary500">
              {isSignUp
                ? "Already have an account? Sign In"
                : "Need an account? Sign Up"}
            </ButtonText>
          </Button>
        </VStack>
      </Center>
    </Box>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  input: {
    color: "white",
    fontSize: parseFontSize("md"),
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 7,
    padding: 15,
    backgroundColor: "#2A2E38",
    marginBottom: 10,
  },
});
