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
  const [isSignUp, setIsSignUp] = useState(false);

  console.log("🚀 ~ LoginScreen ~ email:", email);

  const handleAuth = async () => {
    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        throw result.error;
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
    <Box flex={1} bg="#1E2028" safeArea>
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
            autoCapitalize="none"
            />

          <TextInput
            placeholder="Password"
            value={password}
            style={styles.input}
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          <Button
            bg="#6B8EF2"
            onPress={handleAuth}
            _pressed={{ bg: "#5A7DE0" }}
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </Button>

          <Button
            variant="ghost"
            onPress={() => setIsSignUp(!isSignUp)}
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
