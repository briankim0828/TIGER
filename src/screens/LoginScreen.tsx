import React, { useState } from 'react';
import { Box, VStack, Input, Button, Text, useToast, Center, Heading } from 'native-base';
import { useAuth } from '../firebase/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();
  const toast = useToast();

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      toast.show({
        description: error instanceof Error ? error.message : "Authentication failed",
        placement: "top"
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
          
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            color="white"
            fontSize="md"
            autoCapitalize="none"
          />
          
          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            type="password"
            color="white"
            fontSize="md"
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
            {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </Button>
        </VStack>
      </Center>
    </Box>
  );
};

export default LoginScreen; 