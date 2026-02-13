import React, { useState } from "react";
import {
  Box,
  VStack,
  Button,
  ButtonText,
  ButtonIcon,
  useToast,
  Toast,
  ToastTitle,
  ToastDescription,
  Center,
  Heading,
  Text,
} from "@gluestack-ui/themed";
import { supabase } from "../utils/supabaseClient";
import { Platform, StyleSheet, TextInput } from "react-native";
import { parseFontSize } from "../../helper/fontsize";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { AntDesign } from '@expo/vector-icons';
import {
  GOOGLE_EXPO_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@env';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = () => {
  const toast = useToast();
  const navigation = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [authView, setAuthView] = useState<"auth" | "confirm-email">("auth");
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState("");
  const [isResendingConfirmEmail, setIsResendingConfirmEmail] = useState(false);

  const executionEnvironment = (Constants as any).executionEnvironment as string | undefined;
  const isExpoGo = executionEnvironment === 'storeClient';
  const needsIosClientId = Platform.OS === 'ios';
  const needsAndroidClientId = Platform.OS === 'android';
  const hasGoogleClientId = Boolean(
    (!needsIosClientId || GOOGLE_IOS_CLIENT_ID) && (!needsAndroidClientId || GOOGLE_ANDROID_CLIENT_ID)
  );

  const redirectUri = React.useMemo(() => {
    return AuthSession.makeRedirectUri({
      scheme:
        Platform.OS === "ios"
          ? "com.googleusercontent.apps.357487995576-au4q5qoakvdui97gneroh4h3jrssphfp"
          : "tiger",
      path: "oauth",
    });
  }, []);

  console.log('[GoogleAuth] redirectUri', redirectUri);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest(
    {
      // Dev Client / native builds
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
      // Keep web client for web platform (and harmless on native)
      webClientId: GOOGLE_WEB_CLIENT_ID,

      scopes: ['openid', 'profile', 'email'],
      redirectUri,
    } as any
  );

  React.useEffect(() => {
    (async () => {
      if (!googleResponse) return;
      if (googleResponse.type !== 'success') return;

      const idToken =
        (googleResponse as any).params?.id_token ||
        (googleResponse as any).authentication?.idToken ||
        undefined;
      if (!idToken) {
        toast.show({
          placement: 'top',
          render: ({ id }) => (
            <Toast nativeID={id} action="error" variant="solid">
              <VStack space="xs">
                <ToastTitle>Google Sign In Failed</ToastTitle>
                <ToastDescription>Missing Google ID token.</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        toast.show({
          placement: 'top',
          render: ({ id }) => (
            <Toast nativeID={id} action="error" variant="solid">
              <VStack space="xs">
                <ToastTitle>Google Sign In Failed</ToastTitle>
                <ToastDescription>{error.message ?? 'Unable to authenticate with Google.'}</ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return;
      }

      // Ensure our app-specific display_name is set for Google sign-ups.
      // Supabase typically provides name/full_name in user_metadata, but our app uses display_name.
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        const meta: any = (user as any)?.user_metadata ?? {};
        const existing = (meta?.display_name ?? '').toString().trim();
        if (!existing) {
          const candidate = (
            meta?.full_name ||
            meta?.name ||
            meta?.given_name ||
            (user?.email ? user.email.split('@')[0] : '')
          )
            ?.toString()
            .trim();

          if (candidate) {
            await supabase.auth.updateUser({ data: { display_name: candidate } });
          }
        }
      } catch {
        // Non-fatal: continue even if metadata update fails.
      }

      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>Signed In with Google</ToastTitle>
            </VStack>
          </Toast>
        ),
      });
    })().catch(() => {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="solid">
            <VStack space="xs">
              <ToastTitle>Google Sign In Failed</ToastTitle>
              <ToastDescription>An unexpected error occurred.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    });
  }, [googleResponse, toast]);

  console.log("🚀 ~ LoginScreen ~ email:", email);

  const isEmailNotConfirmedError = (err: unknown) => {
    const code = (err as any)?.code;
    const message = (err as any)?.message;
    return (
      code === "email_not_confirmed" ||
      (typeof message === "string" && message.toLowerCase().includes("email not confirmed"))
    );
  };

  const handleResendConfirmationEmail = async () => {
    const targetEmail = (pendingConfirmEmail || email).trim();
    if (!targetEmail) {
      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="warning" variant="accent">
            <VStack space="xs">
              <ToastTitle>Input Required</ToastTitle>
              <ToastDescription>Please enter your email address.</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
      return;
    }

    setIsResendingConfirmEmail(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: targetEmail });
      if (error) throw error;

      toast.show({
        placement: "top",
        render: ({ id }) => (
          <Toast nativeID={id} action="success" variant="solid">
            <VStack space="xs">
              <ToastTitle>Confirmation Email Sent</ToastTitle>
              <ToastDescription>Check your inbox and spam folder.</ToastDescription>
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
              <ToastTitle>Resend Failed</ToastTitle>
              <ToastDescription>
                {error instanceof Error ? error.message : "An unknown error occurred"}
              </ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    } finally {
      setIsResendingConfirmEmail(false);
    }
  };

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

        setPendingConfirmEmail(email.trim());
        setAuthView("confirm-email");
      } else {
        console.log("Starting sign in process with email:", email);
        result = await supabase.auth.signInWithPassword({ email, password });
        
        if (result.error) {
          console.error("Sign in error:", result.error);
          if (isEmailNotConfirmedError(result.error)) {
            setPendingConfirmEmail(email.trim());
            setAuthView("confirm-email");
            return;
          }
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

  const handleGoogleSignUp = async () => {
    try {
      if (isExpoGo) {
        toast.show({
          placement: 'top',
          render: ({ id }) => (
            <Toast nativeID={id} action="error" variant="solid">
              <VStack space="xs">
                <ToastTitle>Google Sign Up Requires Dev Build</ToastTitle>
                <ToastDescription>
                  Google OAuth is unreliable in Expo Go. Build a development client via EAS and try again.
                </ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return;
      }

      if (!hasGoogleClientId) {
        const missing: string[] = [];
        if (needsIosClientId && !GOOGLE_IOS_CLIENT_ID) missing.push('GOOGLE_IOS_CLIENT_ID');
        if (needsAndroidClientId && !GOOGLE_ANDROID_CLIENT_ID) missing.push('GOOGLE_ANDROID_CLIENT_ID');

        toast.show({
          placement: 'top',
          render: ({ id }) => (
            <Toast nativeID={id} action="error" variant="solid">
              <VStack space="xs">
                <ToastTitle>Google Sign Up Not Configured</ToastTitle>
                <ToastDescription>
                  {missing.length
                    ? `Missing in .env: ${missing.join(', ')}`
                    : 'Missing Google OAuth client IDs in .env.'}
                </ToastDescription>
              </VStack>
            </Toast>
          ),
        });
        return;
      }
      await googlePromptAsync();
    } catch (e) {
      toast.show({
        placement: 'top',
        render: ({ id }) => (
          <Toast nativeID={id} action="error" variant="solid">
            <VStack space="xs">
              <ToastTitle>Google Sign Up Failed</ToastTitle>
              <ToastDescription>{e instanceof Error ? e.message : 'An unknown error occurred'}</ToastDescription>
            </VStack>
          </Toast>
        ),
      });
    }
  };

  return (
    <Box flex={1} bg="#1E2028" pt={20} testID="login-screen-box">
      <Center flex={1} px="$4">
        {authView === "confirm-email" ? (
          <VStack space="md" w="100%">
            <Heading color="$textLight50" size="2xl" mb="$2" textAlign="center">
              Confirm Your Email
            </Heading>
            <Text color="$textLight200" textAlign="center">
              Your email hasn’t been confirmed yet. Please confirm your email, then come back and sign in.
            </Text>
            {!!pendingConfirmEmail.trim() && (
              <Text color="$textLight200" textAlign="center">
                Email: {pendingConfirmEmail.trim()}
              </Text>
            )}

            <Button
              size="lg"
              variant="solid"
              action="primary"
              onPress={handleResendConfirmationEmail}
              bg="$primary500"
              $pressed={{ bg: "$primary600" }}
              isDisabled={isResendingConfirmEmail}
            >
              <ButtonText color="$textLight50">
                {isResendingConfirmEmail ? "Sending..." : "Resend Confirmation Email"}
              </ButtonText>
            </Button>

            <Button
              size="lg"
              variant="link"
              onPress={() => {
                setAuthView("auth");
                setPendingConfirmEmail("");
              }}
            >
              <ButtonText color="$white">Back to Sign In</ButtonText>
            </Button>
          </VStack>
        ) : (
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
              <ButtonText color="$textLight50">{isSignUp ? "Sign Up" : "Sign In"}</ButtonText>
            </Button>

            {isSignUp && (
              <Button
                size="lg"
                variant="outline"
                action="secondary"
                onPress={handleGoogleSignUp}
                isDisabled={!googleRequest}
                backgroundColor="$white"
                borderColor="$transparent"
              >
                {/* @ts-ignore ButtonIcon typing for vector icons */}
                <ButtonIcon as={AntDesign as any} name="google" mr="$2" size={28} />
                <ButtonText color="#111111">Sign up with Google</ButtonText>
              </Button>
            )}

            <Button
              size="lg"
              variant="link"
              onPress={() => {
                setIsSignUp(!isSignUp);
                setAuthView("auth");
                setPendingConfirmEmail("");
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
        )}
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
