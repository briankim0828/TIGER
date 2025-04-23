import React, { useState } from "react";
import { Box, VStack, Button, useToast, Center, Heading } from "native-base";
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
        // Validate display name is provided for signup
        if (!displayName.trim()) {
          toast.show({
            description: "Please provide a display name",
            placement: "top",
          });
          return;
        }

        console.log("Starting signup process with email:", email);
        result = await supabase.auth.signUp({ email, password });
        
        if (result.error) {
          console.error("Auth signup error:", result.error);
          throw result.error;
        }
        
        console.log("Auth signup successful, user created:", result.data.user?.id);
        const userId = result.data.user?.id;
        
        if (!userId) {
          throw new Error("User ID not found after signup");
        }
        
        // Add user to the users table
        console.log("Inserting into users table with ID:", userId);
        const { data: userData, error: usersError } = await supabase
          .from("users")
          .insert({ id: userId, email: result.data.user?.email });
        
        // It might return an empty error object even on success
        console.log("Users table response:", { data: userData, error: usersError });
          
        if (usersError && Object.keys(usersError).length > 0) {
          console.error("Error inserting into users table:", usersError);
          throw usersError;
        }
        
        // Add user to the profiles table
        console.log("Inserting into profiles table with display name:", displayName);
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .insert({ 
            user_id: userId, 
            email: result.data.user?.email, 
            display_name: displayName,
            avatar_id: null
          });
          
        console.log("Profiles table response:", { data: profileData, error: profileError });
          
        if (profileError && Object.keys(profileError).length > 0) {
          console.error("Error inserting into profiles table:", profileError);
          throw profileError;
        }
        
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
        description: isSignUp
          ? "Signup successful!"
          : "Signed in successfully!",
        placement: "top",
      });
    } catch (error) {
      toast.show({
        description:
          error instanceof Error ? error.message : "Authentication failed",
        placement: "top",
      });
    }
  };

  return (
    <Box flex={1} bg="#1E2028" safeArea mt={-20}>
      <Center flex={1} px={4}>
        <VStack space={5} w="100%">
          <Heading color="white" size="xl" mb={8}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Heading>

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="gray"
            autoCapitalize="none"
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
            bg="#6B8EF2"
            onPress={handleAuth}
            _pressed={{ bg: "#5A7DE0" }}
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </Button>

          <Button
            variant="ghost"
            onPress={() => {
              setIsSignUp(!isSignUp);
              // Clear display name when toggling to prevent confusion
              if (!isSignUp) setDisplayName("");
            }}
            _text={{ color: "#6B8EF2" }}
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Need an account? Sign Up"}
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
  },
});
